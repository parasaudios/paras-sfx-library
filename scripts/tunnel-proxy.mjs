/**
 * Lightweight reverse proxy that sits between Cloudflare Tunnel and local Supabase.
 * Blocks requests using the service_role key and restricts dangerous endpoints.
 *
 * Tunnel -> this proxy (port 54350) -> Supabase API (port 54341)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_PORT = 54341;
const PROXY_PORT = 54350;
const SUPABASE_HOST = '127.0.0.1';
const PROXY_TIMEOUT_MS = 30000; // 30 second timeout for upstream requests

// Block any JWT containing "service_role" in its payload (base64-encoded)
// This catches both old demo keys and the new custom service_role key
const SERVICE_ROLE_FRAGMENTS = [
  'c2VydmljZV9yb2xl',       // base64url of "service_role" — appears in ANY service_role JWT payload
  'InNlcnZpY2Vfcm9sZSI',   // base64 of '"service_role"' with quotes (legacy detection)
  'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI', // old default demo key fragment
];

// Blocked path patterns (admin-only endpoints that shouldn't be exposed)
const BLOCKED_PATHS = [
  '/auth/v1/admin',    // Admin user management
  '/pg/',              // pgMeta — full DB schema access
];

// ── Logging ──────────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, '..', 'tunnel-proxy.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(level, req, message) {
  const timestamp = new Date().toISOString();
  const sourceIp = req?.headers?.['x-forwarded-for']
    || req?.headers?.['cf-connecting-ip']
    || req?.socket?.remoteAddress
    || '-';
  const method = req?.method || '-';
  const url = req?.url || '-';
  const line = `[${timestamp}] [${level}] [${sourceIp}] ${method} ${url} — ${message}`;
  logStream.write(line + '\n');
  if (level === 'BLOCKED' || level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
}

// ── Service role detection ───────────────────────────────────────────────────

function containsServiceRoleKey(value) {
  if (typeof value !== 'string') return false;
  return SERVICE_ROLE_FRAGMENTS.some(fragment => value.includes(fragment));
}

function isServiceRoleRequest(req) {
  // Check headers (case-insensitive by default in Node http)
  if (containsServiceRoleKey(req.headers['apikey'])) return 'apikey header';
  if (containsServiceRoleKey(req.headers['authorization'])) return 'authorization header';

  // Check query parameters (e.g. ?apikey=...)
  try {
    const url = new URL(req.url, 'http://localhost');
    for (const [key, value] of url.searchParams) {
      if (containsServiceRoleKey(value)) return `query param "${key}"`;
    }
  } catch { /* malformed URL — let it pass to Supabase for proper error */ }

  return null;
}

// ── Blocked paths ────────────────────────────────────────────────────────────

function isBlockedPath(urlPath) {
  const normalized = urlPath.toLowerCase().split('?')[0];
  for (const blocked of BLOCKED_PATHS) {
    if (normalized.startsWith(blocked.toLowerCase())) return blocked;
  }
  return null;
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer((clientReq, clientRes) => {
  // 1. Block service_role key in any location
  const serviceRoleSource = isServiceRoleRequest(clientReq);
  if (serviceRoleSource) {
    clientRes.writeHead(403, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Forbidden', message: 'Service role access denied via public endpoint' }));
    log('BLOCKED', clientReq, `service_role key via ${serviceRoleSource}`);
    return;
  }

  // 2. Block dangerous admin paths (case-insensitive)
  const blockedPath = isBlockedPath(clientReq.url || '');
  if (blockedPath) {
    clientRes.writeHead(403, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Forbidden', message: 'Endpoint not available via public access' }));
    log('BLOCKED', clientReq, `admin path "${blockedPath}"`);
    return;
  }

  // 3. Proxy the request to Supabase
  const proxyReq = http.request(
    {
      hostname: SUPABASE_HOST,
      port: SUPABASE_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: clientReq.headers,
      timeout: PROXY_TIMEOUT_MS,
    },
    (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
    }
  );

  proxyReq.on('timeout', () => {
    log('ERROR', clientReq, 'upstream timeout');
    proxyReq.destroy();
    if (!clientRes.headersSent) {
      clientRes.writeHead(504, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'Gateway Timeout', message: 'Supabase backend did not respond in time' }));
    }
  });

  proxyReq.on('error', (err) => {
    log('ERROR', clientReq, `proxy error: ${err.message}`);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'Bad Gateway', message: 'Supabase backend unavailable' }));
    }
  });

  clientReq.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  log('INFO', null, `Security proxy listening on port ${PROXY_PORT}`);
  log('INFO', null, `Forwarding to Supabase at ${SUPABASE_HOST}:${SUPABASE_PORT}`);
  log('INFO', null, `Blocking service_role key and admin endpoints`);
  log('INFO', null, `Log file: ${LOG_FILE}`);
});

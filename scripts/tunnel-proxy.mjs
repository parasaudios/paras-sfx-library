/**
 * Lightweight reverse proxy that sits between Cloudflare Tunnel and local Supabase.
 * Blocks requests using the service_role key and restricts dangerous endpoints.
 *
 * Tunnel -> this proxy (port 54350) -> Supabase API (port 54341)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { posix } from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_PORT = 54341;
const PROXY_PORT = 54350;
const SUPABASE_HOST = '127.0.0.1';
const PROXY_TIMEOUT_MS = 30000;        // 30s upstream timeout
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB cap on inbound bodies

// ── Login brute-force protection ─────────────────────────────────────────────
// In-memory per-IP failure tracker for POST /auth/v1/token?grant_type=password.
// Independent of Cloudflare so we're protected even if the origin IP leaks.
const LOGIN_FAIL_PATH = '/auth/v1/token';
const LOGIN_FAIL_WINDOW_MS = 10 * 60 * 1000;     // 10 min sliding window
const LOGIN_FAIL_THRESHOLD = 10;                  // failures before block
const LOGIN_BLOCK_DURATION_MS = 60 * 60 * 1000;   // 1 hour block
const loginAttempts = new Map(); // ip -> { count, firstFailAt, blockedUntil }

function clientIp(req) {
  return req.headers['cf-connecting-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function isLoginRequest(method, normalizedPath, rawUrl) {
  if (method !== 'POST') return false;
  if (normalizedPath !== LOGIN_FAIL_PATH) return false;
  // Only the password grant is brute-forceable. Refresh grants use signed JWTs.
  try {
    const grant = new URL(rawUrl, 'http://x').searchParams.get('grant_type');
    return grant === null || grant === 'password';
  } catch {
    return true; // err on the side of throttling
  }
}

function checkLoginBlock(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return null;
  const now = Date.now();
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return Math.ceil((entry.blockedUntil - now) / 1000);
  }
  // Expire old windows
  if (entry.firstFailAt && now - entry.firstFailAt > LOGIN_FAIL_WINDOW_MS) {
    loginAttempts.delete(ip);
  }
  return null;
}

function recordLoginResult(ip, status) {
  const now = Date.now();
  if (status >= 200 && status < 300) {
    // Successful login wipes the slate
    loginAttempts.delete(ip);
    return;
  }
  if (status === 400 || status === 401 || status === 403 || status === 422) {
    const entry = loginAttempts.get(ip) || { count: 0, firstFailAt: now, blockedUntil: 0 };
    if (now - entry.firstFailAt > LOGIN_FAIL_WINDOW_MS) {
      // Window expired — restart count
      entry.count = 0;
      entry.firstFailAt = now;
    }
    entry.count += 1;
    if (entry.count >= LOGIN_FAIL_THRESHOLD) {
      entry.blockedUntil = now + LOGIN_BLOCK_DURATION_MS;
    }
    loginAttempts.set(ip, entry);
  }
}

// Periodic cleanup so the Map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if ((!entry.blockedUntil || entry.blockedUntil <= now) &&
        now - entry.firstFailAt > LOGIN_FAIL_WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

// Block any JWT containing "service_role" in its payload (base64-encoded)
// This catches both old demo keys and the new custom service_role key
const SERVICE_ROLE_FRAGMENTS = [
  'c2VydmljZV9yb2xl',       // base64url of "service_role" — appears in ANY service_role JWT payload
  'InNlcnZpY2Vfcm9sZSI',   // base64 of '"service_role"' with quotes (legacy detection)
  'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI', // old default demo key fragment
];

// Blocked path prefixes (admin-only endpoints + Kong routes the app doesn't use).
// Path is normalized (lowercased, %XX-decoded, .. collapsed) before this check
// so percent-encoded traversal and case-variant probes can't bypass.
const BLOCKED_PATHS = [
  '/auth/v1/admin',     // GoTrue admin user mgmt
  '/pg/',               // pgMeta — full DB schema/exec access
  '/graphql/v1',        // GraphQL introspection (more leakage than REST)
  '/mcp',               // Studio internal MCP endpoint
  '/analytics/v1',      // Logflare internal API
  '/rest-admin/v1',     // PostgREST admin server
  '/functions/v1',      // edge runtime (no real functions deployed)
  '/.well-known/',      // OAuth/OIDC discovery — not used by the app
];

// Allowed HTTP methods. TRACE/CONNECT/etc. have no legitimate use here.
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

// ── Logging ──────────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, '..', 'tunnel-proxy.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(level, req, message) {
  const timestamp = new Date().toISOString();
  const sourceIp = req?.headers?.['cf-connecting-ip']
    || req?.headers?.['x-forwarded-for']
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

// ── URL normalization ────────────────────────────────────────────────────────

// Normalize the request path: decode %XX, collapse '..' and duplicate '/',
// lowercase. Returns '' if the URL is malformed (caller should reject).
function normalizedPath(rawUrl) {
  try {
    const u = new URL(rawUrl, 'http://x');
    let p = decodeURIComponent(u.pathname);
    // Reject null bytes and control chars outright
    if (/[\x00-\x1f]/.test(p)) return '';
    // posix.normalize collapses '..' and './'
    p = posix.normalize(p);
    return p.toLowerCase();
  } catch {
    return '';
  }
}

// ── Service role detection ───────────────────────────────────────────────────

function containsServiceRoleKey(value) {
  if (typeof value !== 'string') return false;
  return SERVICE_ROLE_FRAGMENTS.some(fragment => value.includes(fragment));
}

function isServiceRoleRequest(req) {
  if (containsServiceRoleKey(req.headers['apikey'])) return 'apikey header';
  if (containsServiceRoleKey(req.headers['authorization'])) return 'authorization header';

  try {
    const url = new URL(req.url, 'http://localhost');
    for (const [key, value] of url.searchParams) {
      if (containsServiceRoleKey(value)) return `query param "${key}"`;
    }
  } catch { /* malformed URL — handled separately */ }

  return null;
}

// ── Blocked paths ────────────────────────────────────────────────────────────

function isBlockedPath(normalized) {
  for (const blocked of BLOCKED_PATHS) {
    if (normalized.startsWith(blocked.toLowerCase())) return blocked;
  }
  return null;
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer((clientReq, clientRes) => {
  // 0. Method allowlist
  if (!ALLOWED_METHODS.has(clientReq.method)) {
    clientRes.writeHead(405, { 'Content-Type': 'application/json', 'Allow': [...ALLOWED_METHODS].join(', ') });
    clientRes.end(JSON.stringify({ error: 'Method Not Allowed' }));
    log('BLOCKED', clientReq, `disallowed method ${clientReq.method}`);
    return;
  }

  // 1. Normalize the URL up-front. Reject malformed URLs.
  const normPath = normalizedPath(clientReq.url || '');
  if (!normPath) {
    clientRes.writeHead(400, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Bad Request', message: 'Malformed URL' }));
    log('BLOCKED', clientReq, 'malformed or unsafe URL');
    return;
  }

  // 2. Block service_role key in headers or query
  const serviceRoleSource = isServiceRoleRequest(clientReq);
  if (serviceRoleSource) {
    clientRes.writeHead(403, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Forbidden', message: 'Service role access denied via public endpoint' }));
    log('BLOCKED', clientReq, `service_role key via ${serviceRoleSource}`);
    return;
  }

  // 3. Block dangerous / unused paths (after normalization so %2e%2e/admin can't bypass)
  const blockedPath = isBlockedPath(normPath);
  if (blockedPath) {
    clientRes.writeHead(403, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Forbidden', message: 'Endpoint not available via public access' }));
    log('BLOCKED', clientReq, `blocked path "${blockedPath}" (normalized: ${normPath})`);
    return;
  }

  // 4. Login brute-force throttle (server-side, runs even if CF rate limit fails)
  const ip = clientIp(clientReq);
  const isLogin = isLoginRequest(clientReq.method, normPath, clientReq.url || '');
  if (isLogin) {
    const blockedFor = checkLoginBlock(ip);
    if (blockedFor !== null) {
      clientRes.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(blockedFor),
      });
      clientRes.end(JSON.stringify({
        error: 'Too Many Requests',
        message: `Too many failed login attempts. Try again in ${Math.ceil(blockedFor / 60)} minute(s).`,
      }));
      log('BLOCKED', clientReq, `login throttled (${blockedFor}s remaining)`);
      return;
    }
  }

  // 5. Enforce body size limit
  let bodyBytes = 0;
  let aborted = false;
  clientReq.on('data', (chunk) => {
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_BODY_BYTES && !aborted) {
      aborted = true;
      log('BLOCKED', clientReq, `body exceeded ${MAX_BODY_BYTES} bytes`);
      if (!clientRes.headersSent) {
        clientRes.writeHead(413, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: 'Payload Too Large' }));
      }
      clientReq.destroy();
    }
  });

  // 6. Proxy to Supabase
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
      if (aborted) return;
      if (isLogin) {
        recordLoginResult(ip, proxyRes.statusCode || 0);
        const entry = loginAttempts.get(ip);
        if (entry && entry.count >= LOGIN_FAIL_THRESHOLD - 2 && entry.count < LOGIN_FAIL_THRESHOLD) {
          log('INFO', clientReq, `login failure ${entry.count}/${LOGIN_FAIL_THRESHOLD} for IP`);
        } else if (entry && entry.blockedUntil > Date.now()) {
          log('BLOCKED', clientReq, `IP just hit login fail threshold — blocked for ${LOGIN_BLOCK_DURATION_MS / 60000} min`);
        }
      }
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
    if (aborted) return;
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
  log('INFO', null, `Blocked path prefixes: ${BLOCKED_PATHS.join(', ')}`);
  log('INFO', null, `Body size limit: ${MAX_BODY_BYTES} bytes`);
  log('INFO', null, `Log file: ${LOG_FILE}`);
});

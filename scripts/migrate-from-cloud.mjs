/**
 * COMPLETED — One-time migration script (March 2026).
 * Migrated all data and audio files from Supabase Cloud to local self-hosted instance.
 * Cloud project has since been decommissioned. Kept for historical reference only.
 *
 * Source: Supabase Cloud (decommissioned)
 * Target: Local docker compose instance (port 54341)
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Cloud source config ─────────────────────────────────────────────────────
// Cloud project has been decommissioned — these values are no longer valid
const CLOUD_URL = process.env.CLOUD_SUPABASE_URL || '';
const CLOUD_ANON_KEY = process.env.CLOUD_SUPABASE_ANON_KEY || '';

// ── Local target config ─────────────────────────────────────────────────────
const LOCAL_URL = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54341';
const LOCAL_SERVICE_KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY || '';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, data, headers: res.headers }); }
      });
    }).on('error', reject);
  });
}

function postJSON(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`)));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function uploadFile(localPath, fileBuffer, contentType, serviceKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/storage/v1/object/sounds/${localPath}`, LOCAL_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'x-upsert': 'true',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

// ── Main migration ──────────────────────────────────────────────────────────

async function migrate() {
  console.log('=== Migrating data from Supabase Cloud to local ===\n');

  // 1. Fetch all sounds from cloud
  console.log('[1/5] Fetching sounds from cloud...');
  const PAGE_SIZE = 500;
  let allSounds = [];
  let offset = 0;
  while (true) {
    const { status, data } = await fetchJSON(
      `${CLOUD_URL}/rest/v1/sounds?select=*&deleted_at=is.null&order=created_at.asc&offset=${offset}&limit=${PAGE_SIZE}`,
      { apikey: CLOUD_ANON_KEY, Authorization: `Bearer ${CLOUD_ANON_KEY}` }
    );
    if (status !== 200) { console.error('Failed to fetch sounds:', status, data); break; }
    if (!Array.isArray(data) || data.length === 0) break;
    allSounds = allSounds.concat(data);
    console.log(`  Fetched ${allSounds.length} sounds...`);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`  Total: ${allSounds.length} sounds\n`);

  // 2. Insert sounds into local DB
  console.log('[2/5] Inserting sounds into local database...');
  let insertedCount = 0;
  const BATCH_SIZE = 50;
  for (let i = 0; i < allSounds.length; i += BATCH_SIZE) {
    const batch = allSounds.slice(i, i + BATCH_SIZE).map(s => ({
      id: s.id,
      title: s.title,
      filename: s.filename,
      slug: s.slug,
      tags: s.tags,
      mp3_path: s.mp3_path,
      wav_path: s.wav_path,
      has_wav: s.has_wav,
      file_size: s.file_size,
      microphone: s.microphone,
      duration_seconds: s.duration_seconds,
      source: s.source,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    const res = await postJSON(
      `${LOCAL_URL}/rest/v1/sounds?on_conflict=id`,
      batch,
      {
        apikey: LOCAL_SERVICE_KEY,
        Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      }
    );
    if (res.status >= 200 && res.status < 300) {
      insertedCount += batch.length;
    } else {
      console.error(`  Batch insert failed (${i}-${i + batch.length}):`, res.status, JSON.stringify(res.data).slice(0, 200));
    }
  }
  console.log(`  Inserted ${insertedCount}/${allSounds.length} sounds\n`);

  // 3. Fetch and insert suggestions
  console.log('[3/5] Fetching suggestions from cloud...');
  const { data: suggestions } = await fetchJSON(
    `${CLOUD_URL}/rest/v1/suggestions?select=*&order=created_at.asc`,
    { apikey: CLOUD_ANON_KEY, Authorization: `Bearer ${CLOUD_ANON_KEY}` }
  );
  if (Array.isArray(suggestions) && suggestions.length > 0) {
    const res = await postJSON(
      `${LOCAL_URL}/rest/v1/suggestions?on_conflict=id`,
      suggestions,
      {
        apikey: LOCAL_SERVICE_KEY,
        Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      }
    );
    console.log(`  ${suggestions.length} suggestions → ${res.status >= 200 && res.status < 300 ? 'OK' : 'FAILED'}\n`);
  } else {
    console.log('  No suggestions found\n');
  }

  // 4. Fetch and insert tags
  console.log('[4/5] Fetching tags from cloud...');
  const { data: tags } = await fetchJSON(
    `${CLOUD_URL}/rest/v1/tags?select=*&order=name.asc`,
    { apikey: CLOUD_ANON_KEY, Authorization: `Bearer ${CLOUD_ANON_KEY}` }
  );
  if (Array.isArray(tags) && tags.length > 0) {
    const res = await postJSON(
      `${LOCAL_URL}/rest/v1/tags?on_conflict=id`,
      tags,
      {
        apikey: LOCAL_SERVICE_KEY,
        Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      }
    );
    console.log(`  ${tags.length} tags → ${res.status >= 200 && res.status < 300 ? 'OK' : 'FAILED'}\n`);
  } else {
    console.log('  No tags found\n');
  }

  // 5. Download and upload audio files
  console.log('[5/5] Migrating audio files from cloud storage...');
  const soundsWithPaths = allSounds.filter(s => s.mp3_path);
  let uploaded = 0, skipped = 0, failed = 0;

  for (let i = 0; i < soundsWithPaths.length; i++) {
    const sound = soundsWithPaths[i];
    const paths = [sound.mp3_path];
    if (sound.wav_path) paths.push(sound.wav_path);

    for (const filePath of paths) {
      const cloudFileUrl = `${CLOUD_URL}/storage/v1/object/public/sounds/${filePath}`;
      try {
        const fileBuffer = await downloadFile(cloudFileUrl);
        const contentType = filePath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
        const uploadRes = await uploadFile(filePath, fileBuffer, contentType, LOCAL_SERVICE_KEY);
        if (uploadRes.status >= 200 && uploadRes.status < 300) {
          uploaded++;
        } else {
          console.error(`  [FAIL] ${filePath}: HTTP ${uploadRes.status}`);
          failed++;
        }
      } catch (err) {
        skipped++;
      }
    }

    if ((i + 1) % 50 === 0 || i === soundsWithPaths.length - 1) {
      console.log(`  Progress: ${i + 1}/${soundsWithPaths.length} sounds processed (${uploaded} uploaded, ${skipped} skipped, ${failed} failed)`);
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Sounds: ${insertedCount}`);
  console.log(`Audio files: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
  console.log(`Suggestions: ${suggestions?.length || 0}`);
  console.log(`Tags: ${tags?.length || 0}`);
}

migrate().catch(console.error);

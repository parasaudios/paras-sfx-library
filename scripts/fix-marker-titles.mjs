// One-off cleanup: fix titles polluted with DAW marker timestamps
// produced by the bulk importer.
//
// Patterns fixed:
//   "Cock Slap Marker 14 000000013"  -> "Cock Slap 14"
//   "Thrust Marker 01"               -> "Bed Thrust Movement 1"
//   "400632 Inspectorj Ambience-Seaside-Waves-Close-A" -> "Seaside Waves Ambience"
//
// Usage:
//   node scripts/fix-marker-titles.mjs --dry
//   node scripts/fix-marker-titles.mjs

import { execFileSync, spawnSync } from 'node:child_process';

const DRY_RUN = process.argv.includes('--dry');
const DB = 'supabase_db_Para_SFX_Library';

function psql(sql) {
  return execFileSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-t', '-A', '-F', '\t'],
    { input: sql, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });
}
function psqlFile(sql) {
  const r = spawnSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
}

function cleanTitle(title) {
  let t = title;

  // "Cock Slap Marker 14 000000013" -> "Cock Slap 14"
  let m = /^(.*?)\s+Marker\s+(\d+)\s+\d{6,}\s*$/i.exec(t);
  if (m) return `${m[1].trim()} ${parseInt(m[2], 10)}`;

  // "Thrust Marker 01" -> "Bed Thrust Movement 1"
  m = /^Thrust\s+Marker\s+(\d+)\s*$/i.exec(t);
  if (m) return `Bed Thrust Movement ${parseInt(m[1], 10)}`;

  // "400632 Inspectorj Ambience-Seaside-Waves-Close-A" -> "Seaside Waves Ambience"
  if (/inspectorj/i.test(t) && /seaside/i.test(t)) {
    return 'Seaside Waves Ambience';
  }

  // Generic leading long number like "400632 Something" -> "Something"
  m = /^\d{5,}\s+(.+)$/.exec(t);
  if (m) return m[1].trim();

  // Generic "Foo Marker N M" (no trailing long digits) -> "Foo N"
  m = /^(.*?)\s+Marker\s+(\d+)(?:\s+(\d+))?\s*$/i.exec(t);
  if (m) {
    const n = parseInt(m[2], 10);
    return `${m[1].trim()} ${n}`;
  }

  return t;
}

const raw = psql(`SELECT id, title FROM sounds WHERE deleted_at IS NULL;`);
const rows = raw.trim().split('\n').filter(Boolean).map(l => {
  const [id, title] = l.split('\t');
  return { id, title };
});

const updates = [];
for (const r of rows) {
  const cleaned = cleanTitle(r.title);
  if (cleaned !== r.title) {
    updates.push({ id: r.id, old: r.title, new: cleaned });
  }
}

console.log(`${updates.length} titles need fixing (out of ${rows.length} sounds).\n`);
console.log('--- Preview (first 15) ---');
for (const u of updates.slice(0, 15)) {
  console.log(`  [${u.old}]`);
  console.log(`  -> ${u.new}\n`);
}

if (DRY_RUN) { console.log('--dry specified. No writes.'); process.exit(0); }

const sql = ['BEGIN;'];
for (const u of updates) {
  const esc = (s) => s.replace(/'/g, "''");
  sql.push(`UPDATE public.sounds SET title = '${esc(u.new)}' WHERE id = '${u.id}';`);
}
sql.push('COMMIT;');

psqlFile(sql.join('\n'));
console.log(`\nDone: ${updates.length} titles updated.`);

// Two-step cleanup:
//
//   1. DEDUPE: for each MD5 group with >1 file, keep one sound (most listens ->
//      oldest), soft-delete the other sounds that point at those duplicate files.
//   2. DISAMBIGUATE: for remaining sounds that share the exact same title but
//      have different audio (mic/air variants), append distinguishing tokens
//      so every sound has a unique displayed title.
//
// Usage:
//   node scripts/dedupe-and-disambiguate.mjs --dry
//   node scripts/dedupe-and-disambiguate.mjs
//
// Prereq: .tmp_file_hashes.tsv already produced (md5 <TAB> size <TAB> storage_name per line).

import { readFileSync } from 'node:fs';
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

// ── 1. Load file hashes ──────────────────────────────────────────────
const hashText = readFileSync(
  'C:/Users/camer/Para SFX Library/.tmp_file_hashes.tsv', 'utf8'
);
// Map: storage_name -> { md5, size }
const fileByName = new Map();
// Map: md5 -> Set<storage_name>
const namesByMd5 = new Map();

for (const line of hashText.trim().split('\n')) {
  const [md5, size, name] = line.split('\t');
  fileByName.set(name, { md5, size });
  if (!namesByMd5.has(md5)) namesByMd5.set(md5, new Set());
  namesByMd5.get(md5).add(name);
}
console.log(`Loaded ${fileByName.size} file hashes.`);

// ── 2. Load sounds ────────────────────────────────────────────────────
const raw = psql(`
  SELECT id, title, coalesce(mp3_path,''), coalesce(wav_path,''),
         coalesce(microphone,''), listens, downloads,
         to_char(created_at, 'YYYY-MM-DDTHH24:MI:SS.US') AS created
  FROM sounds WHERE deleted_at IS NULL;
`);
const sounds = raw.trim().split('\n').filter(Boolean).map(l => {
  const [id, title, mp3, wav, mic, listens, downloads, created] = l.split('\t');
  return { id, title, mp3, wav, mic, listens: +listens, downloads: +downloads, created };
});
console.log(`Loaded ${sounds.length} active sounds.`);

// ── 3. DEDUPE by MD5 of mp3 file ─────────────────────────────────────
// Group sound IDs by their mp3 file's md5 (wav only sounds group by wav md5).
const groupsByMd5 = new Map();  // md5 -> sound[]
for (const s of sounds) {
  // prefer mp3 for dedup; if no mp3, use wav
  const name = s.mp3 || s.wav;
  if (!name) continue;
  const info = fileByName.get(name);
  if (!info) continue;
  const arr = groupsByMd5.get(info.md5) || [];
  arr.push(s);
  groupsByMd5.set(info.md5, arr);
}

// Dupe groups = groups of 2+ sounds sharing the same mp3 md5
const dupeGroups = [...groupsByMd5.values()].filter(g => g.length > 1);

// Rank within a group: keep highest listens first, then oldest, then smallest id.
// Rest get soft-deleted.
function rankKeep(a, b) {
  if (b.listens !== a.listens) return b.listens - a.listens;
  if (a.created !== b.created) return a.created < b.created ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

const softDeletes = [];
const listensMerge = [];  // {keeper, donor} — move listens+downloads to keeper
const downloadsMerge = [];

for (const group of dupeGroups) {
  group.sort(rankKeep);
  const [keeper, ...dupes] = group;
  let extraListens = 0, extraDownloads = 0;
  for (const d of dupes) {
    softDeletes.push(d);
    extraListens += d.listens;
    extraDownloads += d.downloads;
  }
  if (extraListens > 0) listensMerge.push({ keeperId: keeper.id, n: extraListens });
  if (extraDownloads > 0) downloadsMerge.push({ keeperId: keeper.id, n: extraDownloads });
}

console.log(`\n=== DEDUPE: ${dupeGroups.length} byte-identical groups, ${softDeletes.length} rows to soft-delete ===`);
console.log('Sample (first 5 groups):');
for (const g of dupeGroups.slice(0, 5)) {
  console.log(`  md5=${(fileByName.get(g[0].mp3 || g[0].wav) || {}).md5}  (${g.length} rows)`);
  console.log(`    KEEP  ${g[0].title.padEnd(55)}  listens=${g[0].listens}`);
  for (const d of g.slice(1)) {
    console.log(`    DROP  ${d.title.padEnd(55)}  listens=${d.listens}`);
  }
}

// ── 4. DISAMBIGUATE remaining duplicate titles ───────────────────────
// After soft-delete, which sounds still share a title with another live sound?
const liveAfterDedupe = sounds.filter(s => !softDeletes.some(d => d.id === s.id));

function extractAirType(mp3, wav) {
  const p = (mp3 || wav || '').toLowerCase();
  if (p.includes('nonreduced_air')) return 'NonReduced Air';
  if (p.includes('reduced_air'))    return 'Reduced Air';
  return null;
}

const byTitle = new Map();
for (const s of liveAfterDedupe) {
  const k = s.title;
  if (!byTitle.has(k)) byTitle.set(k, []);
  byTitle.get(k).push(s);
}

const renames = [];  // { id, oldTitle, newTitle }
for (const [title, group] of byTitle.entries()) {
  if (group.length <= 1) continue;
  for (const s of group) {
    const mic = s.mic || '';
    const air = extractAirType(s.mp3, s.wav);
    const suffix = [mic, air].filter(Boolean).join(', ');
    if (!suffix) continue;
    const proposed = `${title} (${suffix})`;
    if (proposed !== s.title) renames.push({ id: s.id, oldTitle: s.title, newTitle: proposed });
  }
}

// Second pass: if renaming STILL leaves duplicates (same mic+air), disambiguate by mp3_path stem
const renameMap = new Map(renames.map(r => [r.id, r.newTitle]));
const afterRenameByTitle = new Map();
for (const s of liveAfterDedupe) {
  const t = renameMap.get(s.id) || s.title;
  if (!afterRenameByTitle.has(t)) afterRenameByTitle.set(t, []);
  afterRenameByTitle.get(t).push(s);
}

for (const [newTitle, group] of afterRenameByTitle.entries()) {
  if (group.length <= 1) continue;
  // Still dupes — append a "Take N" counter
  group.sort((a, b) => a.created < b.created ? -1 : 1);
  for (let i = 0; i < group.length; i++) {
    const s = group[i];
    const prev = renameMap.get(s.id) || s.title;
    const final = `${prev} (Take ${i + 1})`;
    if (final !== s.title) renames.push({ id: s.id, oldTitle: s.title, newTitle: final });
    renameMap.set(s.id, final);
  }
}

// Collapse: final rename per id = last one wins
const finalRenames = [...renameMap.entries()]
  .filter(([id, newTitle]) => {
    const s = liveAfterDedupe.find(x => x.id === id);
    return s && s.title !== newTitle;
  })
  .map(([id, newTitle]) => ({ id, newTitle, oldTitle: liveAfterDedupe.find(x => x.id === id).title }));

console.log(`\n=== DISAMBIGUATE: ${finalRenames.length} titles to rename ===`);
console.log('Sample (first 10):');
for (const r of finalRenames.slice(0, 10)) {
  console.log(`  [${r.oldTitle}]`);
  console.log(`  -> ${r.newTitle}`);
}

if (DRY_RUN) { console.log('\n--dry specified. No writes.'); process.exit(0); }

// ── 5. Apply ────────────────────────────────────────────────────────
const sql = ['BEGIN;'];

// Merge listens/downloads into the keeper BEFORE soft-deleting the dupes
for (const m of listensMerge) {
  sql.push(`UPDATE public.sounds SET listens = listens + ${m.n} WHERE id = '${m.keeperId}';`);
}
for (const m of downloadsMerge) {
  sql.push(`UPDATE public.sounds SET downloads = downloads + ${m.n} WHERE id = '${m.keeperId}';`);
}

// Soft delete the duplicate rows
for (const d of softDeletes) {
  sql.push(`UPDATE public.sounds SET deleted_at = now() WHERE id = '${d.id}';`);
}

// Rename for disambiguation
for (const r of finalRenames) {
  const t = r.newTitle.replace(/'/g, "''");
  sql.push(`UPDATE public.sounds SET title = '${t}' WHERE id = '${r.id}';`);
}

sql.push('COMMIT;');
psqlFile(sql.join('\n'));

console.log(`\nDone:`);
console.log(`  Soft-deleted: ${softDeletes.length} duplicate rows`);
console.log(`  Renamed:      ${finalRenames.length} for disambiguation`);
console.log(`  Merged counters: +${listensMerge.reduce((s,m)=>s+m.n,0)} listens, +${downloadsMerge.reduce((s,m)=>s+m.n,0)} downloads into keepers`);

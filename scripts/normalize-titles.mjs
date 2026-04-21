// Normalize sound titles for consistency and readability.
//
// Transformations:
//   1. Split compressed words the DAW/filename normalizer glued together:
//        Openingclosing -> Opening Closing
//        Onoff          -> On Off
//        Ontaking       -> On Taking   (in "Putting On Taking Off")
//        Offputting     -> Off Putting (in "Taking Off Putting On")
//        Outin/Inout    -> Out In / In Out
//        Lockingunlocking -> Locking Unlocking
//        Openingslamming  -> Opening Slamming
//        Tighteninguntightening -> Tightening Untightening
//        Lightheavy     -> Light Heavy
//   2. Insert space between a letter and a digit:
//        "Plaps29" -> "Plaps 29", "Stereo2" -> "Stereo 2"
//   3. Tidy the "Footsteps Boot Running ..." family to match the existing
//      "Running/Walking Footsteps In Boots ..." format.
//   4. Fix up weird punctuation spacing:
//        "Gravel(Light+Heavy)+Grass" -> "Gravel (Light+Heavy) + Grass"
//   5. Collapse double spaces, trim.
//
// Usage:
//   node scripts/normalize-titles.mjs --dry
//   node scripts/normalize-titles.mjs

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

// Whole-word (case-insensitive) replacements - preserve the trailing
// tokens' capitalisation by rebuilding with Title Case.
const COMPOUND_SPLITS = [
  // Composed -> split words (must be whole-word match, case-insensitive)
  [/\bOpeningclosing\b/gi,          'Opening Closing'],
  [/\bOpeningslamming\b/gi,         'Opening Slamming'],
  [/\bLockingunlocking\b/gi,        'Locking Unlocking'],
  [/\bTighteninguntightening\b/gi,  'Tightening Untightening'],
  [/\bOntaking\b/gi,                'On Taking'],
  [/\bOffputting\b/gi,              'Off Putting'],
  [/\bOnoff\b/gi,                   'On Off'],
  [/\bOffon\b/gi,                   'Off On'],
  [/\bOutin\b/gi,                   'Out In'],
  [/\bInout\b/gi,                   'In Out'],
  [/\bUpdown\b/gi,                  'Up Down'],
  [/\bDownup\b/gi,                  'Down Up'],
  [/\bLightheavy\b/gi,              'Light Heavy'],
];

// "Footsteps Boot Running / Footsteps Boots" -> "Running Footsteps In Boots"
function fixFootstepsPrefix(t) {
  t = t.replace(
    /^Footsteps Boot Running Gravel\(Light\+Heavy\)\+(\w+)/i,
    'Running Footsteps In Boots - Gravel (Light+Heavy) + $1'
  );
  t = t.replace(
    /^Footsteps Boots Gravel\(Light\+Heavy\)\+(\w+)/i,
    'Walking Footsteps In Boots - Gravel (Light+Heavy) + $1'
  );
  t = t.replace(
    /^Footsteps Boots Gravel\(Light\+Heavy\) (\d)/i,
    'Walking Footsteps In Boots - Gravel (Light+Heavy) $1'
  );
  return t;
}

// Insert a space between a letter and an adjacent digit ONLY when the
// letter is lowercase. That way "Plaps29" -> "Plaps 29" but "MKH416",
// "ZoomH8", and "ZoomF3" (uppercase letters before the digits as part
// of a product name) stay intact.
function spaceLetterDigit(t) {
  return t.replace(/([a-z])(\d)/g, '$1 $2');
}

// Undo previous bad splits that produced "ZoomH 8" / "ZoomF 3".
function fixMicNames(t) {
  return t
    .replace(/\bZoomH\s+8\b/g, 'ZoomH8')
    .replace(/\bZoomF\s+3\b/g, 'ZoomF3')
    .replace(/\bMKH\s+416\b/gi, 'MKH416');
}

// Tidy punctuation spacing:
//   "Gravel(Light+Heavy)+Grass" -> "Gravel (Light+Heavy) + Grass"
//   "Down+Up"                   -> "Down + Up"
// "+" inside parens (e.g. "(Light+Heavy)") stays tight.
function tidyPunctuation(t) {
  // space before "("
  t = t.replace(/(\S)\(/g, '$1 (');
  // space after ")"
  t = t.replace(/\)(\S)/g, ') $1');
  // space around "+"  (but skip number literals AND inside parens)
  t = t.replace(/(\S)\+(\S)/g, (m, a, b, offset) => {
    if (/\d/.test(a) && /\d/.test(b)) return m;
    // Don't add spaces if we're inside parentheses.
    const before = t.substring(0, offset);
    const openP = (before.match(/\(/g) || []).length;
    const closeP = (before.match(/\)/g) || []).length;
    if (openP > closeP) return m;
    return `${a} + ${b}`;
  });
  return t;
}

// Collapse duplicate spaces and trim.
function squashSpaces(t) {
  return t.replace(/\s+/g, ' ').trim();
}

function titleCaseWord(w) {
  if (!w) return w;
  // Preserve all-caps acronyms and mixed-case like MKH416 / ZoomH8
  if (/^[A-Z]{2,}\d*$/.test(w)) return w;
  if (/^[A-Z][a-z]+[A-Z]/.test(w)) return w;   // e.g. ZoomH8
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

// Title-case the words that aren't already stylistically capitalized.
// We only touch words that are ALL LOWERCASE - that's the common bug from
// earlier pipelines that accidentally lowercased parts of the string.
function restoreTitleCase(t) {
  return t.replace(/\b[a-z][a-z']+\b/g, (w) => {
    // Skip common English joining words when mid-title
    const small = new Set(['a','an','and','of','or','the','in','on','at','to','for','with','from','by']);
    if (small.has(w.toLowerCase())) return w.toLowerCase();
    return w[0].toUpperCase() + w.slice(1);
  });
}

// Canonicalise the old "Walking Footsteps In Boots Gravel Lightheavy Grass N"
// format to match the more recent "Walking Footsteps In Boots - Gravel
// (Light+Heavy) + Grass N" style.
function canonicaliseFootsteps(t) {
  const re = /^(Walking|Running) Footsteps In Boots Gravel (?:Lightheavy|Light Heavy) (\w+) (\d+)$/i;
  const m = re.exec(t);
  if (m) return `${m[1]} Footsteps In Boots - Gravel (Light+Heavy) + ${m[2]} ${m[3]}`;
  // Without trailing extra-surface + digit
  const re2 = /^(Walking|Running) Footsteps In Boots Gravel (?:Lightheavy|Light Heavy) (\d+)$/i;
  const m2 = re2.exec(t);
  if (m2) return `${m2[1]} Footsteps In Boots - Gravel (Light+Heavy) ${m2[2]}`;
  return t;
}

function normalizeTitle(raw) {
  let t = raw;

  // Pre-fix known filename-derived prefixes BEFORE compound splits,
  // because they contain patterns the other rules would otherwise mangle.
  t = fixFootstepsPrefix(t);

  for (const [re, rep] of COMPOUND_SPLITS) t = t.replace(re, rep);

  t = spaceLetterDigit(t);
  t = fixMicNames(t);
  t = tidyPunctuation(t);
  t = squashSpaces(t);

  // Re-title-case lowercased fragments.
  t = restoreTitleCase(t);

  // Unify the old "Gravel Lightheavy" form with the canonical dashed one.
  // Must run AFTER compound splits (so "Lightheavy" has already become
  // "Light Heavy") and AFTER title-casing.
  t = canonicaliseFootsteps(t);

  return squashSpaces(t);
}

// ── Run ───────────────────────────────────────────────────────────────
const raw = psql(`SELECT id, title FROM sounds WHERE deleted_at IS NULL;`);
const rows = raw.trim().split('\n').filter(Boolean).map(l => {
  const [id, title] = l.split('\t');
  return { id, title };
});

const updates = [];
for (const r of rows) {
  const cleaned = normalizeTitle(r.title);
  if (cleaned !== r.title) updates.push({ id: r.id, oldTitle: r.title, newTitle: cleaned });
}

console.log(`${updates.length} titles need normalizing (out of ${rows.length}).`);
console.log('\n--- Sample diffs (first 25) ---');
for (const u of updates.slice(0, 25)) {
  console.log(`  [${u.oldTitle}]`);
  console.log(`  -> ${u.newTitle}\n`);
}

if (DRY_RUN) { console.log('--dry specified. No writes.'); process.exit(0); }

// Detect collisions that the rename would introduce (unique constraint
// on title is not set, but we shouldn't reintroduce the dupe problem).
const titleSet = new Map();  // new title -> list of ids
for (const r of rows) {
  const t = updates.find(u => u.id === r.id)?.newTitle || r.title;
  if (!titleSet.has(t)) titleSet.set(t, []);
  titleSet.get(t).push(r.id);
}
const newCollisions = [...titleSet.values()].filter(arr => arr.length > 1);
if (newCollisions.length) {
  console.log(`\nWARNING: ${newCollisions.length} new title collisions would be introduced.`);
  console.log('First 5:');
  for (const ids of newCollisions.slice(0, 5)) {
    const t = titleSet.entries().find(([, v]) => v === ids)[0];
    console.log(`  "${t}" - ${ids.length} rows`);
  }
  console.log('(they will be resolved by re-running dedupe-and-disambiguate.mjs)');
}

const sql = ['BEGIN;'];
for (const u of updates) {
  const t = u.newTitle.replace(/'/g, "''");
  sql.push(`UPDATE public.sounds SET title = '${t}' WHERE id = '${u.id}';`);
}
sql.push('COMMIT;');

psqlFile(sql.join('\n'));
console.log(`\nDone: ${updates.length} titles normalized.`);

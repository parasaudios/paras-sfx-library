// Enrich every sound's tags based on keyword hits in title + category + mic.
//
// Usage:
//   node scripts/enrich-tags.mjs --dry       # preview only
//   node scripts/enrich-tags.mjs             # apply (backup first!)
//
// Avoids adding a pg dep - talks to the DB via `docker exec psql`.

import { execFileSync, spawnSync } from 'node:child_process';

const DRY_RUN = process.argv.includes('--dry');
const DB = 'supabase_db_Para_SFX_Library';

// ── Keyword -> tags mapping ──────────────────────────────────────────
const KEYWORD_TAGS = {
  // SEX / NSFW
  plap: ['Plap','Plaps','Thrust','Sex','Messy','Wet','NSFW','18+'],
  plaps: ['Plap','Plaps','Thrust','Sex','Messy','Wet','NSFW','18+'],
  thrust: ['Thrust','Thrusts','Sex','Bed','NSFW','18+'],
  thrusts: ['Thrust','Thrusts','Sex','Bed','NSFW','18+'],
  thrusting: ['Thrust','Thrusts','Sex','Bed','NSFW','18+'],
  cock: ['Cock','Dick','Sex','NSFW','18+'],
  slap: ['Slap','Slaps','Impact','NSFW','18+'],
  slaps: ['Slap','Slaps','Impact','NSFW','18+'],
  spank: ['Spank','Spanks','Impact','NSFW','18+'],
  spanks: ['Spank','Spanks','Impact','NSFW','18+'],
  spanking: ['Spank','Spanks','Impact','NSFW','18+'],
  booty: ['Booty','Ass','NSFW','18+'],
  sloppy: ['Sloppy','Messy','Wet','NSFW','18+'],
  wet: ['Wet','Moist','Liquid'],
  meaty: ['Meaty','Impact','NSFW','18+'],
  goddess: ['Goddess','Female'],

  // BED
  bed: ['Bed','Bedroom','Furniture'],
  bedroom: ['Bed','Bedroom'],

  // FOOTSTEPS
  walking: ['Walking','Walk','Footsteps','Steps','Feet','Movement'],
  walk: ['Walking','Walk','Footsteps','Steps','Feet','Movement'],
  running: ['Running','Run','Footsteps','Steps','Feet','Movement','Fast'],
  run: ['Running','Run','Footsteps','Steps','Feet','Movement','Fast'],
  footstep: ['Footsteps','Steps','Feet','Walking'],
  footsteps: ['Footsteps','Steps','Feet','Walking'],
  boots: ['Boots','Shoes','Footwear'],
  boot: ['Boots','Shoes','Footwear'],
  slipper: ['Slippers','Shoes','Footwear','Soft'],
  slippers: ['Slippers','Shoes','Footwear','Soft'],
  gravel: ['Gravel','Outdoor','Path','Rocks'],
  grass: ['Grass','Outdoor','Nature'],
  forest: ['Forest','Outdoor','Nature','Woods'],
  tiles: ['Tiles','Tile','Floor','Indoor'],
  tile: ['Tiles','Tile','Floor','Indoor'],
  lightheavy: ['Light','Heavy','Variations'],

  // CLOTHING
  zipper: ['Zipper','Zip','Clothing','Fabric'],
  zip: ['Zipper','Zip','Clothing','Fabric'],
  jacket: ['Jacket','Clothing','Fabric','Outerwear'],
  pants: ['Pants','Clothing','Fabric','Bottoms'],
  jeans: ['Jeans','Pants','Clothing','Denim'],
  cargo: ['Cargo','Pants','Clothing'],
  sweat: ['Sweatpants','Sweats','Clothing'],
  belt: ['Belt','Accessory','Clothing'],
  clothing: ['Clothing','Fabric'],
  clothes: ['Clothing','Fabric'],
  ripping: ['Rip','Ripping','Tear','Fabric'],

  // DOORS + LOCKS
  door: ['Door','Wood','Entry'],
  doors: ['Door','Doors','Wood','Entry'],
  hollowcore: ['Hollowcore','Door','Wood'],
  knocking: ['Knocking','Knock','Door','Impact'],
  knock: ['Knocking','Knock','Door','Impact'],
  banging: ['Banging','Bang','Impact'],
  locking: ['Locking','Lock','Security'],
  unlocking: ['Unlocking','Unlock','Key','Security'],
  deadlock: ['Deadlock','Lock','Security'],
  slamming: ['Slam','Slamming','Door','Impact'],
  squeaky: ['Squeaky','Squeak','Creak'],
  opening: ['Opening','Open'],
  closing: ['Closing','Close'],

  // KITCHEN
  kitchen: ['Kitchen','Domestic','Cooking'],
  knife: ['Knife','Knives','Kitchen','Cutting','Sharp','Blade'],
  knives: ['Knife','Knives','Kitchen','Cutting','Sharp','Blade'],
  sharpening: ['Sharpening','Sharp','Knife','Blade'],
  sharpness: ['Sharpness','Sharp','Knife','Test'],
  chopping: ['Chopping','Cutting','Kitchen','Food'],
  cooking: ['Cooking','Kitchen','Food'],
  pan: ['Pan','Kitchen','Cookware'],
  oven: ['Oven','Kitchen','Appliance','Cooking'],
  fridge: ['Fridge','Refrigerator','Kitchen','Appliance'],
  drawer: ['Drawer','Drawers','Kitchen','Furniture'],
  drawers: ['Drawer','Drawers','Kitchen','Furniture'],
  cupboard: ['Cupboard','Cupboards','Kitchen','Storage'],
  cupboards: ['Cupboard','Cupboards','Kitchen','Storage'],
  rummage: ['Rummage','Searching','Movement'],
  extractor: ['Extractor','Fan','Kitchen'],
  pepper: ['Pepper','Grinder','Kitchen','Seasoning'],
  salt: ['Salt','Grinder','Kitchen','Seasoning'],
  grinder: ['Grinder','Grinding','Kitchen'],
  grinding: ['Grinder','Grinding','Kitchen'],
  cutlery: ['Cutlery','Kitchen','Utensils'],
  plates: ['Plates','Kitchen','Dishes'],
  glass: ['Glass','Kitchen','Breakable'],
  bowl: ['Bowl','Kitchen','Dishes'],
  juice: ['Juice','Drink','Liquid'],
  bottle: ['Bottle','Container'],
  canola: ['Canola','Spray','Cooking'],
  spray: ['Spray','Aerosol'],
  scraping: ['Scraping','Scrape'],

  // APPLIANCES / ELECTRONICS
  fan: ['Fan','Appliance'],
  kettle: ['Kettle','Kitchen','Appliance'],
  electric: ['Electric','Electronic'],
  keyboard: ['Keyboard','Typing','Computer'],
  typing: ['Typing','Keyboard','Computer'],
  phone: ['Phone','Mobile','Technology'],
  samsung: ['Samsung','Phone','Technology'],
  ringtone: ['Ringtone','Phone','Notification','Ring'],
  ringing: ['Ringing','Ring','Phone','Notification'],
  text: ['Text','SMS','Phone','Notification'],
  texting: ['Text','SMS','Phone','Notification'],
  voicemail: ['Voicemail','Phone','Notification'],
  vibrate: ['Vibrate','Vibration','Phone'],
  vibrating: ['Vibrate','Vibration','Phone'],
  clicker: ['Clicker','Click','Training'],
  clickity: ['Click','Clicking','Clicker'],
  clack: ['Clack','Click','Sharp'],
  click: ['Click','Clicking'],

  // VEHICLE
  car: ['Car','Vehicle','Automobile'],
  vehicle: ['Vehicle','Car','Automobile'],
  gear: ['Gear','Car','Mechanical'],
  handbrake: ['Handbrake','Car','Mechanical'],
  handbreak: ['Handbrake','Car','Mechanical'],
  seatbelt: ['Seatbelt','Car','Safety'],
  indicator: ['Indicator','Blinker','Car'],
  window: ['Window','Glass'],
  winding: ['Winding','Window','Handle'],

  // AMBIENCE
  ambience: ['Ambient','Ambience','Background','Atmosphere'],
  ambient: ['Ambient','Ambience','Background'],
  rain: ['Rain','Weather','Water','Nature'],
  heavy: ['Heavy'],
  light: ['Light'],
  storm: ['Storm','Weather','Nature'],
  daytime: ['Daytime','Day','Ambient'],
  night: ['Night','Nighttime','Ambient','Dark'],
  nighttime: ['Night','Nighttime','Ambient','Dark'],

  // ROPE / TOOLS
  rope: ['Rope','Tool'],
  hemp: ['Hemp','Rope','Natural'],
  tightening: ['Tightening','Tighten','Rope'],
  untightening: ['Untightening','Untighten','Rope'],
  firm: ['Firm','Tight'],
  ties: ['Ties','Rope','Binding'],

  // FURNITURE
  chair: ['Chair','Furniture','Seating'],
  wall: ['Wall','Surface'],

  // ACTIONS
  washing: ['Washing','Water','Cleaning'],
  hands: ['Hands','Body'],
  adjusting: ['Adjusting','Movement'],
  pouring: ['Pouring','Liquid'],
  dropping: ['Dropping','Drop','Impact'],
  pulling: ['Pulling','Pull'],
  putting: ['Putting'],
  taking: ['Taking'],
  getting: ['Getting'],
  filling: ['Filling','Fill'],
  shower: ['Shower','Bathroom','Water'],
  throw: ['Throw','Throwing'],

  // SOUNDS TYPE
  snap: ['Snap','Finger','Quick'],
  snaps: ['Snap','Snaps','Finger'],
  finger: ['Finger','Hand'],
  creak: ['Creak','Squeak'],

  // FLUIDS
  soda: ['Soda','Drink','Liquid'],
  water: ['Water','Liquid'],

  // MODIFIERS
  sequence: ['Sequence'],
  normal: ['Normal'],
  firmly: ['Firm','Hard'],
  softly: ['Soft','Quiet'],
  softer: ['Soft','Quiet'],
  soft: ['Soft'],
  hard: ['Hard'],

  // MIC passthroughs
  mkh416: ['MKH416','Sennheiser'],
  zoomh8: ['ZoomH8','Zoom'],
  zoomf3: ['ZoomF3','Zoom'],
  rode: ['Rode'],

  // BATHROOM
  toilet:    ['Toilet','Bathroom','Water'],
  flush:     ['Flush','Toilet','Bathroom','Water'],

  // MORE KITCHEN
  dishwasher:['Dishwasher','Kitchen','Appliance','Water'],
  stove:     ['Stove','Kitchen','Appliance','Cooking'],
  plate:     ['Plates','Kitchen','Dishes'],
  dishes:    ['Dishes','Kitchen'],
  cup:       ['Cup','Drink','Kitchen'],
  tipping:   ['Tipping','Pouring','Liquid'],
  sink:      ['Sink','Kitchen','Water'],
  fruits:    ['Fruit','Food'],
  fruit:     ['Fruit','Food'],
  watermelon:['Watermelon','Fruit','Food'],
  watermelons:['Watermelon','Fruit','Food'],
  berry:     ['Berry','Fruit','Food'],
  eating:    ['Eating','Food','Mouth','Chewing'],
  bite:      ['Bite','Eating','Food'],
  crunch:    ['Crunch','Eating','Food'],

  // BODY / MISC
  fart:      ['Fart','Funny','Body','NSFW'],
  spit:      ['Spit','Body','Liquid'],
  puffer:    ['Puffer','Air'],
  scuffing:  ['Scuffing','Shoes','Footwear','Movement'],
  shoes:     ['Shoes','Footwear'],

  // KEYS
  key:       ['Key','Keys','Unlock'],
  keys:      ['Key','Keys','Unlock'],
  handling:  ['Handling','Movement'],

  // OUTDOORS / NATURE
  seaside:   ['Seaside','Ocean','Water','Beach','Nature','Ambient'],
  waves:     ['Waves','Ocean','Water','Nature'],
  ocean:     ['Ocean','Water','Sea','Nature'],
  beach:     ['Beach','Ocean','Nature'],
  driving:   ['Driving','Car','Vehicle'],

  // MEMES / POP
  meme:      ['Meme','Funny','Pop Culture'],
  theme:     ['Theme','Music'],
  tune:      ['Tune','Music'],
  jeopardy:  ['Jeopardy','Meme','TV','Music'],
  daddy:     ['Meme','Funny'],
  chill:     ['Meme','Funny'],
  noot:      ['Meme','Funny'],
  yamete:    ['Meme','Funny','Anime'],
  kudasai:   ['Meme','Funny','Anime'],
  gotchu:    ['Meme','Funny'],
  pleasure:  ['Pleasure','NSFW','18+'],
  collab:    ['Collaboration'],
  mixdown:   ['Mixdown','Mix','Audio'],
  prescription:['Prescription'],

  // GENERIC
  samples:   ['Samples'],
  library:   ['Library'],
};

const JUNK_TAGS = new Set([
  'sfx','wav','mp3','sfx_wav','sfx_mp3','old','raw','para',
  '48khz','96khz','24bit','32bit','32bit96khz','48khz24bit','96khz32bit',
  'bit','khz',
]);

const tokenize = (s) => !s ? [] : (s.toLowerCase().match(/[a-z]+/g) || []);
const tagKey   = (t) => t.toLowerCase().trim();

function generateTagsFor(sound) {
  const corpus = [sound.title, sound.category, sound.microphone, sound.recorder, sound.filename]
    .filter(Boolean).join(' ');
  const words = new Set(tokenize(corpus));
  const out = new Map();

  for (const existing of (sound.tags || [])) {
    if (!existing) continue;
    const k = tagKey(existing);
    if (JUNK_TAGS.has(k)) continue;
    if (/^\d+$/.test(k)) continue;
    out.set(k, existing);
  }
  for (const w of words) {
    // Try exact match, then strip trailing 's' / 'es' as a plural fallback
    let tags = KEYWORD_TAGS[w];
    if (!tags && w.endsWith('es') && w.length > 3) tags = KEYWORD_TAGS[w.slice(0, -2)];
    if (!tags && w.endsWith('s')  && w.length > 2) tags = KEYWORD_TAGS[w.slice(0, -1)];
    if (!tags) continue;
    for (const t of tags) {
      const k = tagKey(t);
      if (JUNK_TAGS.has(k)) continue;
      if (!out.has(k)) out.set(k, t);
    }
  }
  return Array.from(out.values()).sort((a,b) => a.localeCompare(b));
}

// ── Helpers to talk to psql ──────────────────────────────────────────
function psql(sql) {
  return execFileSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-t', '-A', '-F', '\t'],
    { input: sql, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });
}

function psqlFile(sql) {
  const r = spawnSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error('psql failed:', r.stderr);
    process.exit(1);
  }
  return r.stdout;
}

// Postgres array literal: {"tag one","tag two"} - needs escaping of " and \
function pgArrayLit(tags) {
  const esc = (t) => '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  return '{' + tags.map(esc).join(',') + '}';
}

// ── Load sounds ───────────────────────────────────────────────────────
console.log('Loading sounds from DB...');
const raw = psql(`
  SELECT id, title, coalesce(array_to_string(tags, '|'), ''),
         coalesce(category,''), coalesce(microphone,''),
         coalesce(recorder,''), coalesce(filename,'')
  FROM sounds WHERE deleted_at IS NULL;
`);
const sounds = raw.trim().split('\n').filter(Boolean).map(line => {
  const [id, title, tagStr, category, microphone, recorder, filename] = line.split('\t');
  return {
    id, title,
    tags: tagStr ? tagStr.split('|') : [],
    category, microphone, recorder, filename,
  };
});
console.log(`Loaded ${sounds.length} sounds.`);

// ── Generate new tag sets ────────────────────────────────────────────
let changedRows = 0, unchanged = 0;
const updates = [];
for (const s of sounds) {
  const newTags = generateTagsFor(s);
  const oldKey = (s.tags || []).map(tagKey).sort().join('|');
  const newKey = newTags.map(tagKey).sort().join('|');
  if (oldKey === newKey) { unchanged++; continue; }
  updates.push({ id: s.id, title: s.title, oldTags: s.tags, newTags });
  changedRows++;
}

console.log(`\n${changedRows} sounds need updates (${unchanged} unchanged).`);
console.log('\n--- Sample diffs ---');
for (const u of updates.slice(0, 10)) {
  console.log(`  [${u.title}]`);
  console.log(`    - ${JSON.stringify(u.oldTags)}`);
  console.log(`    + ${JSON.stringify(u.newTags)}`);
}

if (DRY_RUN) {
  console.log('\n--dry specified - not writing.');
  process.exit(0);
}

// ── Build and run bulk UPDATE in a single transaction ────────────────
console.log(`\nApplying ${updates.length} updates...`);

const chunks = [];
chunks.push('BEGIN;');
for (const u of updates) {
  const arr = pgArrayLit(u.newTags).replace(/'/g, "''");
  chunks.push(`UPDATE public.sounds SET tags = '${arr}'::text[] WHERE id = '${u.id}';`);
}
// Refresh the global tags vocabulary
chunks.push(`
  DELETE FROM public.tags;
  INSERT INTO public.tags (name)
  SELECT DISTINCT tag FROM (
    SELECT unnest(tags) AS tag FROM public.sounds WHERE deleted_at IS NULL
  ) t
  WHERE tag IS NOT NULL AND tag <> ''
  ON CONFLICT (name) DO NOTHING;
`);
chunks.push('COMMIT;');

psqlFile(chunks.join('\n'));
console.log(`Done - ${updates.length} sounds retagged. Global tags table refreshed.`);

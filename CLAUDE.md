# Para's SFX Library

## Project Overview

A React + Vite sound effects library backed by self-hosted Supabase. Public users can search, browse by tag, play, and download (single or bulk) sound effects. Admins manage sounds, tags, and suggestions through a logged-in dashboard.

**Live**: deployed to GitHub → Vercel + Cloudflare Pages. API is at `https://sfxlib-api.parasfx.com` (Cloudflare Tunnel → local Docker stack).

**Current scale** (April 2026): **1,347 active sounds** (1,584 rows with soft-deletes), **407 unique tags**, ~2.3 GB of audio storage.

---

## Architecture

### Frontend
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS + Radix UI primitives + shadcn/ui components
- **Theme:** dark + emerald (`bg-[#0d1017]` background, `bg-[#10b981]` accents). Public and admin views share the same palette.
- **Entry point:** `src/App.tsx`
- **Key dep additions:** `jszip` (bulk-download zipping), `framer-motion` (transitions), `sonner` (toast notifications)
- **Dev server:** `npm run dev` (port 3000)
- **Build:** `npm run build` → `build/` directory

### Backend — Self-Hosted Supabase
- **Hosting:** Self-hosted via Docker Compose (`docker/docker-compose.yml`) on a Windows machine
- **Single API gateway:** All Supabase calls flow through `src/utils/api.tsx`. No other file imports `@supabase/supabase-js` directly.
- **Auth:** Supabase Auth (email + password). Admin login accepts either email OR username `Para` (mapped to `admin@parasfx.com` client-side in `Login.tsx`).
- **Public API URL:** `https://sfxlib-api.parasfx.com` → Cloudflare Tunnel → `tunnel-proxy.mjs` (port 54350) → Kong (port 54341)
- **Frontend env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (in `.env.local`, also configured in Vercel + Cloudflare Pages)

### Hosting Topology
```
Browser (parasfx.com)
   ↓
Vercel / Cloudflare Pages (static React bundle)
   ↓ HTTPS API calls
Cloudflare Tunnel (sfxlib-api.parasfx.com)
   ↓
cloudflared (Windows service, auto-starts at boot)
   ↓ http://localhost:54350
tunnel-proxy.mjs (Node script — blocks service_role JWTs + admin paths)
   ↓ http://127.0.0.1:54341
Kong (Docker container)
   ↓
PostgREST / Auth / Storage (Docker containers, all bound to 127.0.0.1)
```

---

## Self-Hosted Infrastructure

### Security architecture (defence in depth)

1. **Custom JWT secret** — A unique 64-char HS256 secret replaces the Supabase demo key. Stored in `docker/.env` (git-ignored). Demo/leaked default keys are cryptographically invalid.
2. **Tunnel proxy** (`scripts/tunnel-proxy.mjs`) — Node reverse proxy on port 54350. Blocks:
   - Any request carrying a `service_role` JWT (detected via base64url fragment matching in headers + query params)
   - Admin-only paths (`/auth/v1/admin`, `/pg/`)
   - Logs to `tunnel-proxy.log`
3. **Localhost-only port binding** — Every Docker port binds to `127.0.0.1`, never `0.0.0.0`. Even if the firewall is misconfigured, LAN can't reach DB ports.
4. **Windows Firewall rules** (`scripts/lock-db-ports.bat`) — Block external network access to ports 54340-54349 while preserving localhost access. Defence-in-depth second layer.
5. **Cloudflare Tunnel** — Public API access routes through the tunnel proxy only.
6. **RLS + SECURITY DEFINER + locked search_path** — All admin mutations go through Postgres functions with `SECURITY DEFINER` AND `SET search_path = public` (verified via migration `20260423000000_lock_search_path_on_definer_funcs.sql`). 13/13 SECURITY DEFINER functions in `public` are locked.
7. **Auth hardening** — Signup disabled (admins only), strong password policy enforced.
8. **Frontend env-var only** — `src/utils/supabase/info.tsx` throws if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing. No hardcoded fallbacks (would otherwise leak through git).

### Docker Compose stack (12 services)

Managed via `docker/docker-compose.yml` with secrets in `docker/.env` (NEVER commit):

| Service | Container | Port | Purpose |
|---|---|---|---|
| db | `supabase_db_Para_SFX_Library` | 54342 | Postgres 17 — main data store |
| kong | `supabase_kong_Para_SFX_Library` | 54341 | API gateway |
| auth/gotrue | `supabase_auth_Para_SFX_Library` | (internal) | Authentication service |
| rest/postgrest | `supabase_rest_Para_SFX_Library` | (internal) | REST API, JWKS JWT validation |
| storage | `supabase_storage_Para_SFX_Library` | (internal) | File storage API. Volume: `supabase_storage_Para_SFX_Library` |
| realtime | `supabase_realtime_Para_SFX_Library` | (internal) | WebSocket subscriptions |
| studio | `supabase_studio_Para_SFX_Library` | 54343 | Admin dashboard UI |
| analytics/logflare | `supabase_analytics_Para_SFX_Library` | 54345 | Log aggregation |
| edge-runtime | `supabase_edge_runtime_Para_SFX_Library` | (internal) | Deno edge functions |
| inbucket/mailpit | `supabase_inbucket_Para_SFX_Library` | 54344 | Dev email |
| imgproxy | `supabase_imgproxy_Para_SFX_Library` | (internal) | Image transformation |
| pg-meta | `supabase_pg_meta_Para_SFX_Library` | (internal) | DB metadata API |

### Startup procedure (manual, only after fresh boot if auto-start hasn't run)

```bash
cd docker && docker compose up -d                      # Start all services
node scripts/tunnel-proxy.mjs                          # Start security proxy (port 54350)
cloudflared tunnel run parasmut-supabase               # Start Cloudflare Tunnel (or use service)
scripts\lock-db-ports.bat                              # Run as Admin — firewall DB ports
```

### Auto-start at boot (one-time setup)

The site needs three things running for `parasfx.com` to work:

1. **Docker Desktop** — auto-starts with Windows by default
2. **`cloudflared`** — runs as a Windows Service (one-time install):
   ```cmd
   REM Right-click → "Run as administrator"
   scripts\install-cloudflared-service.bat
   ```
   Survives reboots + logoffs because Windows SCM auto-restarts. Verify with `sc query cloudflared`.

3. **Tunnel proxy** — supervised script in the user's Startup folder:
   ```powershell
   # Run once after cloning the repo (no admin needed)
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1
   ```
   Drops a `.vbs` launcher into `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\` pointing at `scripts\run-tunnel-proxy-supervised.ps1`. The supervisor relaunches the proxy within 5s if it crashes.

   Logs:
   - `tunnel-proxy.log` — proxy events (request/block/response)
   - `tunnel-proxy-supervisor.log` — supervisor restart events

   Uninstall: delete `ParaSFX-TunnelProxy.vbs` from the Startup folder.

### CRITICAL: Backup before any Docker changes

**NEVER restart, recreate, or modify Docker containers/volumes without first running a full backup.** This rule exists because we lost the entire storage volume once during a docker-compose change.

```powershell
.\backup-supabase.ps1   # Backs up BOTH database AND storage volume
```

Creates:
- `backups/supabase_backup_<timestamp>.sql` — full Postgres dump
- `backups/storage/storage_backup_<timestamp>.tar.gz` — every audio file from the storage volume

Restore storage from backup:
```powershell
docker run --rm -v supabase_storage_Para_SFX_Library:/target -v "${PWD}\backups\storage:/backup" alpine tar xzf /backup/storage_backup_<timestamp>.tar.gz -C /target
```

### Best practices checklist

- [ ] `docker/.env` is in `.gitignore` and NEVER committed
- [ ] JWT_SECRET is unique (not the Supabase default)
- [ ] All Docker ports bind to `127.0.0.1`
- [ ] Tunnel proxy auto-starts at logon (supervisor script registered)
- [ ] cloudflared runs as a Windows Service (not a logon shortcut)
- [ ] Windows Firewall rules applied (ports 54340-54349)
- [ ] All `SECURITY DEFINER` functions have `SET search_path = public`
- [ ] Signup disabled, strong password policy enforced
- [ ] **ALWAYS run `backup-supabase.ps1` before any Docker changes**
- [ ] Daily backup scheduled (Windows Task Scheduler runs `backup-supabase.ps1`)

---

## Database Schema

### Active tables

| Table | Purpose |
|---|---|
| `sounds` | All sound metadata (title, tags[], mp3_path, wav_path, microphone, durations, sample rates, etc.) |
| `sounds_with_urls` | **View** over `sounds` exposing `audioUrl` and `downloadUrl` (pre-built storage paths). Public SELECT only. |
| `suggestions` | User-submitted sound suggestions (sound_name, category, description, status) |
| `tags` | Global tag vocabulary (name) — kept in sync by `enrich-tags.mjs` |

### Key columns — `sounds`

- `id` (uuid PK), `title`, `filename` (NOT NULL), `slug`
- `tags` (text[] — stored as Postgres array, NOT a join table)
- `description`
- `mp3_path`, `wav_path`, `has_wav` — bare filenames (no path prefix)
- `file_size`, `duration_seconds`, `channels`
- `microphone`, `recorder`, `format`, `category`
- `mp3_sample_rate`, `mp3_bit_depth`, `wav_sample_rate`, `wav_bit_depth`
- `nsfw` (boolean), `listens` (int), `downloads` (int)
- `source` (e.g. 'kv_migration', 'storage_scan', 'drive_import_2026_04')
- `search_vector` (tsvector — title=A, description=B, tags=C, category=D, GIN-indexed)
- `created_at`, `updated_at`, `deleted_at` (NULL = active)

### `sounds_with_urls` view

- Same columns as `sounds` PLUS:
  - `audioUrl` — `'/storage/v1/object/public/sounds/' || mp3_path`, falls back to `wav_path` if no mp3 (so wav-only sounds remain playable)
  - `downloadUrl` — prefers wav, falls back to mp3
- `WHERE deleted_at IS NULL` baked in
- `security_invoker = on` so RLS is checked as the caller, not the view owner
- Public SELECT granted to `anon, authenticated`

### Key columns — `suggestions`

- `id` (uuid PK), `sound_name`, `description`, `category`, `status` ('pending'/'reviewed')
- Frontend maps in `api.tsx`: `sound_name` → `soundName`, `created_at` → `submittedAt`, `status !== 'pending'` → `isRead`
- **`updateSuggestion(id, updates)` MUST send `{ status: 'reviewed' | 'pending' }`**, NOT `{ isRead }` (RPC reads `updates->>'status'`).

### Storage buckets

- `sounds` — primary bucket for all SFX files (mp3 + wav). Public READ via storage API.
- `archives` — pre-built whole-library zips, manifest, and metadata. Public READ. Rebuilt nightly by `scripts/build-archives.ps1`. Contents:
  - `paras-sfx-library-mp3.zip` — every active mp3 (~900 MB)
  - `paras-sfx-library-wav.zip` — every active wav (~5 GB)
  - `paras-sfx-library-manifest.txt` — newline-separated public URLs (for `aria2c -i` / `wget -i`)
  - `paras-sfx-library-metadata.json` — `{ built_at, total_sounds, archives: [...], manifest: {...} }`

### Postgres functions (RPC)

All 15 functions in `public`:

| Function | Args | DEFINER | search_path | Purpose |
|---|---|---|---|---|
| `admin_create_sound` | `input jsonb` | ✓ | locked | Insert a new sound (validates is_admin) |
| `admin_update_sound` | `sound_id uuid, updates jsonb` | ✓ | locked | Update sound metadata |
| `admin_soft_delete_sound` | `sound_id uuid` | ✓ | locked | Set `deleted_at = now()` |
| `admin_update_suggestion` | `suggestion_id uuid, updates jsonb` | ✓ | locked | Update suggestion status |
| `admin_delete_suggestion` | `suggestion_id uuid` | ✓ | locked | Hard-delete a suggestion |
| `admin_set_tags` | `tag_names text[]` | ✓ | locked | Replace entire global tag list |
| `admin_add_tag` | `tag_name text` | ✓ | locked | Add a single tag to vocab |
| `admin_remove_tag` | `tag_name text` | ✓ | locked | Remove a tag from vocab |
| `submit_suggestion` | `p_sound_name, p_category, p_description text` | ✓ | locked | Public anon-callable suggestion submit |
| `search_sounds` | `q text, max_results int` | ✓ | locked | Server-side search via tsvector + ILIKE fallback. Returns rows from `sounds_with_urls`, ranked by exact-title → starts-with → contains → ts_rank. Capped by `max_results` (default 50). |
| `increment_listen` | `sound_id uuid` | ✓ | locked | Bump `sounds.listens` (anon-callable, fire-and-forget) |
| `increment_download` | `sound_id uuid` | ✓ | locked | Bump `sounds.downloads` (anon-callable, fire-and-forget) |
| `is_admin` | (none) | ✓ | locked | Auth helper — reads JWT app_metadata.role |
| `sounds_search_vector_update` | trigger | (trigger) | — | Rebuilds `search_vector` on INSERT/UPDATE |
| `update_updated_at` | trigger | (trigger) | — | Bumps `updated_at` on every UPDATE |

### RLS policies

- `sounds_with_urls`: public SELECT (`deleted_at IS NULL` filter via the view)
- `sounds`: admin-only direct mutations (covered by `block_direct_mutations` migration); all admin work flows through SECURITY DEFINER RPCs
- `suggestions`: public INSERT (via `submit_suggestion` RPC), admin-only UPDATE/DELETE (via admin RPCs)
- `tags`: public SELECT, admin-only mutations
- `storage.objects` (bucket = 'sounds'): public SELECT, admin-only INSERT/UPDATE/DELETE

---

## File structure (key files only)

```
src/
├── App.tsx                          # Main app — search UI, age gate, results, view-all, bulk-download trigger
├── main.tsx                         # React entry, lazy-loads admin chunks
├── types/index.ts                   # Sound & Suggestion TypeScript interfaces
├── utils/
│   ├── api.tsx                      # *** SINGLE API GATEWAY *** — all Supabase calls
│   ├── supabase/info.tsx            # Supabase URL + anon key (env vars only, throws if missing)
│   ├── searchUtils.ts               # Client-side search fallback (rarely used now)
│   ├── audioUtils.ts                # Audio metadata helpers
│   ├── ageVerification.ts           # NSFW age-gate helpers
│   ├── formatters.ts                # title-case + duration formatters
│   └── tagUtils.ts                  # tag display formatting
├── components/
│   ├── GoogleDriveAudioPlayer.tsx   # **Per-sound card** — audio + download modal
│   ├── BulkDownloadDialog.tsx       # **Bulk download modal** — chunked zip up to N sounds
│   ├── BrowseByTags.tsx             # Collapsible tag browser
│   ├── AgeVerification.tsx          # 18+ NSFW age-gate modal
│   ├── SuggestSoundFormSection.tsx  # Public suggestion form (with bot protection)
│   ├── ErrorBoundary.tsx            # React error boundary for crash recovery
│   ├── Login.tsx                    # Admin login (Supabase Auth, accepts username "Para")
│   ├── AdminDashboard.tsx           # Admin tabs container (Add/Manage/Search/Suggestions/Import/Tags)
│   ├── ManageSounds.tsx             # CRUD for sounds (list, edit metadata, delete)
│   ├── ManageSuggestions.tsx        # View/approve user suggestions
│   ├── ManageTags.tsx               # Tag vocabulary management UI
│   ├── BulkImport.tsx               # JSON paste-import form (requires mp3_path/wav_path per row)
│   ├── SearchSounds.tsx             # Admin-side search wrapper
│   └── ui/                          # shadcn/ui primitives (Button, Dialog, Input, etc.)
docker/
├── docker-compose.yml               # Full Supabase self-hosted stack (12 services)
├── .env                             # Secrets (git-ignored)
├── kong.yml                         # Kong gateway routing config
└── functions/main/index.ts          # Edge runtime entrypoint
supabase/
├── config.toml                      # Supabase CLI config (mostly unused since self-hosted via Docker)
└── migrations/                      # 9 migrations, see Migration History below
scripts/                             # See "Operations Scripts" section below
```

---

## API function reference (`src/utils/api.tsx`)

### Auth
| Function | Purpose |
|---|---|
| `signIn(identifier, password)` | Sign in. Accepts email OR `Para` (which maps to `admin@parasfx.com`) |
| `signOut()` | Sign out current session |
| `getSession()` | Returns current session if any |
| `onAuthStateChange(cb)` | Subscribe to login/logout |

### Sounds
| Function | Implementation |
|---|---|
| `getSoundCount()` | `count: 'estimated'` (uses planner stats, ~5ms). Caches in localStorage. |
| `getCachedSoundCount()` | Synchronous read from localStorage for instant first paint |
| `getAllSounds()` | `select('*')` from `sounds_with_urls` (used by admin views) |
| `getSounds(page, pageSize)` | Paginated fetch with `range()` |
| `searchSoundsRemote(query, maxResults)` | **Server-side search** via `rpc('search_sounds', ...)` — uses GIN tsvector index, returns ranked results |
| `incrementListen(soundId)` | Fire-and-forget RPC, bumps listen counter |
| `incrementDownload(soundId)` | Fire-and-forget RPC, bumps download counter |
| `createSound(sound)` | Admin RPC — requires mp3_path or wav_path |
| `updateSound(id, updates)` | Admin RPC |
| `deleteSound(id)` | Admin RPC — soft delete |

### Suggestions
| Function | Implementation |
|---|---|
| `getAllSuggestions()` | `select('*')` + client-side field mapping |
| `createSuggestion(input)` | Goes through `submit_suggestion` RPC for bot protection + atomic insert |
| `updateSuggestion(id, updates)` | Admin RPC. **Must send `{ status }`**, not `{ isRead }` (which the RPC ignores) |
| `deleteSuggestion(id)` | Admin RPC — hard delete |

### Tags
| Function | Implementation |
|---|---|
| `getAllTags()` | `select('name')` |
| `setTags(tags)` | Admin RPC — replace entire vocab |
| `addTag(tag)` | Admin RPC |
| `removeTag(tag)` | Admin RPC |

---

## Operations scripts (`scripts/`)

### Active operations

| Script | Purpose | Run frequency |
|---|---|---|
| `tunnel-proxy.mjs` | Security reverse proxy, port 54350 → 54341. Blocks service_role JWTs and admin paths. | Auto-started by supervisor |
| `run-tunnel-proxy-supervised.ps1` | Keeps tunnel-proxy alive (5s relaunch on crash) | Auto-started by .vbs in Startup folder |
| `setup-autostart.ps1` | One-time install — drops .vbs launcher into Startup folder | Once per machine |
| `install-cloudflared-service.bat` | One-time — registers cloudflared as Windows Service | Once per machine (run as Admin) |
| `lock-db-ports.bat` | Apply Windows Firewall rules for 54340-54349 | Once per machine (run as Admin) |
| `start-tunnel-proxy.bat` | Manual proxy startup (supervisor handles this normally) | Rarely needed |

### Data operations

| Script | Purpose |
|---|---|
| `migrate-from-cloud.mjs` | One-time historical: pulled DB rows + storage objects from old Supabase Cloud project |
| `migrate-to-proper-tables.sql` | One-time historical: KV store → normalized tables |
| `enrich-tags.mjs` | Walks all `sounds`, generates tags from a curated keyword map (~150 keywords across genres). Strips junk tags. Refreshes global `tags` table. Idempotent — re-run after imports. Use `--dry` to preview. |
| `dedupe-and-disambiguate.mjs` | Reads MD5 hashes (build via `find ... \| md5sum` inside the storage container, save to `.tmp_file_hashes.tsv`), soft-deletes byte-identical sounds, then renames remaining same-title sounds with `(MKH416, NonReduced Air)` etc. Use `--dry` to preview. |
| `normalize-titles.mjs` | Splits compressed words (Openingclosing → Opening Closing), inserts space between letter+digit (Plaps29 → Plaps 29), normalizes Footsteps formatting, preserves mic names (ZoomH8 stays intact). Use `--dry` to preview. |
| `fix-marker-titles.mjs` | One-time: cleaned up "THRUST_Marker 01" auto-titles into proper sound names |

### Pre-built archive operations

| Script | Purpose |
|---|---|
| `build-archives.ps1` | Rebuilds the `archives/` bucket contents (mp3 zip, wav zip, manifest.txt, metadata.json). Atomic: writes a NEW version-uuid first, verifies via `zipfile.testzip()`, swaps the storage.objects pointer, then deletes the old version file. If anything fails mid-build the existing archives keep serving. Logs to `scripts/build-archives.log`. |
| `build-archives.py` | Helper called by build-archives.ps1 inside the storage container. Reads `(source-path, archive-name)` pairs from stdin, streams them into a `ZIP_STORED` zip on disk so memory stays bounded regardless of total size. |
| `install-archive-task.ps1` | One-time: registers a Windows Task Scheduler entry (`ParaSFX-BuildArchives`) that runs `build-archives.ps1` daily at 03:00. No admin needed. Catches up via `StartWhenAvailable` if the PC was off at 3 AM. |

### Backup

| Script | Purpose |
|---|---|
| `backup-supabase.ps1` (in repo root) | Backs up both Postgres dump AND storage volume tar.gz. 30-day retention. **MANDATORY** before any Docker change. Should be on a daily Task Scheduler job. |

---

## Audio player architecture (`GoogleDriveAudioPlayer.tsx`)

The component name is historical (sounds used to be Google Drive URLs); it's now the canonical sound card for Supabase-hosted audio.

### Key behaviors

1. **Imperative `src` assignment** — `<audio>` element gets `src` set via `audioRef.current.src = url` inside `useEffect`, NOT via JSX. Reason: React's reconciler will re-set the `src` attribute on every parent re-render even when the value hasn't changed, which **aborts mid-playback** (this caused the "stops on scroll" bug).
2. **`playsInline`** — keeps mobile Safari from pausing off-screen `<audio>` elements.
3. **Single-instance playback** — playing card dispatches a window `'sfx-lib:play'` CustomEvent with the audio element as detail; all other cards' listeners pause themselves on receipt. No global state, no context.
4. **Listen counter** — first `play()` per mount fires `incrementListen` (fire-and-forget).
5. **Viewport-based metadata preload** — IntersectionObserver bumps `audio.preload` from `none` → `metadata` when the card enters viewport (with 200px rootMargin). Hover does the same as a fallback for desktop.
6. **State sync via events** — `play`/`pause` listeners on the audio element keep React's `isPlaying` state in sync with reality (e.g. browser pauses for tab background, Media Session, etc.).
7. **`ended` rewind** — clicking play on an ended clip rewinds to 0 first (otherwise `play()` is a no-op).

### Download modal (per sound)

- Click "Download" → modal opens with two big cards (MP3 / WAV)
- Format unavailable → card greyed out with "Not available" subtitle
- Click format → `fetch()` → wrap in `Blob` → trigger `<a download>` from a same-origin `blob:` URL (cross-origin `<a download>` is silently ignored by browsers)
- Spinner replaces the icon during fetch; toast confirms on success
- Footer link "Or bulk download all sounds in this view" closes the per-sound modal and dispatches `'sfx-lib:request-bulk'` window event, which `App.tsx` listens for to open the bulk dialog

---

## Bulk download system (`BulkDownloadDialog.tsx`)

The modal offers two paths depending on what the user wants:

### Path 1 — pre-built whole-library zip (one-click)

When the dialog opens, it fetches `archives/paras-sfx-library-metadata.json`. If that file exists it shows a "Download the entire library" panel at the top with two big links:

- **MP3 (all)** — single-click download, browser-native resume, ~900 MB
- **WAV (all)** — same, ~5 GB

Plus a "Power users" line linking to `manifest.txt` for `aria2c -i` / `wget -i` use.

If the metadata fetch fails, the panel just doesn't render — the dialog falls back to Path 2 only.

### Path 2 — chunked client-zip of the current selection
- Receives `sounds: Sound[]` prop (the current results array — search results, view-all, etc.)
- User picks MP3 or WAV in the modal
- Pool is **chunked into batches of 100** (`CHUNK_SIZE = 100`)
- For each chunk:
  - Fetch all files in parallel (`PARALLEL = 4` concurrent requests)
  - Add to a JSZip with `compression: 'STORE'` (audio is already compressed; deflate is wasted CPU)
  - `generateAsync({ streamFiles: true })` → blob
  - Trigger native download via `<a download>` from a same-origin `blob:` URL
  - 800ms gap before the next chunk so each download has time to land
- Filename pattern: `paras-sfx-<context>-<format>-part-NN-of-MM-<ts>.zip` (omits `-part-...` if there's only one chunk)

### Cancel behavior
- `abortedRef = useRef(false)` — workers read live value through the ref. State alone wouldn't work because closures capture state at the moment workers start.
- Cancel button flips the ref AND forces a rerender so the button label updates to "Cancelling…"
- Workers check `abortedRef.current` before each fetch and bail if set

### Triggering bulk download
Two entry points:
1. **Standalone button** — outlined-emerald "Bulk download (N)" right of the search bar, only visible when results exist
2. **Per-sound modal link** — fires `'sfx-lib:request-bulk'` window event; App listens for it

---

## Search architecture

- **Server-side via `search_sounds(q, max_results)` RPC** (uses GIN-indexed tsvector). Default cap 50, frontend asks for 100.
- Strategy:
  1. Empty query → returns top `max_results` ordered by `created_at DESC`
  2. Non-empty: split into alphanumeric tokens, build prefix tsquery (`bed:* & thr:*`)
  3. WHERE clause: tsvector match OR ILIKE-on-title fallback (catches very short queries / punctuation that tsquery misses)
  4. ORDER BY tier: exact title equality → title starts-with → title contains → ts_rank → alphabetical
- Frontend (`api.searchSoundsRemote`) wraps the RPC with try/catch
- App.tsx falls back to client-side `searchSounds(allSounds, q)` ONLY if `allSounds` was already loaded AND server returned nothing — covers admin-side edge cases

---

## Auth architecture

- **Supabase Auth** (email + password). Not custom — uses `supabase.auth.signInWithPassword`.
- **One admin user** — `admin@parasfx.com`. Username `Para` is mapped to that email client-side in `Login.tsx` so admins can log in with either.
- **Admin role** is set via JWT `app_metadata.role = 'admin'`. The `is_admin()` SQL function reads this to gate admin RPCs.
- **No public signup** — only admins (created manually via Studio). Standard Supabase signup is disabled in the auth config.

---

## Theme + UI conventions

| Token | Value | Use |
|---|---|---|
| `bg-[#0d1017]` | Page background | Main viewport |
| `bg-[#141820]` | Card / panel background | Result cards, modals, admin panels |
| `bg-[#0f1218]` | Input + nested panel background | Form inputs, audio player frame |
| `bg-[#181c24]` | Sound card background | Slightly lighter than #141820 |
| `border-[#252a35]` | Border / divider | Inputs, cards, separators |
| `bg-[#10b981]` | Primary accent | Buttons, play button, links |
| `hover:bg-[#0d9668]` | Primary accent hover | Same elements on hover |
| `text-[#e8eaed]` | Foreground | Headings, important text |
| `text-[#d1d5db]` | Body text | Regular content |
| `text-[#9ca3af]` | Muted | Secondary info |
| `text-[#6b7280]` | More muted | Hints, placeholders |

Both **public AND admin** views use the same palette. The old purple/slate gradient theme has been fully retired.

---

## Migration history

### March 2026 — Cloud → Self-Hosted
1. Migrated from Supabase Cloud to self-hosted Docker Compose stack
2. Generated unique JWT secret, replacing default demo keys
3. Added tunnel proxy + Cloudflare Tunnel for secure public access
4. Applied Windows Firewall rules, localhost-only port binding

### March 2026 — KV → Normalized Tables
1. Migrated KV store data into proper `sounds`, `suggestions`, `tags` tables
2. Replaced Edge Function API with direct Supabase JS client queries
3. Dropped all legacy tables (KV store, *_old, unused feature tables)

### April 2026 — Storage volume loss + recovery
1. Storage volume was wiped during a Docker container recreation (no storage backup existed)
2. Built `migrate-from-cloud.mjs` to re-pull files from network share at `\\192.168.50.214\g\Exported Audio`
3. Wrote fuzzy filename matcher (folder-aware) to align ~1888 source files with 702 DB rows
4. Bulk-imported 882 new sounds with full metadata (ffprobe-extracted duration/sample rate/bit depth)
5. **Updated `backup-supabase.ps1` to back up the storage volume too** (was DB-only before; root cause of the loss)

### April 2026 — Data quality pass
1. Tag enrichment (`enrich-tags.mjs`) — keyword-driven auto-tagging. Brought tag coverage from 169 untagged → 1 untagged
2. Dedupe + disambiguate (`dedupe-and-disambiguate.mjs`) — MD5-verified 209 byte-identical duplicates soft-deleted; 350 same-title rows renamed with mic/air suffixes
3. Title normalization (`normalize-titles.mjs`) — split compressed words (Openingclosing → Opening Closing), spaced letter-digit boundaries, unified Footsteps format

### April 2026 — Frontend rewrite
1. Removed legacy KV-store and Google-Drive-era code (kept the component name `GoogleDriveAudioPlayer` because it's still the canonical sound card)
2. Server-side search RPC + frontend wiring (replaced load-all-then-filter pattern)
3. Listen + download counters now actually increment (RPCs + frontend calls)
4. Single-instance audio playback via window CustomEvent
5. Imperative `audio.src` assignment to prevent React-induced playback aborts
6. Bulk download modal with chunked zips
7. Theme unification — admin matches public dark+emerald palette
8. Count display optimized: `count=estimated` + localStorage cache for instant first paint

### April 2026 — Security audit + fixes
1. Locked `search_path = public` on every SECURITY DEFINER function (13/13 verified)
2. Removed hardcoded anon key fallback from `info.tsx`
3. Audit + fix of admin form shape mismatches (BulkImport, AdminDashboard's old "Add Sound" form)
4. Cleaned up unused files (AudioPlayer.tsx, SuggestSoundForm.tsx, migrateData.tsx, seedData.tsx)
5. Removed duplicate `@jsr/supabase__supabase-js` dep
6. Patreon project also secured (Kong port bindings 0.0.0.0 → 127.0.0.1)

---

## Dev notes / gotchas

- **Bot protection on `SuggestSoundFormSection`:** honeypot field, interaction counting, minimum form time (2s), 1-minute rate limiting per IP via localStorage
- **NSFW age gate:** sounds with `nsfw=true` are filtered client-side via `filterNSFWSounds(results, ageVerified)`. Age verification is stored in localStorage. Searches that include NSFW results trigger the gate before display.
- **Soft deletes:** Sounds use `deleted_at` column. The `sounds_with_urls` view filters them out automatically. Admin tools should also filter them unless explicitly showing deleted ones.
- **Polling intervals:** AdminDashboard polls suggestions every 30s for the unread badge. Keep these reasonable to avoid excessive API load.
- **NEVER call `setIsRead` on a suggestion update** — the RPC ignores it. Always send `{ status: 'reviewed' | 'pending' }`.
- **Audio `src` MUST be set imperatively, not via JSX** — see `GoogleDriveAudioPlayer.tsx` `useEffect`. JSX `src` causes React to re-set the attribute on every parent re-render, aborting mid-playback.
- **shadcn/Figma Make UI files have versioned imports** (e.g. `from "@radix-ui/react-dialog@1.1.6"`) which work in Vite dev but break Vercel/Rollup builds. If adding a new shadcn UI component, **strip the `@X.Y.Z` from the import specifier**. The actual version lives in `package.json`.
- **Cross-origin `<a download>` is ignored** by browsers. To trigger a real download from `sfxlib-api.parasfx.com` while the page is on `parasfx.com` (Vercel/Pages), fetch the bytes, wrap in a `Blob`, and trigger the click from a same-origin `blob:` URL. See `GoogleDriveAudioPlayer.tsx` `downloadAs()`.
- **PostgREST `count=exact` does a full scan.** Use `count=estimated` (planner stats) for displays where ±a-few-rows doesn't matter. ~40x faster.
- **`<Dialog>` from shadcn renders even when `open=false`** — the children evaluate but the visible portal doesn't mount. Don't put expensive computations at the top level of dialog components without guarding on `open`.
- **`React.memo` only helps if props are referentially stable.** `sound` from `results[i]` is stable as long as the array doesn't get a fresh reference; check `useCallback`/`useMemo` for any prop you pass through.
- **`@radix-ui/react-dialog` warns about `Function components cannot be given refs`** — non-blocking shadcn integration noise, doesn't affect behavior.

---

## Other Para projects on the same machine

This project lives at `C:\Users\camer\Para SFX Library`. Two sibling projects share the host:

| Project | Path | Port range | Public hostname |
|---|---|---|---|
| **Para SFX Library** (this) | `C:\Users\camer\Para SFX Library` | 54340-54349 | `sfxlib-api.parasfx.com` |
| **Patreon** | `C:\Users\camer\Para Patreon\Patreoninspiredpage` | 54320-54329 | `patreon-api.parasfx.com` |
| **Audiodex** | `C:\Users\camer\Masterlist\Audiodexnew` | 54330-54339 | `masterlist-api.parasfx.com` |

All three are bound to `127.0.0.1` (no LAN exposure). All three use the same `cloudflared` Windows Service for their public hostnames (different ingress entries in `~/.cloudflared/config.yml`).

---

## Currently deployed

| Component | Where |
|---|---|
| Frontend | Vercel + Cloudflare Pages, both auto-build from GitHub `main` |
| Repo | https://github.com/parasaudios/paras-sfx-library |
| Public site | `parasfx.com` (currently routed via Vercel — moving to Cloudflare Pages per latest discussion) |
| API | `sfxlib-api.parasfx.com` → tunnel-proxy.mjs → Kong |
| DB + Storage | Self-hosted Docker on local Windows machine |
| Backups | Local disk (`backups/` folder), 30-day retention |

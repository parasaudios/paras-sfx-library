# Paras SFX Library

## Project Overview
A React + Vite sound effects library app with a Supabase backend. Users can search/browse/play/download SFX. Admins can manage sounds, tags, and suggestions.

## Architecture

### Frontend
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS + Radix UI primitives + shadcn/ui components
- **Entry point:** `src/App.tsx`

### Backend — Self-Hosted Supabase
- **Hosting:** Self-hosted via Docker Compose (`docker/docker-compose.yml`)
- **All API calls go through:** `src/utils/api.tsx` (single gateway — no other file talks to Supabase directly)
- **Client library:** `@supabase/supabase-js` (npm, v2.x)
- **Auth config:** `src/utils/supabase/info.tsx` (Supabase URL + anon key via env vars)

### Self-Hosted Infrastructure

#### Security Architecture (Best Practices)
The self-hosted Supabase instance follows these security best practices:

1. **Custom JWT Secret** — A unique 64-character HS256 secret replaces the default Supabase demo key, making all default/demo JWTs cryptographically invalid. Stored in `docker/.env` (git-ignored).
2. **Tunnel Proxy** (`scripts/tunnel-proxy.mjs`) — Sits between Cloudflare Tunnel and Supabase API (port 54350 → 54341). Blocks:
   - Any request carrying a `service_role` JWT (detected via base64url fragment matching in headers and query params)
   - Admin-only paths (`/auth/v1/admin`, `/pg/`)
   - Logs all blocked requests with timestamps, source IPs, and block reasons to `tunnel-proxy.log`
3. **Localhost-Only Port Binding** — All Docker ports bind to `127.0.0.1`, not `0.0.0.0`
4. **Windows Firewall Rules** (`scripts/lock-db-ports.bat`) — Blocks external network access to ports 54340-54349 while preserving localhost access
5. **Cloudflare Tunnel** — Public API access via `sfxlib-api.parasfx.com` routes through the tunnel proxy only
6. **RLS + SECURITY DEFINER Functions** — All admin mutations go through Postgres functions with `SET search_path = public` to prevent search-path injection
7. **Auth Hardening** — Signup disabled, minimum 12-char passwords, mixed case + digits required

#### Docker Compose Stack (12 Services)
Managed via `docker/docker-compose.yml` with secrets in `docker/.env` (NEVER commit):
- **db** (postgres:17) — Port 54342, named volume `supabase_db_Para_SFX_Library`
- **kong** (2.8.1) — API gateway, port 54341
- **auth/gotrue** — Authentication service
- **rest/postgrest** — REST API, uses JWKS format for JWT validation
- **storage** — File storage API, named volume `supabase_storage_Para_SFX_Library`
- **realtime** — WebSocket subscriptions
- **studio** — Admin dashboard, port 54343
- **analytics/logflare** — Log aggregation, port 54345
- **edge-runtime** — Deno edge functions
- **inbucket/mailpit** — Dev email, port 54344
- **imgproxy** — Image transformation
- **pg-meta** — Database metadata API

#### Key Files
| File | Purpose |
|------|---------|
| `docker/docker-compose.yml` | Full Supabase stack definition |
| `docker/.env` | All secrets (JWT_SECRET, keys, passwords) — NEVER commit |
| `docker/kong.yml` | Kong API gateway routing config |
| `docker/functions/main/index.ts` | Edge runtime entrypoint |
| `scripts/tunnel-proxy.mjs` | Security reverse proxy for public access |
| `scripts/lock-db-ports.bat` | Windows Firewall rules (run as Admin) |
| `scripts/start-tunnel-proxy.bat` | Starts the tunnel proxy |

#### Startup Procedure
```bash
cd docker && docker compose up -d          # Start all services
node scripts/tunnel-proxy.mjs              # Start security proxy (port 54350)
cloudflared tunnel run parasmut-supabase   # Start Cloudflare Tunnel
scripts\lock-db-ports.bat                  # Run as Admin — firewall DB ports
```

#### Auto-start at Logon (one-time setup)
The tunnel proxy must be running for `sfxlib-api.parasfx.com` to work. To
have it start automatically (and auto-restart on crash) at every user logon:
```powershell
# Run once after cloning the repo (no admin needed)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1
```
This drops a `.vbs` launcher into the user's Startup folder pointing at
`scripts\run-tunnel-proxy-supervised.ps1`. The supervisor relaunches the
proxy within 5 seconds if it ever exits. Logs:
- `tunnel-proxy.log` — proxy events (request/block/response)
- `tunnel-proxy-supervisor.log` — supervisor restart events

To uninstall: delete `ParaSFX-TunnelProxy.vbs` from `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`.

#### Cloudflare Tunnel as a Windows Service (one-time setup)
`cloudflared` also needs to be running for the public hostname to resolve.
Rather than relying on a logon shortcut (which dies if the user logs out),
install it as a proper Windows service:
```cmd
REM Right-click this file -> "Run as administrator" (needs UAC elevation)
scripts\install-cloudflared-service.bat
```
The script removes any old logon shortcut, registers `cloudflared` as an
auto-start service, and launches it. After that `sfxlib-api.parasfx.com`
survives reboots without login. Check state with `sc query cloudflared`.

#### CRITICAL: Backup Before Any Docker Changes
**NEVER restart, recreate, or modify Docker containers/volumes without first running a full backup.**
```powershell
.\backup-supabase.ps1   # Backs up BOTH database AND storage volume
```
The backup script creates:
- `backups/supabase_backup_<timestamp>.sql` — full Postgres dump
- `backups/storage/storage_backup_<timestamp>.tar.gz` — all audio files from the storage volume

To restore storage from backup:
```powershell
docker run --rm -v supabase_storage_Para_SFX_Library:/target -v "${PWD}\backups\storage:/backup" alpine tar xzf /backup/storage_backup_<timestamp>.tar.gz -C /target
```

#### Best Practices Checklist
- [ ] `docker/.env` is in `.gitignore` and NEVER committed
- [ ] JWT_SECRET is unique (not the Supabase default)
- [ ] All Docker ports bind to `127.0.0.1`
- [ ] Tunnel proxy is running and blocking service_role keys
- [ ] Windows Firewall rules are applied (ports 54340-54349)
- [ ] Cloudflare Tunnel routes only through the proxy (port 54350)
- [ ] Admin functions use `SECURITY DEFINER` with `SET search_path = public`
- [ ] Signup is disabled, strong password policy enforced
- [ ] **ALWAYS run `backup-supabase.ps1` before any Docker changes** — backs up DB + storage volume
- [ ] Regular daily backups running (scheduled task for `backup-supabase.ps1`)

## Database Schema

### Active Tables
| Table | Purpose |
|-------|---------|
| `sounds` | All sound metadata (title, tags[], mp3_path, wav_path, duration, microphone, etc.) |
| `sounds_with_urls` | **View** — joins `sounds` with signed storage URLs for `audioUrl` and `downloadUrl` |
| `suggestions` | User-submitted sound suggestions (sound_name, category, description, status) |
| `tags` | Managed tag list (name, slug, usage_count, color, icon) |

### Key Columns — `sounds`
- `id` (uuid PK), `title`, `filename` (NOT NULL), `slug`
- `tags` (text[] — stored as Postgres array, NOT a join table)
- `mp3_path`, `wav_path`, `has_wav`
- `file_size`, `microphone`, `duration_seconds`
- `source` (e.g. 'kv_migration', 'upload')
- `search_vector` (tsvector for full-text search)
- `deleted_at` (soft delete — NULL means active)

### Key Columns — `suggestions`
- `id` (uuid PK), `sound_name`, `description`, `category`, `status` ('pending'/'reviewed')
- Frontend maps: `sound_name` → `soundName`, `created_at` → `submittedAt`, `status !== 'pending'` → `isRead`

### Storage Buckets
- `sounds` — primary bucket for all SFX files (mp3 + wav)

### Postgres Functions (RPC)
| Function | Purpose | Auth |
|----------|---------|------|
| `admin_create_sound(input jsonb)` | Insert a new sound | Admin |
| `admin_update_sound(sound_id uuid, updates jsonb)` | Update sound metadata | Admin |
| `admin_soft_delete_sound(sound_id uuid)` | Soft-delete a sound | Admin |
| `admin_update_suggestion(suggestion_id uuid, updates jsonb)` | Update suggestion status | Admin |
| `admin_delete_suggestion(suggestion_id uuid)` | Hard-delete a suggestion | Admin |
| `admin_set_tags(tag_names text[])` | Replace entire tag list | Admin |
| `admin_add_tag(tag_name text)` | Add a single tag | Admin |
| `admin_remove_tag(tag_name text)` | Remove a single tag | Admin |

### RLS Policies
- `sounds_with_urls`: public SELECT (read-only)
- `suggestions`: public INSERT (for user submissions), admin-only for UPDATE/DELETE
- `tags`: public SELECT, admin-only for mutations
- Admin functions use `SECURITY DEFINER` to bypass RLS

## File Structure (Key Files)

```
src/
├── App.tsx                          # Main app — search UI, age gate, admin login
├── types/index.ts                   # Sound & Suggestion TypeScript interfaces
├── utils/
│   ├── api.tsx                      # *** SINGLE API GATEWAY *** — all Supabase calls
│   ├── supabase/info.tsx            # Supabase URL + anon key (via env vars)
│   ├── migrateData.tsx              # localStorage → Supabase migration utility
│   └── seedData.tsx                 # Sample data seeder
├── components/
│   ├── SearchSounds.tsx             # Public search interface
│   ├── AdminDashboard.tsx           # Admin tabs container
│   ├── ManageSounds.tsx             # CRUD for sounds
│   ├── ManageSuggestions.tsx        # View/manage user suggestions
│   ├── ManageTags.tsx               # Tag management UI
│   ├── BulkImport.tsx               # JSON bulk import
│   ├── SuggestSoundFormSection.tsx  # Public suggestion form (with bot protection)
│   ├── ErrorBoundary.tsx            # React error boundary for crash recovery
│   └── Login.tsx                    # Admin login component
docker/
├── docker-compose.yml               # Full Supabase self-hosted stack
├── .env                             # Secrets (git-ignored)
├── kong.yml                         # Kong gateway config
└── functions/main/index.ts          # Edge runtime entrypoint
scripts/
├── tunnel-proxy.mjs                 # Security reverse proxy
├── start-tunnel-proxy.bat           # Proxy startup script
├── lock-db-ports.bat                # Windows Firewall lockdown
└── apply-kong-config.bat            # Re-apply Kong config
```

## API Function Reference (`src/utils/api.tsx`)

### Sounds
- `getAllSounds()` → `supabase.from('sounds_with_urls').select('*')`
- `createSound(sound)` → `supabase.rpc('admin_create_sound', ...)`
- `updateSound(id, updates)` → `supabase.rpc('admin_update_sound', ...)`
- `deleteSound(id)` → `supabase.rpc('admin_soft_delete_sound', ...)`

### Suggestions
- `getAllSuggestions()` → `supabase.from('suggestions').select('*')` + client-side field mapping
- `createSuggestion(input)` → `supabase.from('suggestions').insert(...)` (direct via RLS)
- `updateSuggestion(id, updates)` → `supabase.rpc('admin_update_suggestion', ...)`
- `deleteSuggestion(id)` → `supabase.rpc('admin_delete_suggestion', ...)`

### Tags
- `getAllTags()` → `supabase.from('tags').select('name')`
- `setTags(tags)` → `supabase.rpc('admin_set_tags', ...)`
- `addTag(tag)` → `supabase.rpc('admin_add_tag', ...)`
- `removeTag(tag)` → `supabase.rpc('admin_remove_tag', ...)`

## Migration History

### March 2026 — Cloud → Self-Hosted
1. Migrated from Supabase Cloud to self-hosted Docker Compose stack
2. Generated unique JWT secret, replacing default demo keys
3. Added tunnel proxy + Cloudflare Tunnel for secure public access
4. Applied Windows Firewall rules, localhost-only port binding

### March 2026 — KV → Normalized Tables
1. Migrated KV store data into proper `sounds`, `suggestions`, `tags` tables
2. Replaced Edge Function API with direct Supabase JS client queries
3. Dropped all legacy tables (KV store, *_old, unused feature tables)

## Dev Notes
- **Bot protection:** `SuggestSoundFormSection` uses honeypot field, interaction counting, minimum form time, and 1-minute rate limiting
- **Admin auth:** Simple password-based login (not Supabase Auth)
- **Soft deletes:** Sounds use `deleted_at` column; queries filter `WHERE deleted_at IS NULL`
- **Polling intervals:** AdminDashboard (30s), ManageSuggestions (30s) — keep reasonable to avoid excessive API load

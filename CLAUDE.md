# Paras SFX Library

## Project Overview
A React + Vite sound effects library app with a Supabase backend. Users can search/browse/play/download SFX. Admins can manage sounds, tags, and suggestions.

## Architecture

### Frontend
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS + Radix UI primitives + shadcn/ui components
- **Entry point:** `src/App.tsx`

### Backend — Supabase (Direct Queries)
- **Project ID:** `nuskzxhtiusnaaungbzh`
- **All API calls go through:** `src/utils/api.tsx` (single gateway — no other file talks to Supabase directly)
- **Client library:** `@supabase/supabase-js` (npm, v2.x)
- **Auth config:** `src/utils/supabase/info.tsx` (project ID + anon key)

### Previous Architecture (Deprecated)
- Previously used a Hono-based Edge Function (`make-server-27929102`) as an API middleman
- Previously used a KV store table (`kv_store_27929102`) for sound/tag/suggestion data
- Both have been replaced by direct Supabase client queries + proper normalized tables

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
- `sounds` — primary bucket for uploaded SFX files
- `make-27929102-streaming` — legacy bucket from Figma Make uploads (36 KV-only sounds)

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
│   ├── supabase/info.tsx            # Project ID + anon key
│   ├── migrateData.tsx              # localStorage → Supabase migration utility
│   └── seedData.tsx                 # Sample data seeder
├── components/
│   ├── SearchSounds.tsx             # Public search interface
│   ├── AdminDashboard.tsx           # Admin tabs container
│   ├── ManageSounds.tsx             # CRUD for sounds
│   ├── ManageSuggestions.tsx        # View/manage user suggestions
│   ├── ManageTags.tsx               # Tag management UI
│   ├── BulkImport.tsx               # JSON bulk import
│   └── SuggestSoundFormSection.tsx  # Public suggestion form (with bot protection)
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

### March 2026 — KV → Normalized Tables
1. Migrated 36 KV-only sounds into `sounds` table (702 KV total, 666 already existed)
2. Migrated KV suggestions array into `suggestions` table
3. Synced KV tags into `tags` table
4. Replaced Edge Function API with direct Supabase JS client queries
5. Dropped legacy tables: `kv_store_27929102`, all `*_old` tables, unused feature tables

### Tables Dropped
- `kv_store_27929102` (KV store)
- `*_old` tables (sounds_old, tags_old, etc.)
- Unused feature tables: collections, playlists, favorites, comments, similar_sounds, etc.
- Duplicate puppy_app tables: rewards, tasks, badges (non-prefixed versions)

## Dev Notes
- **Build issue:** Pre-existing Tailwind/PostCSS error (`Cannot read properties of undefined (reading 'blocklist')`) — not related to API migration
- **Bot protection:** `SuggestSoundFormSection` uses honeypot field, interaction counting, minimum form time, and 1-minute rate limiting
- **Admin auth:** Simple password-based login (not Supabase Auth)
- **Soft deletes:** Sounds use `deleted_at` column; queries filter `WHERE deleted_at IS NULL`

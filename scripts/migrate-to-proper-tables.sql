-- =============================================================================
-- COMPLETED — One-time migration (March 2026). Kept for historical reference.
-- MIGRATION: KV Store → Proper Postgres Tables
-- =============================================================================
-- Migrated paras-sfx-library from kv_store key-value pattern to proper
-- `sounds`, `tags`, and `suggestions` tables, then dropped legacy tables.
-- Cloud project has since been decommissioned.
--
-- IMPORTANT: Review each section before running. The DROP statements at the
-- end are commented out — uncomment them only after confirming the migration.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. MIGRATE KV SOUNDS → sounds TABLE
-- =============================================================================
-- 702 sounds in KV, 666 already in sounds table, 36 KV-only sounds to insert.
-- KV-only sounds were uploaded via Figma Make and stored in the
-- "make-27929102-streaming" bucket (not the "sounds" bucket).

INSERT INTO sounds (
  id, title, tags, mp3_path, wav_path, has_wav,
  file_size, microphone, duration_seconds,
  source, created_at, updated_at
)
SELECT
  (value->>'id')::uuid,
  value->>'title',
  ARRAY(SELECT jsonb_array_elements_text(value->'tags')),
  -- KV sounds use make-27929102-streaming bucket; prefix path to distinguish
  value->>'streamingFilename',
  NULL,
  false,
  (value->>'fileSize')::bigint,
  value->>'equipment',
  (value->>'duration')::numeric,
  'kv_migration',
  to_timestamp((value->>'createdAt')::bigint / 1000.0),
  now()
FROM kv_store_27929102
WHERE key LIKE 'sound:%'
  AND (value->>'id')::uuid NOT IN (SELECT id FROM sounds)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. MIGRATE KV SUGGESTIONS → suggestions TABLE
-- =============================================================================
-- KV stores suggestions as a single JSON array under key "suggestions_all".
-- The proper suggestions table is currently empty.

INSERT INTO suggestions (
  id, sound_name, description, category, status, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  elem->>'soundName',
  COALESCE(elem->>'description', ''),
  COALESCE(elem->>'category', 'General'),
  CASE WHEN (elem->>'isRead')::boolean THEN 'reviewed' ELSE 'pending' END,
  (elem->>'submittedAt')::timestamptz,
  now()
FROM kv_store_27929102,
     jsonb_array_elements(value) AS elem
WHERE key = 'suggestions_all'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. SYNC KV TAGS → tags TABLE
-- =============================================================================
-- KV has a flat list of tag names under "sfx:tags". The proper tags table
-- already has 251 tags with slugs, colors, icons, and usage counts.
-- Insert any KV tags that are missing from the proper table.

INSERT INTO tags (name, slug, created_at, updated_at)
SELECT
  tag_name,
  lower(replace(tag_name, ' ', '-')),
  now(),
  now()
FROM (
  SELECT jsonb_array_elements_text(value->'tags') AS tag_name
  FROM kv_store_27929102
  WHERE key = 'sfx:tags'
) kv_tags
WHERE NOT EXISTS (
  SELECT 1 FROM tags WHERE lower(tags.name) = lower(tag_name)
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. REFRESH TAG USAGE COUNTS
-- =============================================================================
-- Update usage_count in tags table based on actual sound data.

UPDATE tags
SET usage_count = sub.cnt,
    updated_at = now()
FROM (
  SELECT unnest(tags) AS tag_name, count(*) AS cnt
  FROM sounds
  WHERE deleted_at IS NULL
  GROUP BY tag_name
) sub
WHERE lower(tags.name) = lower(sub.tag_name);

-- =============================================================================
-- 5. ENSURE INDEXES EXIST
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sounds_tags ON sounds USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_sounds_created_at ON sounds (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sounds_title_search ON sounds USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_sounds_deleted_at ON sounds (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions (status);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags (slug);

-- =============================================================================
-- 6. UPDATE SEARCH VECTORS FOR MIGRATED SOUNDS
-- =============================================================================

UPDATE sounds
SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '')
)
WHERE source = 'kv_migration' AND search_vector IS NULL;

COMMIT;

-- =============================================================================
-- 7. TABLES TO DROP (AFTER CONFIRMING MIGRATION)
-- =============================================================================
-- Uncomment and run AFTER verifying the migration is complete and the app
-- is working correctly with the new tables.
--
-- Legacy / _old tables (superseded by proper tables):
-- DROP TABLE IF EXISTS sound_tags_old CASCADE;
-- DROP TABLE IF EXISTS downloads_old CASCADE;
-- DROP TABLE IF EXISTS plays_old CASCADE;
-- DROP TABLE IF EXISTS files_old CASCADE;
-- DROP TABLE IF EXISTS sounds_old CASCADE;
-- DROP TABLE IF EXISTS tags_old CASCADE;
--
-- SFX app KV store (no longer needed):
-- DROP TABLE IF EXISTS kv_store_27929102 CASCADE;
--
-- Unused tables (0 rows, never adopted):
-- DROP TABLE IF EXISTS collection_sounds CASCADE;
-- DROP TABLE IF EXISTS collections CASCADE;
-- DROP TABLE IF EXISTS comments CASCADE;
-- DROP TABLE IF EXISTS favorites CASCADE;
-- DROP TABLE IF EXISTS playlist_items CASCADE;
-- DROP TABLE IF EXISTS "playlistItems" CASCADE;
-- DROP TABLE IF EXISTS playlists CASCADE;
-- DROP TABLE IF EXISTS similar_sounds CASCADE;
-- DROP TABLE IF EXISTS sound_versions CASCADE;
-- DROP TABLE IF EXISTS tag_suggestions CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS "userProfiles" CASCADE;
-- DROP TABLE IF EXISTS audios CASCADE;
--
-- Duplicate reward/task tables (puppy_app_ prefixed versions are the real ones):
-- DROP TABLE IF EXISTS purchases CASCADE;
-- DROP TABLE IF EXISTS reward_purchases CASCADE;
-- DROP TABLE IF EXISTS rewards CASCADE;
-- DROP TABLE IF EXISTS task_badges CASCADE;
-- DROP TABLE IF EXISTS task_submissions CASCADE;
-- DROP TABLE IF EXISTS tasks CASCADE;
-- DROP TABLE IF EXISTS daily_completions CASCADE;
-- DROP TABLE IF EXISTS badges CASCADE;
-- DROP TABLE IF EXISTS user_badges CASCADE;
-- DROP TABLE IF EXISTS user_points CASCADE;
-- DROP TABLE IF EXISTS user_roles CASCADE;
--
-- =============================================================================
-- TABLE INVENTORY AFTER CLEANUP
-- =============================================================================
--
-- SFX Library (core):
--   sounds              - All sound effects with tags, paths, metadata
--   tags                - Master tag list for management UI
--   suggestions         - User-submitted sound suggestions
--   sound_stats         - Play/download counters (FK → sounds)
--   analytics_events    - Detailed event log
--
-- SFX Library (views):
--   mv_popular_sounds   - Materialized: popular sounds ranked by score
--   mv_recent_sounds    - Materialized: latest uploads
--   mv_category_summary - Materialized: per-category stats
--   mv_tag_stats        - Materialized: per-tag usage stats
--   popular_tags        - Materialized: top 100 tags
--   sound_stats_summary - Materialized: overall library stats
--   sound_ratings       - Materialized: rating aggregates
--   v_admin_stats       - View: admin dashboard stats
--
-- Puppy App:
--   puppy_app_badges, puppy_app_tasks, puppy_app_task_badges,
--   puppy_app_task_submissions, puppy_app_user_badges,
--   puppy_app_user_points, puppy_app_user_roles,
--   puppy_app_notifications, puppy_app_praise_messages,
--   puppy_app_rewards, puppy_app_reward_purchases
--
-- Other Apps (separate KV stores):
--   kv_store_5d35ddc9   - Puppy app KV
--   kv_store_a4694f21   - Social app KV
--   kv_store_e1a915dd   - Etsy integration KV
--   app_state           - Shared app state (puppy points)

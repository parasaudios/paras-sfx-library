-- ============================================================================
-- Para SFX Library — Initial Schema
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Sounds table
CREATE TABLE IF NOT EXISTS sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  filename TEXT NOT NULL,
  slug TEXT,
  tags TEXT[] DEFAULT '{}',
  mp3_path TEXT,
  wav_path TEXT,
  has_wav BOOLEAN DEFAULT false,
  file_size BIGINT,
  duration_seconds NUMERIC,
  channels INTEGER,
  microphone TEXT,
  recorder TEXT,
  format TEXT,
  category TEXT,
  nsfw BOOLEAN DEFAULT false,
  listens INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  source TEXT,
  search_vector TSVECTOR,
  deleted_at TIMESTAMPTZ,
  mp3_sample_rate INTEGER,
  mp3_bit_depth INTEGER,
  wav_sample_rate INTEGER,
  wav_bit_depth INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suggestions table
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT,
  usage_count INTEGER DEFAULT 0,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sounds_deleted_at ON sounds (deleted_at);
CREATE INDEX IF NOT EXISTS idx_sounds_search_vector ON sounds USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_sounds_tags ON sounds USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_sounds_created_at ON sounds (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name);

-- ============================================================================
-- SEARCH VECTOR TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION sounds_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sounds_search_vector_trigger
  BEFORE INSERT OR UPDATE ON sounds
  FOR EACH ROW EXECUTE FUNCTION sounds_search_vector_update();

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sounds_updated_at BEFORE UPDATE ON sounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER suggestions_updated_at BEFORE UPDATE ON suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('sounds', 'sounds', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VIEW: sounds_with_urls
-- ============================================================================

CREATE OR REPLACE VIEW sounds_with_urls AS
SELECT
  s.*,
  CASE
    WHEN s.mp3_path IS NOT NULL THEN
      '/storage/v1/object/public/sounds/' || s.mp3_path
    ELSE NULL
  END AS "audioUrl",
  CASE
    WHEN s.wav_path IS NOT NULL AND s.has_wav THEN
      '/storage/v1/object/public/sounds/' || s.wav_path
    WHEN s.mp3_path IS NOT NULL THEN
      '/storage/v1/object/public/sounds/' || s.mp3_path
    ELSE NULL
  END AS "downloadUrl"
FROM sounds s
WHERE s.deleted_at IS NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Public read on sounds_with_urls (view uses underlying table policies)
CREATE POLICY "Public read sounds" ON sounds
  FOR SELECT USING (deleted_at IS NULL);

-- Public insert on suggestions
CREATE POLICY "Public insert suggestions" ON suggestions
  FOR INSERT WITH CHECK (true);

-- Public read suggestions (admin reads all)
CREATE POLICY "Public read suggestions" ON suggestions
  FOR SELECT USING (true);

-- Public read tags
CREATE POLICY "Public read tags" ON tags
  FOR SELECT USING (true);

-- ============================================================================
-- RPC FUNCTIONS (SECURITY DEFINER — bypass RLS for admin ops)
-- ============================================================================

-- Admin: Create sound
CREATE OR REPLACE FUNCTION admin_create_sound(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_sound sounds;
  sound_title TEXT;
  sound_filename TEXT;
BEGIN
  sound_title := input->>'title';
  sound_filename := COALESCE(input->>'filename', LOWER(REPLACE(sound_title, ' ', '-')) || '.mp3');

  INSERT INTO sounds (
    title, filename, description, tags, mp3_path, wav_path, has_wav,
    file_size, microphone, recorder, format, category, nsfw, source
  ) VALUES (
    sound_title,
    sound_filename,
    input->>'description',
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(input->'tags')), '{}'),
    input->>'mp3_path',
    input->>'wav_path',
    COALESCE((input->>'has_wav')::boolean, false),
    (input->>'file_size')::bigint,
    input->>'microphone',
    input->>'recorder',
    input->>'format',
    input->>'category',
    COALESCE((input->>'nsfw')::boolean, false),
    COALESCE(input->>'source', 'upload')
  )
  RETURNING * INTO new_sound;

  RETURN to_jsonb(new_sound);
END;
$$;

-- Admin: Update sound
CREATE OR REPLACE FUNCTION admin_update_sound(sound_id UUID, updates JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_sound sounds;
BEGIN
  UPDATE sounds SET
    title = COALESCE(updates->>'title', title),
    description = CASE WHEN updates ? 'description' THEN updates->>'description' ELSE description END,
    tags = CASE WHEN updates ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(updates->'tags')) ELSE tags END,
    mp3_path = COALESCE(updates->>'mp3_path', mp3_path),
    wav_path = CASE WHEN updates ? 'wav_path' THEN updates->>'wav_path' ELSE wav_path END,
    has_wav = CASE WHEN updates ? 'has_wav' THEN (updates->>'has_wav')::boolean ELSE has_wav END,
    file_size = CASE WHEN updates ? 'file_size' THEN (updates->>'file_size')::bigint ELSE file_size END,
    microphone = CASE WHEN updates ? 'microphone' THEN updates->>'microphone' ELSE microphone END,
    recorder = CASE WHEN updates ? 'recorder' THEN updates->>'recorder' ELSE recorder END,
    format = CASE WHEN updates ? 'format' THEN updates->>'format' ELSE format END,
    category = CASE WHEN updates ? 'category' THEN updates->>'category' ELSE category END,
    nsfw = CASE WHEN updates ? 'nsfw' THEN (updates->>'nsfw')::boolean ELSE nsfw END
  WHERE id = sound_id AND deleted_at IS NULL
  RETURNING * INTO updated_sound;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sound not found: %', sound_id;
  END IF;

  RETURN to_jsonb(updated_sound);
END;
$$;

-- Admin: Soft-delete sound
CREATE OR REPLACE FUNCTION admin_soft_delete_sound(sound_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sounds SET deleted_at = NOW() WHERE id = sound_id AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

-- Admin: Update suggestion
CREATE OR REPLACE FUNCTION admin_update_suggestion(suggestion_id UUID, updates JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_suggestion suggestions;
BEGIN
  UPDATE suggestions SET
    status = COALESCE(updates->>'status', status),
    sound_name = COALESCE(updates->>'sound_name', sound_name),
    description = CASE WHEN updates ? 'description' THEN updates->>'description' ELSE description END,
    category = CASE WHEN updates ? 'category' THEN updates->>'category' ELSE category END
  WHERE id = suggestion_id
  RETURNING * INTO updated_suggestion;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found: %', suggestion_id;
  END IF;

  RETURN to_jsonb(updated_suggestion);
END;
$$;

-- Admin: Delete suggestion (hard delete)
CREATE OR REPLACE FUNCTION admin_delete_suggestion(suggestion_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM suggestions WHERE id = suggestion_id;
  RETURN FOUND;
END;
$$;

-- Public: Submit suggestion
CREATE OR REPLACE FUNCTION submit_suggestion(p_sound_name TEXT, p_category TEXT DEFAULT 'General', p_description TEXT DEFAULT '')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_suggestion suggestions;
BEGIN
  INSERT INTO suggestions (sound_name, category, description, status)
  VALUES (p_sound_name, p_category, p_description, 'pending')
  RETURNING * INTO new_suggestion;

  RETURN to_jsonb(new_suggestion);
END;
$$;

-- Admin: Set tags (replace entire list)
CREATE OR REPLACE FUNCTION admin_set_tags(tag_names TEXT[])
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM tags WHERE name != ALL(tag_names);

  INSERT INTO tags (name, slug)
  SELECT unnest, LOWER(REPLACE(unnest, ' ', '-'))
  FROM unnest(tag_names)
  ON CONFLICT (name) DO NOTHING;

  RETURN (SELECT ARRAY_AGG(name ORDER BY name) FROM tags);
END;
$$;

-- Admin: Add a single tag
CREATE OR REPLACE FUNCTION admin_add_tag(tag_name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO tags (name, slug)
  VALUES (tag_name, LOWER(REPLACE(tag_name, ' ', '-')))
  ON CONFLICT (name) DO NOTHING;

  RETURN (SELECT ARRAY_AGG(name ORDER BY name) FROM tags);
END;
$$;

-- Admin: Remove a single tag
CREATE OR REPLACE FUNCTION admin_remove_tag(tag_name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM tags WHERE name = tag_name;
  RETURN (SELECT ARRAY_AGG(name ORDER BY name) FROM tags);
END;
$$;

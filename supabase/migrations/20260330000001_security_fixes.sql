-- ============================================================================
-- Security Fixes Migration
-- ============================================================================

-- ============================================================================
-- 1. ADD AUTH CHECKS TO ALL ADMIN RPC FUNCTIONS
-- ============================================================================

-- Helper: Check if caller is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$;

-- Admin: Create sound (with auth check)
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

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

-- Admin: Update sound (with auth check)
CREATE OR REPLACE FUNCTION admin_update_sound(sound_id UUID, updates JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_sound sounds;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

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

-- Admin: Soft-delete sound (with auth check)
CREATE OR REPLACE FUNCTION admin_soft_delete_sound(sound_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  UPDATE sounds SET deleted_at = NOW() WHERE id = sound_id AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

-- Admin: Update suggestion (with auth check)
CREATE OR REPLACE FUNCTION admin_update_suggestion(suggestion_id UUID, updates JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_suggestion suggestions;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

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

-- Admin: Delete suggestion (with auth check)
CREATE OR REPLACE FUNCTION admin_delete_suggestion(suggestion_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  DELETE FROM suggestions WHERE id = suggestion_id;
  RETURN FOUND;
END;
$$;

-- Admin: Set tags (with auth check)
CREATE OR REPLACE FUNCTION admin_set_tags(tag_names TEXT[])
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  DELETE FROM tags WHERE name != ALL(tag_names);

  INSERT INTO tags (name, slug)
  SELECT unnest, LOWER(REPLACE(unnest, ' ', '-'))
  FROM unnest(tag_names)
  ON CONFLICT (name) DO NOTHING;

  RETURN (SELECT ARRAY_AGG(name ORDER BY name) FROM tags);
END;
$$;

-- Admin: Add a single tag (with auth check)
CREATE OR REPLACE FUNCTION admin_add_tag(tag_name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  INSERT INTO tags (name, slug)
  VALUES (tag_name, LOWER(REPLACE(tag_name, ' ', '-')))
  ON CONFLICT (name) DO NOTHING;

  RETURN (SELECT ARRAY_AGG(name ORDER BY name) FROM tags);
END;
$$;

-- Admin: Remove a single tag (with auth check)
CREATE OR REPLACE FUNCTION admin_remove_tag(tag_name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  DELETE FROM tags WHERE name = tag_name;
  RETURN (SELECT ARRAY_AGG(name ORDER BY name) FROM tags);
END;
$$;

-- ============================================================================
-- 2. RATE-LIMITED SUGGESTION SUBMISSION
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_suggestion(p_sound_name TEXT, p_category TEXT DEFAULT 'General', p_description TEXT DEFAULT '')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_suggestion suggestions;
  recent_count INTEGER;
  truncated_name TEXT;
  truncated_category TEXT;
  truncated_description TEXT;
BEGIN
  -- Server-side rate limit: max 5 suggestions per minute globally
  SELECT COUNT(*) INTO recent_count
  FROM suggestions
  WHERE created_at > NOW() - INTERVAL '1 minute';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;

  -- Input length validation (truncate to safe limits)
  truncated_name := LEFT(TRIM(p_sound_name), 200);
  truncated_category := LEFT(TRIM(p_category), 100);
  truncated_description := LEFT(TRIM(p_description), 1000);

  IF LENGTH(truncated_name) = 0 THEN
    RAISE EXCEPTION 'Sound name is required';
  END IF;

  INSERT INTO suggestions (sound_name, category, description, status)
  VALUES (truncated_name, truncated_category, truncated_description, 'pending')
  RETURNING * INTO new_suggestion;

  RETURN to_jsonb(new_suggestion);
END;
$$;

-- ============================================================================
-- 3. STORAGE BUCKET RLS POLICIES
-- ============================================================================

-- Enable RLS on storage.objects (may already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Public read access to sounds bucket
CREATE POLICY "Public read sounds bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sounds');

-- Admin-only upload to sounds bucket
CREATE POLICY "Admin upload to sounds bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sounds'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admin-only update in sounds bucket
CREATE POLICY "Admin update sounds bucket"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'sounds'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admin-only delete from sounds bucket
CREATE POLICY "Admin delete from sounds bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'sounds'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================================
-- 4. ADD LENGTH CONSTRAINTS TO SUGGESTIONS TABLE
-- ============================================================================

ALTER TABLE suggestions
  ADD CONSTRAINT suggestions_sound_name_length CHECK (LENGTH(sound_name) <= 200),
  ADD CONSTRAINT suggestions_category_length CHECK (LENGTH(category) <= 100),
  ADD CONSTRAINT suggestions_description_length CHECK (LENGTH(description) <= 1000);

-- ============================================================================
-- 5. CLEANUP: Remove test-tag
-- ============================================================================

DELETE FROM tags WHERE name = 'test-tag';

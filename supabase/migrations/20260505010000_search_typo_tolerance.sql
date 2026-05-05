-- Add typo / fuzzy tolerance to search_sounds via pg_trgm.
--
-- Why: the existing tsvector + ILIKE search returns ZERO results for "kichten"
-- (transposed letters of "kitchen") and similar typos. With ~1,300 sounds the
-- vocabulary is small enough that trigram similarity catches the obvious
-- mistakes without polluting clean queries.
--
-- Strategy:
--   - Tier 1 (current): tsvector tsquery match + ILIKE-on-title fallback
--   - Tier 2 (NEW): pg_trgm similarity on (title || ' ' || tags || ' ' || category)
--                   stored in trgm_haystack (maintained by the existing trigger).
--                   Only fires if Tier 1 returned ZERO so clean queries are
--                   completely unaffected.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Real column maintained by the trigger (generated columns can't use stable
-- functions like array_to_string).
ALTER TABLE public.sounds
  ADD COLUMN IF NOT EXISTS trgm_haystack text;

-- Extend the existing search-vector trigger to also populate trgm_haystack
CREATE OR REPLACE FUNCTION public.sounds_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'D');

  NEW.trgm_haystack :=
    lower(
      COALESCE(NEW.title, '') || ' ' ||
      COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
      COALESCE(NEW.category, '')
    );

  RETURN NEW;
END;
$$;

-- Backfill trgm_haystack for all existing rows (one-shot)
UPDATE public.sounds SET title = title;  -- fires the trigger and populates trgm_haystack

CREATE INDEX IF NOT EXISTS idx_sounds_trgm_haystack
  ON public.sounds USING gin (trgm_haystack gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Two-tier search RPC
CREATE OR REPLACE FUNCTION public.search_sounds(q text, max_results int DEFAULT 50)
  RETURNS SETOF public.sounds_with_urls
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  cleaned_q text;
  prefix_q  text;
  tsq       tsquery;
  tier1_count int;
BEGIN
  cleaned_q := trim(coalesce(q, ''));

  IF cleaned_q = '' THEN
    RETURN QUERY
      SELECT * FROM public.sounds_with_urls
      ORDER BY created_at DESC
      LIMIT max_results;
    RETURN;
  END IF;

  -- Build a prefix tsquery like 'bed:* & thr:*'
  SELECT string_agg(word || ':*', ' & ')
    INTO prefix_q
  FROM (
    SELECT unnest(regexp_split_to_array(
      lower(regexp_replace(cleaned_q, '[^a-zA-Z0-9\s]', ' ', 'g')),
      '\s+'
    )) AS word
  ) w
  WHERE length(word) > 0;

  IF prefix_q IS NOT NULL AND prefix_q <> '' THEN
    BEGIN
      tsq := to_tsquery('english', prefix_q);
    EXCEPTION WHEN OTHERS THEN
      tsq := NULL;
    END;
  END IF;

  -- Tier 1: tsvector + ILIKE
  SELECT count(*) INTO tier1_count
  FROM public.sounds s
  WHERE s.deleted_at IS NULL
    AND (
      (tsq IS NOT NULL AND s.search_vector @@ tsq)
      OR s.title ILIKE '%' || cleaned_q || '%'
    );

  IF tier1_count > 0 THEN
    RETURN QUERY
      SELECT swu.*
      FROM public.sounds_with_urls swu
      LEFT JOIN public.sounds s ON s.id = swu.id
      WHERE
        (tsq IS NOT NULL AND s.search_vector @@ tsq)
        OR swu.title ILIKE '%' || cleaned_q || '%'
      ORDER BY
        CASE WHEN lower(swu.title) = lower(cleaned_q)           THEN 0 ELSE 1 END,
        CASE WHEN lower(swu.title) LIKE lower(cleaned_q) || '%' THEN 0 ELSE 1 END,
        CASE WHEN swu.title ILIKE '%' || cleaned_q || '%'       THEN 0 ELSE 1 END,
        ts_rank(s.search_vector, tsq) DESC NULLS LAST,
        swu.title
      LIMIT max_results;
    RETURN;
  END IF;

  -- Tier 2: trigram fuzzy fallback (typo recovery).  Only runs when Tier 1
  -- yielded zero matches.  similarity threshold of 0.2 is loose enough to
  -- catch transposed letters but tight enough to avoid garbage.
  RETURN QUERY
    SELECT swu.*
    FROM public.sounds_with_urls swu
    JOIN public.sounds s ON s.id = swu.id
    WHERE s.deleted_at IS NULL
      AND s.trgm_haystack IS NOT NULL
      AND similarity(s.trgm_haystack, lower(cleaned_q)) > 0.2
    ORDER BY similarity(s.trgm_haystack, lower(cleaned_q)) DESC, swu.title
    LIMIT max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_sounds(text, int) TO anon, authenticated;

COMMIT;

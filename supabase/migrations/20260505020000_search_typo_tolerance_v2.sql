-- Per-word fuzzy fallback for search_sounds (replaces v1).
--
-- v1 used trigram similarity on a single concatenated `trgm_haystack` string.
-- Problem: when haystacks are long (200+ chars from title + tags + category),
-- the similarity of a 7-char typo like "kichten" against the full haystack
-- drops to ~0.03, which is below any usable threshold. Even
-- word_similarity() suffered: "kichten" matched unrelated rows containing
-- "tightening" higher than rows containing the actual word "kitchen".
--
-- v2 strategy:
--   - Materialize a `trgm_words text[]` column: distinct words (>=3 chars)
--     extracted from title + tags + category, lowercased.
--   - Tier 2 of search_sounds CROSS JOINs query words against haystack words
--     and scores each pair with GREATEST(levenshtein-based similarity,
--     trigram similarity). This finds typos at the WORD level instead of
--     the string level.
--   - levenshtein only counts when both words are >=4 chars and edit
--     distance <= 2 (catches transpositions, single insertions/deletions,
--     and one substitution in mid-sized words without false-positiving on
--     short common words like "the" vs "she").
--   - Threshold 0.55 keeps "kichten" -> "kitchen" (~0.71) and "frigde"
--     -> "fridge" (~0.67) but rejects unrelated trigram noise.

BEGIN;

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Add a per-row words array maintained by the trigger
ALTER TABLE public.sounds
  ADD COLUMN IF NOT EXISTS trgm_words text[];

-- Extend the search-vector trigger to also populate trgm_words
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

  -- Distinct lowercased words >= 3 chars from title + tags + category
  NEW.trgm_words := ARRAY(
    SELECT DISTINCT word
    FROM regexp_split_to_table(
      regexp_replace(NEW.trgm_haystack, '[^a-z0-9\s]', ' ', 'g'),
      '\s+'
    ) AS word
    WHERE length(word) >= 3
  );

  RETURN NEW;
END;
$$;

-- Backfill trgm_words for all existing rows
UPDATE public.sounds SET title = title;

-- Optional GIN index for array equality fallback (cheap to maintain at this scale)
CREATE INDEX IF NOT EXISTS idx_sounds_trgm_words
  ON public.sounds USING gin (trgm_words)
  WHERE deleted_at IS NULL;

-- Replace search_sounds with the per-word fuzzy fallback
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
  query_words text[];
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

  -- Tier 2: per-word fuzzy fallback (typo recovery).
  -- Split the query into distinct words >= 3 chars.
  query_words := ARRAY(
    SELECT DISTINCT word
    FROM regexp_split_to_table(
      lower(regexp_replace(cleaned_q, '[^a-zA-Z0-9\s]', ' ', 'g')),
      '\s+'
    ) AS word
    WHERE length(word) >= 3
  );

  IF array_length(query_words, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    WITH word_pairs AS (
      SELECT
        s.id,
        GREATEST(
          -- levenshtein-based similarity, only when both words >=4 chars and dist <=2
          CASE
            WHEN length(qw) >= 4
             AND length(hw) >= 4
             AND levenshtein(qw, hw) <= 2
            THEN 1.0 - (levenshtein(qw, hw)::float / GREATEST(length(qw), length(hw)))
            ELSE 0
          END,
          -- per-word trigram similarity
          similarity(qw, hw)
        ) AS pair_score
      FROM public.sounds s,
           unnest(s.trgm_words) AS hw,
           unnest(query_words) AS qw
      WHERE s.deleted_at IS NULL
        AND s.trgm_words IS NOT NULL
    ),
    scored AS (
      SELECT id, MAX(pair_score) AS score
      FROM word_pairs
      GROUP BY id
      HAVING MAX(pair_score) >= 0.55
    )
    SELECT swu.*
    FROM public.sounds_with_urls swu
    JOIN scored sc ON sc.id = swu.id
    ORDER BY sc.score DESC, swu.title
    LIMIT max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_sounds(text, int) TO anon, authenticated;

COMMIT;

-- Server-side search RPC.
--
-- Previously the frontend loaded all 1,556 sounds on every search (~100 KB gzip)
-- and filtered in JS. This RPC pushes the work into Postgres using the
-- existing GIN-indexed `search_vector` tsvector column, returning only
-- matching rows - usually under 50.
--
-- Input: q         text    user query (supports multi-word, prefix matching)
--        max_results int    cap (default 50)
-- Output: rows from the public sounds_with_urls view, ranked by relevance.
--
-- Ranking tiers (best first):
--   1. Exact title match  (lower(title) = lower(q))
--   2. Title starts-with  (title ILIKE q || '%')
--   3. Title contains     (title ILIKE '%q%')
--   4. tsvector ts_rank over prefix tsquery
--
-- Matching strategy:
--   - Split query into alphanumeric tokens -> each becomes `token:*` for
--     prefix matching, ANDed together. Handles "wal" -> "walking".
--   - OR title ILIKE fallback catches matches the tsquery misses
--     (e.g. queries with punctuation / very short or non-stemmed tokens).

BEGIN;

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
BEGIN
  cleaned_q := trim(coalesce(q, ''));

  -- Empty query: recent sounds, no search.
  IF cleaned_q = '' THEN
    RETURN QUERY
      SELECT * FROM public.sounds_with_urls
      ORDER BY created_at DESC
      LIMIT max_results;
    RETURN;
  END IF;

  -- Build a prefix tsquery like 'bed:* & thr:*' from alphanumeric tokens.
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
      tsq := NULL;  -- malformed query -> fall back to ILIKE-only
    END;
  END IF;

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_sounds(text, int) TO anon, authenticated;

COMMIT;

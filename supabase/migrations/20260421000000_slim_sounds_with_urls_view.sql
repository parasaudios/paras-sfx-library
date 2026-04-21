-- Slim down sounds_with_urls view for faster public reads.
--
--   - Drop `search_vector` column - large tsvector, only needed server-side for FTS
--   - Drop `deleted_at` column - the view now filters WHERE deleted_at IS NULL
--     so clients never see soft-deleted rows anyway
--   - Push the soft-delete filter into the view itself (one less client mistake
--     and plays nicely with count=exact queries)

BEGIN;

DROP VIEW IF EXISTS public.sounds_with_urls;

CREATE VIEW public.sounds_with_urls AS
SELECT
  s.id,
  s.title,
  s.description,
  s.filename,
  s.slug,
  s.tags,
  s.mp3_path,
  s.wav_path,
  s.has_wav,
  s.file_size,
  s.duration_seconds,
  s.channels,
  s.microphone,
  s.recorder,
  s.format,
  s.category,
  s.nsfw,
  s.listens,
  s.downloads,
  s.source,
  s.mp3_sample_rate,
  s.mp3_bit_depth,
  s.wav_sample_rate,
  s.wav_bit_depth,
  s.created_at,
  s.updated_at,
  CASE
    WHEN s.mp3_path IS NOT NULL THEN '/storage/v1/object/public/sounds/'::text || s.mp3_path
    ELSE NULL::text
  END AS "audioUrl",
  CASE
    WHEN s.wav_path IS NOT NULL AND s.has_wav THEN '/storage/v1/object/public/sounds/'::text || s.wav_path
    WHEN s.mp3_path IS NOT NULL THEN '/storage/v1/object/public/sounds/'::text || s.mp3_path
    ELSE NULL::text
  END AS "downloadUrl"
FROM public.sounds s
WHERE s.deleted_at IS NULL;

-- View inherits RLS from the underlying table (sounds has a public SELECT policy
-- where deleted_at IS NULL, which we re-enforce here for belt-and-suspenders).
ALTER VIEW public.sounds_with_urls SET (security_invoker = on);
GRANT SELECT ON public.sounds_with_urls TO anon, authenticated;

COMMIT;

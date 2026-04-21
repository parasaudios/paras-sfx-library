-- Some sounds were imported with wav_path but no mp3_path (wav-only originals).
-- Previously the view returned audioUrl = NULL for those, which crashed the
-- frontend player. Fall back to the wav when there's no mp3 - browsers play
-- wav just fine via <audio>.

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
  -- audioUrl: prefer mp3 (smaller for streaming), fall back to wav, else null
  CASE
    WHEN s.mp3_path IS NOT NULL THEN '/storage/v1/object/public/sounds/'::text || s.mp3_path
    WHEN s.wav_path IS NOT NULL THEN '/storage/v1/object/public/sounds/'::text || s.wav_path
    ELSE NULL::text
  END AS "audioUrl",
  -- downloadUrl: prefer wav (higher quality), fall back to mp3
  CASE
    WHEN s.wav_path IS NOT NULL AND s.has_wav THEN '/storage/v1/object/public/sounds/'::text || s.wav_path
    WHEN s.mp3_path IS NOT NULL THEN '/storage/v1/object/public/sounds/'::text || s.mp3_path
    WHEN s.wav_path IS NOT NULL THEN '/storage/v1/object/public/sounds/'::text || s.wav_path
    ELSE NULL::text
  END AS "downloadUrl"
FROM public.sounds s
WHERE s.deleted_at IS NULL;

ALTER VIEW public.sounds_with_urls SET (security_invoker = on);
GRANT SELECT ON public.sounds_with_urls TO anon, authenticated;

COMMIT;

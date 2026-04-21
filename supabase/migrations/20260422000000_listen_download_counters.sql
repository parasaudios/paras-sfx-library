-- Add fire-and-forget RPCs the frontend can call to increment
-- listen / download counters on a sound. Public (anon) can call both.
--
-- SECURITY DEFINER so the function bypasses RLS to do the UPDATE,
-- but we limit it to soft-delete-filtered rows and only touch these
-- two specific columns via the function body.

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_listen(sound_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE public.sounds
    SET listens = listens + 1
  WHERE id = sound_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_download(sound_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE public.sounds
    SET downloads = downloads + 1
  WHERE id = sound_id AND deleted_at IS NULL;
END;
$$;

-- Allow anon role to call them (the frontend hits these with the anon key)
GRANT EXECUTE ON FUNCTION public.increment_listen(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_download(uuid) TO anon, authenticated;

COMMIT;

-- Bucket for pre-built library archives (mp3.zip / wav.zip / manifest.txt).
-- Built daily by scripts/build-archives.ps1 and exposed publicly so users
-- can download the entire library in one click instead of zipping in-browser.
--
-- Public read (anon can GET archives), admin only for writes.

INSERT INTO storage.buckets (id, name, public)
VALUES ('archives', 'archives', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Read policy
DROP POLICY IF EXISTS "Public read archives bucket" ON storage.objects;
CREATE POLICY "Public read archives bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'archives');

-- Admin-only writes (the build script bypasses RLS via direct postgres
-- connection so this only matters for any future Studio/REST writes)
DROP POLICY IF EXISTS "Admin upload to archives bucket"  ON storage.objects;
DROP POLICY IF EXISTS "Admin update archives bucket"    ON storage.objects;
DROP POLICY IF EXISTS "Admin delete from archives bucket" ON storage.objects;

CREATE POLICY "Admin upload to archives bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'archives' AND ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

CREATE POLICY "Admin update archives bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'archives' AND ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

CREATE POLICY "Admin delete from archives bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'archives' AND ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

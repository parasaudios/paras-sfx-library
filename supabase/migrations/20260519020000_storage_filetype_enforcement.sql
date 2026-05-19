-- File-type enforcement on the `sounds` storage bucket.
--
-- Today the admin INSERT/UPDATE policies on storage.objects only check
-- that the JWT carries app_metadata.role = 'admin'. If an admin JWT is
-- ever stolen, the attacker could upload arbitrary files (HTML, JS,
-- EXE, etc.) and serve them from sfxlib-api.parasfx.com — which is
-- *cross-origin* from parasfx.com so cookies don't flow, but it lets
-- the attacker host malware on a "trusted-looking" subdomain of yours,
-- and lets phishing pages live on your own domain.
--
-- This migration adds an extension check to the existing admin policies.
-- Only .mp3 and .wav uploads are allowed in the sounds bucket.

BEGIN;

-- INSERT policy
DROP POLICY IF EXISTS "Admin upload to sounds bucket" ON storage.objects;
CREATE POLICY "Admin upload to sounds bucket" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'sounds'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND lower(right(name, 4)) IN ('.mp3', '.wav')
  );

-- UPDATE policy — same check, prevents renaming to an executable
DROP POLICY IF EXISTS "Admin update sounds bucket" ON storage.objects;
CREATE POLICY "Admin update sounds bucket" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'sounds'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  ) WITH CHECK (
    bucket_id = 'sounds'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND lower(right(name, 4)) IN ('.mp3', '.wav')
  );

-- The archives bucket only stores .zip / .txt / .json so add the same
-- extension lock there too.
DROP POLICY IF EXISTS "Admin upload to archives bucket" ON storage.objects;
CREATE POLICY "Admin upload to archives bucket" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'archives'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND (
      lower(right(name, 4)) IN ('.zip', '.txt')
      OR lower(right(name, 5)) = '.json'
    )
  );

DROP POLICY IF EXISTS "Admin update archives bucket" ON storage.objects;
CREATE POLICY "Admin update archives bucket" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'archives'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  ) WITH CHECK (
    bucket_id = 'archives'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND (
      lower(right(name, 4)) IN ('.zip', '.txt')
      OR lower(right(name, 5)) = '.json'
    )
  );

COMMIT;

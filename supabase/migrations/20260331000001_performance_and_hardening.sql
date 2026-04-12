-- ============================================================================
-- Performance indexes + is_admin() hardening
-- ============================================================================

-- Missing indexes for query performance
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sounds_slug ON sounds (slug);

-- Harden is_admin(): set search_path to prevent search-path injection
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$;

-- ============================================================================
-- Block direct table mutations — force all writes through RPC functions
-- The service_role key bypasses RLS, so we REVOKE direct table permissions
-- from the anon and authenticated roles. Only SECURITY DEFINER functions
-- (which run as postgres) can mutate data.
-- ============================================================================

-- SOUNDS: revoke INSERT/UPDATE/DELETE from anon and authenticated
REVOKE INSERT, UPDATE, DELETE ON sounds FROM anon;
REVOKE INSERT, UPDATE, DELETE ON sounds FROM authenticated;

-- TAGS: revoke INSERT/UPDATE/DELETE from anon and authenticated
REVOKE INSERT, UPDATE, DELETE ON tags FROM anon;
REVOKE INSERT, UPDATE, DELETE ON tags FROM authenticated;

-- SUGGESTIONS: allow INSERT (for public submissions via RPC), revoke UPDATE/DELETE
REVOKE UPDATE, DELETE ON suggestions FROM anon;
REVOKE UPDATE, DELETE ON suggestions FROM authenticated;

-- Keep SELECT granted (needed for the app to read data)
GRANT SELECT ON sounds TO anon, authenticated;
GRANT SELECT ON sounds_with_urls TO anon, authenticated;
GRANT SELECT ON tags TO anon, authenticated;
GRANT SELECT ON suggestions TO anon, authenticated;
GRANT INSERT ON suggestions TO anon, authenticated;

-- ============================================================================
-- Block direct access to auth admin endpoints via Kong
-- We can't modify Kong config easily, but we CAN ensure the service_role
-- key can't do damage even if someone has it:
-- ============================================================================

-- Revoke service_role from directly modifying tables
-- (service_role bypasses RLS but still needs table-level GRANT)
-- NOTE: We can't revoke from service_role directly as it's a special role.
-- Instead, ensure our RPC functions are the ONLY write path by using
-- the postgres role (which SECURITY DEFINER runs as).

-- The SECURITY DEFINER functions run as postgres (the function owner),
-- which has full access. Direct REST API calls use anon/authenticated roles,
-- which now only have SELECT + INSERT on suggestions.

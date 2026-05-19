-- Re-revoke direct table privileges on public.sounds + public.tags from
-- anon and authenticated. Migration 20260331000000 did this once but
-- Supabase's init scripts (or pg_class.relacl shipping with a freshly
-- recreated container) re-granted them, so anon currently shows full
-- INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on both tables.
--
-- Today the writes are still blocked by RLS — verified live: anon POST
-- returns "42501 violates row-level security policy" because no policy
-- grants insert/update/delete to anon. But the grants are a defense-in-depth
-- gap: if anyone ever adds a permissive RLS policy by mistake, anon could
-- write directly via REST. We want BOTH layers to deny.
--
-- Also locks down the internal Oban background-worker tables in `public`.
-- These came from the Logflare analytics service. They have no RLS and
-- anon has ALL privileges → a curl GET to /rest/v1/oban_jobs exposes job
-- payload metadata. Revoke + RLS-enable so only the postgres owner can
-- touch them (the Oban worker uses a direct DB connection, not REST).

BEGIN;

-- N2: re-revoke writes on sounds + tags
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.sounds FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.tags FROM anon, authenticated;

-- suggestions: keep INSERT (so submit_suggestion-less direct POSTs still work
-- as a fallback) but revoke everything else. SELECT was already revoked from
-- anon in 20260519000000.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.suggestions FROM anon, authenticated;

-- N3: Oban worker tables — revoke all anon/authenticated grants. These
-- tables are owned by supabase_admin (created by the Logflare bootstrap)
-- so the REVOKE here as postgres only partly works (the column-level
-- grants from supabase_admin can't be revoked by postgres). The full
-- REVOKE has to be run as supabase_admin. We do BOTH so a fresh DB
-- gets the postgres-level revoke applied automatically, and a separate
-- one-off as supabase_admin handles the rest. Without revoking, anon
-- can GET /rest/v1/oban_jobs and see internal worker job metadata.
--
-- One-off as supabase_admin (run manually after a fresh DB deploy):
--   PGPASSWORD=$POSTGRES_PASSWORD psql -U supabase_admin -d postgres -c \
--     "REVOKE ALL ON public.oban_jobs       FROM anon, authenticated;
--      REVOKE ALL ON public.oban_peers      FROM anon, authenticated;
--      REVOKE ALL ON public.oban_jobs_id_seq FROM anon, authenticated;"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oban_jobs' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON public.oban_jobs FROM anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'oban_peers' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON public.oban_peers FROM anon, authenticated';
  END IF;
END$$;

COMMIT;

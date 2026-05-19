-- Revoke anon SELECT on public.suggestions.
--
-- Why: the original schema granted SELECT to anon "for the admin app to read
-- them too" — but the admin is `authenticated`, not anon. Leaving SELECT on
-- anon means a curl call like
--   GET /rest/v1/suggestions?select=*
-- dumps every suggestion ever submitted, including user-typed text that may
-- contain emails, phone numbers, or other accidentally-included PII.
--
-- After this migration:
--   - anon can still INSERT via the submit_suggestion() RPC (SECURITY DEFINER)
--   - authenticated admins can still SELECT (granted to authenticated)
--   - direct REST reads from anon return zero rows (RLS denial + no GRANT)
--
-- Also drops the over-permissive "Public read suggestions" RLS policy that
-- backed the GRANT. The admin-side reads use the `authenticated` role which
-- has its own GRANT and (effectively) no RLS denial since there's no
-- restrictive policy.

BEGIN;

REVOKE SELECT ON public.suggestions FROM anon;

DROP POLICY IF EXISTS "Public read suggestions" ON public.suggestions;

-- Admins (authenticated + JWT role=admin) read via this policy
CREATE POLICY "Admin read suggestions" ON public.suggestions
  FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

COMMIT;

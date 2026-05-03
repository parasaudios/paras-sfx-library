-- Lock SEARCH_PATH on every SECURITY DEFINER function in `public`.
--
-- Why: a SECURITY DEFINER function runs with the OWNER's privileges. If the
-- function's body references unqualified names (`sounds`, `tags`, etc.) and
-- search_path is configurable per session, an attacker who can create a
-- shadow object in a schema higher in search_path could redirect those
-- operations to malicious copies. Pinning search_path to `public` (the
-- schema we actually intend) closes this attack class.
--
-- All 9 functions below were missing the SET; this migration uses
-- ALTER FUNCTION ... SET search_path so we don't need to redefine bodies.
-- Idempotent: ALTER ... SET overrides if already present.

ALTER FUNCTION public.admin_create_sound(jsonb)             SET search_path = public;
ALTER FUNCTION public.admin_update_sound(uuid, jsonb)       SET search_path = public;
ALTER FUNCTION public.admin_soft_delete_sound(uuid)         SET search_path = public;
ALTER FUNCTION public.admin_update_suggestion(uuid, jsonb)  SET search_path = public;
ALTER FUNCTION public.admin_delete_suggestion(uuid)         SET search_path = public;
ALTER FUNCTION public.admin_set_tags(text[])                SET search_path = public;
ALTER FUNCTION public.admin_add_tag(text)                   SET search_path = public;
ALTER FUNCTION public.admin_remove_tag(text)                SET search_path = public;
ALTER FUNCTION public.submit_suggestion(text, text, text)   SET search_path = public;

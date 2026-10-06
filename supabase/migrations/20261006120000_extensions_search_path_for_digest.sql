-- Hosted fix: run_customer_assessment and run_supplier_evaluation compute
-- their input hash with pgcrypto's digest(). Supabase installs pgcrypto in
-- the `extensions` schema, which is not on these functions' fixed
-- search_path (public, pg_temp), so both raised 42883 on every call in the
-- hosted project. Only the search_path changes; the bodies are untouched.
-- `extensions` comes after `public`, and only privileged roles can create
-- objects in it.
--
-- Rollback: alter both functions back to `set search_path = public, pg_temp`.

alter function public.run_customer_assessment(uuid, uuid, jsonb, uuid)
  set search_path = public, extensions, pg_temp;

alter function public.run_supplier_evaluation(uuid, uuid, uuid)
  set search_path = public, extensions, pg_temp;

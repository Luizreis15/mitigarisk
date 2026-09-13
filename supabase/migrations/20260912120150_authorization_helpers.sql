-- TASK-002: tenant and capability authorization helpers.
-- Split out from 20260912120000 because these query public.memberships,
-- public.platform_admins, and public.role_capabilities (created in
-- 20260912120100_identity_and_tenancy.sql): SQL-language function bodies are
-- parsed against real objects at CREATE FUNCTION time, so they must be
-- defined after their tables exist.

-- Active tenant memberships for the current authenticated user. Security
-- definer so RLS policies on other tables can call it without re-entering
-- (and potentially recursing on) the memberships table's own RLS policies.
create or replace function app.current_tenant_ids()
returns setof uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active';
$$;

comment on function app.current_tenant_ids() is
  'Active tenant memberships for auth.uid(). Security definer to avoid recursive RLS on memberships.';

create or replace function app.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  );
$$;

comment on function app.is_platform_admin() is
  'True when auth.uid() is a platform super admin. Security definer, bypasses tenant RLS by design.';

-- Capability check: platform admins pass every check; otherwise the caller
-- must have an active membership in the tenant whose role grants the capability.
-- Capabilities are authoritative; role names are convenience bundles
-- (docs/architecture/PLATFORM-ARCHITECTURE.md).
create or replace function app.has_capability(p_tenant_id uuid, p_capability text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    app.is_platform_admin()
    or exists (
      select 1
      from public.memberships m
      join public.role_capabilities rc on rc.role_key = m.role_key
      where m.tenant_id = p_tenant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and rc.capability_key = p_capability
    );
$$;

comment on function app.has_capability(uuid, text) is
  'Capability-oriented authorization check for a specific tenant. Security definer to avoid recursive RLS.';

revoke all on function app.current_tenant_ids() from public;
revoke all on function app.is_platform_admin() from public;
revoke all on function app.has_capability(uuid, text) from public;
grant execute on function app.current_tenant_ids() to authenticated;
grant execute on function app.is_platform_admin() to authenticated;
grant execute on function app.has_capability(uuid, text) to authenticated;

-- The app schema is intentionally not exposed via PostgREST, so a client
-- cannot call app.has_capability() directly with supabase-js .rpc(). Expose
-- a same-behavior wrapper in public for that one client-facing use case
-- (apps/web/lib/supabase/authorization.ts); RLS policies keep calling the
-- app.* function directly and are unaffected by this wrapper.
-- security definer (not just a passthrough) because resolving app.* inside
-- the function body requires USAGE on schema app, which authenticated does
-- not otherwise have; the schema stays inaccessible for anything else.
create or replace function public.has_capability(p_tenant_id uuid, p_capability text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select app.has_capability(p_tenant_id, p_capability);
$$;

comment on function public.has_capability(uuid, text) is
  'PostgREST-callable wrapper around app.has_capability(uuid, text) for client-side authorization pre-checks.';

revoke all on function public.has_capability(uuid, text) from public;
grant execute on function public.has_capability(uuid, text) to authenticated;

-- Rollback: drop function public.has_capability(uuid, text); drop function
-- app.has_capability(uuid, text); drop function app.is_platform_admin();
-- drop function app.current_tenant_ids();

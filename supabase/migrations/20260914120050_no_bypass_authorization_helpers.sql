-- TASK-023 security correction: dedicated authorization helpers that never
-- grant a platform-administrator bypass.
--
-- app.has_capability() and app.is_platform_admin() (20260912120150_authorization_helpers.sql)
-- are used throughout this codebase specifically because a platform admin
-- IS meant to have a database-level bypass everywhere else, as a deliberate
-- defense-in-depth posture (platform admins are the platform's own
-- operators). This task's own acceptance criteria are stricter for the real
-- supplier evaluation slice and for recording a case decision: "No platform
-- administrator ... produces a successful result" and "Platform
-- administrators receive no operational bypass through the real
-- workspace" are requirements of the *database boundary itself* here, not
-- merely the application layer. These two helpers are the one place that
-- distinction is expressed, so every later policy/RPC that must reject a
-- platform admin calls these instead of app.has_capability()/app.is_platform_admin().

create or replace function app.has_tenant_capability_as_member(p_tenant_id uuid, p_capability text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_capabilities rc on rc.role_key = m.role_key
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rc.capability_key = p_capability
  );
$$;

comment on function app.has_tenant_capability_as_member(uuid, text) is
  'Same shape as app.has_capability(uuid, text) but with no platform-admin bypass: true only for an active tenant membership whose role grants the capability. Used where a platform administrator must never succeed, not merely be discouraged by the UI.';

create or replace function app.is_active_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role_key = 'tenant_admin'
  );
$$;

comment on function app.is_active_tenant_admin(uuid) is
  'True only for an active tenant_admin membership in the given tenant. No platform-admin bypass and no other role, however capable, qualifies: a case decision is Company Admin authority specifically, not a generic case.decide capability route (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md, "Human-approved product decisions").';

revoke all on function app.has_tenant_capability_as_member(uuid, text) from public;
revoke all on function app.is_active_tenant_admin(uuid) from public;
grant execute on function app.has_tenant_capability_as_member(uuid, text) to authenticated;
grant execute on function app.is_active_tenant_admin(uuid) to authenticated;

-- Rollback: drop function app.is_active_tenant_admin(uuid); drop function
-- app.has_tenant_capability_as_member(uuid, text).

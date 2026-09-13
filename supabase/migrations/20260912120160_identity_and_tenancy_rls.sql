-- TASK-002: RLS for identity/tenancy tables.
-- Split from 20260912120100_identity_and_tenancy.sql because these policies
-- call app.is_platform_admin()/app.has_capability(), defined in
-- 20260912120150_authorization_helpers.sql: CREATE POLICY resolves the
-- functions it references at creation time, so they must already exist.

alter table public.tenants enable row level security;
alter table public.capabilities enable row level security;
alter table public.roles enable row level security;
alter table public.role_capabilities enable row level security;
alter table public.platform_admins enable row level security;
alter table public.memberships enable row level security;

-- Reference data: readable by any authenticated caller, writable only through
-- migrations (service_role bypasses RLS; no policy grants client writes).
create policy capabilities_select on public.capabilities
  for select to authenticated using (true);

create policy roles_select on public.roles
  for select to authenticated using (true);

create policy role_capabilities_select on public.role_capabilities
  for select to authenticated using (true);

-- Platform admins: visible only to other platform admins; never client-writable.
create policy platform_admins_select on public.platform_admins
  for select to authenticated using (app.is_platform_admin());

-- Tenants: visible to members and platform admins; provisioning and settings
-- changes require the corresponding capability.
create policy tenants_select on public.tenants
  for select to authenticated using (
    app.is_platform_admin() or id in (select app.current_tenant_ids())
  );

create policy tenants_insert on public.tenants
  for insert to authenticated with check (app.is_platform_admin());

create policy tenants_update on public.tenants
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(id, 'tenant.manage_settings'))
  with check (app.is_platform_admin() or app.has_capability(id, 'tenant.manage_settings'));

-- No delete policy: tenant offboarding is a controlled, out-of-scope process.

-- Memberships: a user always sees their own row; broader visibility and all
-- writes require tenant.view / tenant.manage_members respectively.
create policy memberships_select on public.memberships
  for select to authenticated using (
    app.is_platform_admin()
    or user_id = auth.uid()
    or app.has_capability(tenant_id, 'tenant.view')
  );

create policy memberships_insert on public.memberships
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'tenant.manage_members')
  );

create policy memberships_update on public.memberships
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'tenant.manage_members'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'tenant.manage_members'));

-- No delete policy: membership removal is a status change ('removed'), which
-- preserves the audit trail of who was ever a member.

-- Rollback: drop the policies above, then `alter table ... disable row level
-- security` on each table listed above.

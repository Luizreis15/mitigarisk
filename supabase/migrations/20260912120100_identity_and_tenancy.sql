-- TASK-002: identity and access + tenancy bounded contexts.
-- Roles are convenience bundles of capabilities; authorization checks must
-- always test capabilities (app.has_capability), never role names directly.

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite unique target for tenant-scoped composite foreign keys below.
  unique (id, status)
);

create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function app.set_updated_at();

create table if not exists public.capabilities (
  key text primary key,
  description text not null
);

create table if not exists public.roles (
  key text primary key,
  name text not null,
  description text not null
);

create table if not exists public.role_capabilities (
  role_key text not null references public.roles (key) on delete cascade,
  capability_key text not null references public.capabilities (key) on delete cascade,
  primary key (role_key, capability_key)
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_key text not null references public.roles (key),
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'removed')),
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists idx_memberships_tenant_id on public.memberships (tenant_id);
create index if not exists idx_memberships_user_id on public.memberships (user_id);

create trigger trg_memberships_updated_at
  before update on public.memberships
  for each row execute function app.set_updated_at();

-- Reference data seeds (roles/capabilities are platform-defined, not tenant data).
insert into public.capabilities (key, description) values
  ('platform.manage_tenants', 'Provision, suspend, and administer tenants platform-wide.'),
  ('tenant.manage_settings', 'Edit tenant profile and settings.'),
  ('tenant.manage_members', 'Invite, change roles, or remove tenant members.'),
  ('tenant.view', 'View tenant profile and membership roster.'),
  ('policy.manage', 'Create and edit draft risk policy versions, factors, and thresholds.'),
  ('policy.publish', 'Publish a draft risk policy version, making it immutable.'),
  ('policy.view', 'View risk policy versions, factors, and thresholds.'),
  ('evaluation.run', 'Trigger onboarding evaluations and record their outcome.'),
  ('evaluation.view', 'View evaluations and their reason codes.'),
  ('case.manage', 'Create, assign, and update the status of cases and their evidence.'),
  ('case.decide', 'Record a human decision on a case.'),
  ('case.view', 'View cases, evidence, and decisions.'),
  ('audit.view', 'View the tenant audit trail.'),
  ('integration.manage', 'Manage API clients and webhook endpoints.'),
  ('integration.view', 'View API clients and webhook delivery history.'),
  ('notification.manage', 'Manage notification templates and requests.'),
  ('notification.view', 'View notification requests and their delivery status.')
on conflict (key) do nothing;

insert into public.roles (key, name, description) values
  ('platform_super_admin', 'Platform super admin', 'Full platform access across all tenants; membership is not tenant-scoped.'),
  ('tenant_admin', 'Tenant owner/admin', 'Full administrative access within a single tenant.'),
  ('risk_analyst', 'Risk analyst', 'Designs and evaluates risk policy; decides cases.'),
  ('operator', 'Operator', 'Runs evaluations and works cases day to day.'),
  ('auditor', 'Auditor / read-only', 'Read-only access across a tenant for audit and compliance review.'),
  ('integration_developer', 'Developer / integration', 'Manages API clients, webhooks, and notification templates.')
on conflict (key) do nothing;

insert into public.role_capabilities (role_key, capability_key) values
  ('platform_super_admin', 'platform.manage_tenants'),
  ('tenant_admin', 'tenant.manage_settings'),
  ('tenant_admin', 'tenant.manage_members'),
  ('tenant_admin', 'tenant.view'),
  ('tenant_admin', 'policy.manage'),
  ('tenant_admin', 'policy.publish'),
  ('tenant_admin', 'policy.view'),
  ('tenant_admin', 'evaluation.run'),
  ('tenant_admin', 'evaluation.view'),
  ('tenant_admin', 'case.manage'),
  ('tenant_admin', 'case.decide'),
  ('tenant_admin', 'case.view'),
  ('tenant_admin', 'audit.view'),
  ('tenant_admin', 'integration.manage'),
  ('tenant_admin', 'integration.view'),
  ('tenant_admin', 'notification.manage'),
  ('tenant_admin', 'notification.view'),
  ('risk_analyst', 'policy.manage'),
  ('risk_analyst', 'policy.view'),
  ('risk_analyst', 'evaluation.run'),
  ('risk_analyst', 'evaluation.view'),
  ('risk_analyst', 'case.view'),
  ('risk_analyst', 'case.decide'),
  ('risk_analyst', 'audit.view'),
  ('operator', 'evaluation.run'),
  ('operator', 'evaluation.view'),
  ('operator', 'case.manage'),
  ('operator', 'case.view'),
  ('operator', 'notification.view'),
  ('auditor', 'tenant.view'),
  ('auditor', 'policy.view'),
  ('auditor', 'evaluation.view'),
  ('auditor', 'case.view'),
  ('auditor', 'audit.view'),
  ('auditor', 'integration.view'),
  ('auditor', 'notification.view'),
  ('integration_developer', 'integration.manage'),
  ('integration_developer', 'integration.view'),
  ('integration_developer', 'notification.manage'),
  ('integration_developer', 'notification.view'),
  ('integration_developer', 'policy.view'),
  ('integration_developer', 'evaluation.view')
on conflict do nothing;

-- Row level security for these tables lives in
-- 20260912120160_identity_and_tenancy_rls.sql, after
-- 20260912120150_authorization_helpers.sql defines the functions the
-- policies call (CREATE POLICY resolves referenced functions immediately).

-- Rollback: drop the tables created above, in reverse dependency order
-- (memberships, platform_admins, role_capabilities, roles, capabilities,
-- tenants). No data migration is required because this migration only ever
-- creates objects.

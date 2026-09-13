-- TASK-002: notifications bounded context.
-- Templates may be platform-wide (tenant_id is null) or tenant-scoped.
-- Platform-wide templates are not tenant-owned data and are managed only by
-- platform admins. Requests are always tenant-owned and are never deleted,
-- so delivery/bounce/complaint history stays available for support and audit.
-- No real send happens here or anywhere in this task: this only models the
-- request/delivery-state contract described in
-- docs/architecture/PLATFORM-ARCHITECTURE.md (Resend boundary).

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  key text not null,
  locale text not null default 'en-US',
  subject text not null,
  body text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key, locale)
);

create index if not exists idx_notification_templates_tenant_id on public.notification_templates (tenant_id);

create trigger trg_notification_templates_updated_at
  before update on public.notification_templates
  for each row execute function app.set_updated_at();

create table if not exists public.notification_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_key text not null,
  locale text not null default 'en-US',
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'bounced', 'complained', 'suppressed')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists idx_notification_requests_tenant_id on public.notification_requests (tenant_id);
create index if not exists idx_notification_requests_provider_message_id
  on public.notification_requests (provider_message_id);

create trigger trg_notification_requests_updated_at
  before update on public.notification_requests
  for each row execute function app.set_updated_at();

-- Row level security ----------------------------------------------------------

alter table public.notification_templates enable row level security;
alter table public.notification_requests enable row level security;

create policy notification_templates_select on public.notification_templates
  for select to authenticated using (
    tenant_id is null
    or app.is_platform_admin()
    or app.has_capability(tenant_id, 'notification.view')
  );

create policy notification_templates_write on public.notification_templates
  for all to authenticated
  using (
    (tenant_id is null and app.is_platform_admin())
    or (tenant_id is not null and app.has_capability(tenant_id, 'notification.manage'))
  )
  with check (
    (tenant_id is null and app.is_platform_admin())
    or (tenant_id is not null and app.has_capability(tenant_id, 'notification.manage'))
  );

create policy notification_requests_select on public.notification_requests
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'notification.view')
  );

create policy notification_requests_insert on public.notification_requests
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'notification.manage')
  );

create policy notification_requests_update on public.notification_requests
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'notification.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'notification.manage'));

-- No delete policy on either table: template history and delivery state are retained.

-- Rollback: drop the policies and tables above (notification_requests,
-- notification_templates). No data migration is required because this
-- migration only ever creates objects.

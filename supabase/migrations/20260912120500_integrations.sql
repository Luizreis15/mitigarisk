-- TASK-002: integrations bounded context.
-- Only key/secret hashes are ever stored; raw secrets are generated and shown
-- once by server-side code and never persisted. Clients and endpoints are
-- revoked/disabled via status, never deleted, so delivery history stays
-- attributable. Deliveries are idempotent per (endpoint, idempotency_key).

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  key_id text not null unique,
  key_hash text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id)
);

create index if not exists idx_api_clients_tenant_id on public.api_clients (tenant_id);

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  url text not null,
  secret_hash text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists idx_webhook_endpoints_tenant_id on public.webhook_endpoints (tenant_id);

create trigger trg_webhook_endpoints_updated_at
  before update on public.webhook_endpoints
  for each row execute function app.set_updated_at();

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  endpoint_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed', 'dead_letter')),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  response_code integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint_id, idempotency_key),
  foreign key (endpoint_id, tenant_id)
    references public.webhook_endpoints (id, tenant_id) on delete cascade
);

create index if not exists idx_webhook_deliveries_tenant_id on public.webhook_deliveries (tenant_id);
create index if not exists idx_webhook_deliveries_pending on public.webhook_deliveries (status, next_attempt_at);

create trigger trg_webhook_deliveries_updated_at
  before update on public.webhook_deliveries
  for each row execute function app.set_updated_at();

-- Row level security ----------------------------------------------------------

alter table public.api_clients enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy api_clients_select on public.api_clients
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'integration.view')
  );

create policy api_clients_write on public.api_clients
  for all to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'));

-- No delete policy: clients are revoked via status, never removed.

create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'integration.view')
  );

create policy webhook_endpoints_write on public.webhook_endpoints
  for all to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'));

-- No delete policy: endpoints are disabled via status, never removed.

create policy webhook_deliveries_select on public.webhook_deliveries
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'integration.view')
  );

create policy webhook_deliveries_insert on public.webhook_deliveries
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage')
  );

create policy webhook_deliveries_update on public.webhook_deliveries
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'));

-- No delete policy: delivery history is retained for observability and audit.

-- Rollback: drop the policies and tables above (webhook_deliveries,
-- webhook_endpoints, api_clients). No data migration is required because
-- this migration only ever creates objects.

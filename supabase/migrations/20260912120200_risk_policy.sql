-- TASK-002: risk policy bounded context.
-- Published policy versions (and their factors/thresholds) are immutable:
-- the only allowed status transition after publication is published -> archived,
-- and even that may not touch any other column. This is enforced by triggers,
-- not just application code, so it holds regardless of the calling role.

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  effective_from timestamptz,
  published_at timestamptz,
  published_by uuid references auth.users (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, version_number),
  unique (id, tenant_id)
);

create index if not exists idx_policy_versions_tenant_id on public.policy_versions (tenant_id);

create trigger trg_policy_versions_updated_at
  before update on public.policy_versions
  for each row execute function app.set_updated_at();

create table if not exists public.policy_factors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  key text not null,
  label text not null,
  weight numeric not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (policy_version_id, key),
  foreign key (policy_version_id, tenant_id)
    references public.policy_versions (id, tenant_id) on delete cascade
);

create index if not exists idx_policy_factors_tenant_id on public.policy_factors (tenant_id);
create index if not exists idx_policy_factors_policy_version_id on public.policy_factors (policy_version_id);

create table if not exists public.policy_thresholds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  label text not null,
  min_score numeric not null,
  max_score numeric not null,
  decision_band text not null check (decision_band in ('approve', 'review', 'reject')),
  created_at timestamptz not null default now(),
  check (min_score <= max_score),
  foreign key (policy_version_id, tenant_id)
    references public.policy_versions (id, tenant_id) on delete cascade
);

create index if not exists idx_policy_thresholds_tenant_id on public.policy_thresholds (tenant_id);
create index if not exists idx_policy_thresholds_policy_version_id on public.policy_thresholds (policy_version_id);

-- Immutability enforcement ----------------------------------------------------

create or replace function app.forbid_published_policy_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('published', 'archived') then
    if tg_op = 'DELETE' then
      raise exception 'Published policy version % cannot be deleted', old.id using errcode = '23001';
    end if;

    if old.status = 'published' and new.status = 'archived'
       and new.id = old.id
       and new.tenant_id = old.tenant_id
       and new.version_number = old.version_number
       and new.effective_from is not distinct from old.effective_from
       and new.published_at is not distinct from old.published_at
       and new.published_by is not distinct from old.published_by
       and new.created_by = old.created_by
       and new.created_at = old.created_at
    then
      return new; -- the only allowed change: draft archival lifecycle end.
    end if;

    raise exception 'Published policy version % is immutable', old.id using errcode = '23001';
  end if;

  return new;
end;
$$;

create trigger trg_policy_versions_immutable
  before update or delete on public.policy_versions
  for each row execute function app.forbid_published_policy_version_mutation();

create or replace function app.forbid_children_when_not_draft()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_row record;
begin
  v_row := coalesce(new, old);
  select status into v_status from public.policy_versions where id = v_row.policy_version_id;
  if v_status is distinct from 'draft' then
    raise exception 'Cannot modify % once the parent policy version is not draft', tg_table_name
      using errcode = '23001';
  end if;
  return v_row;
end;
$$;

create trigger trg_policy_factors_guard
  before insert or update or delete on public.policy_factors
  for each row execute function app.forbid_children_when_not_draft();

create trigger trg_policy_thresholds_guard
  before insert or update or delete on public.policy_thresholds
  for each row execute function app.forbid_children_when_not_draft();

-- Row level security ----------------------------------------------------------

alter table public.policy_versions enable row level security;
alter table public.policy_factors enable row level security;
alter table public.policy_thresholds enable row level security;

create policy policy_versions_select on public.policy_versions
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'policy.view')
  );

create policy policy_versions_insert on public.policy_versions
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'policy.manage')
  );

-- Publishing (status -> 'published') additionally requires policy.publish;
-- draft edits only require policy.manage. The immutability trigger above is
-- the hard backstop regardless of what a policy allows.
create policy policy_versions_update on public.policy_versions
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'policy.manage'))
  with check (
    app.is_platform_admin()
    or (
      app.has_capability(tenant_id, 'policy.manage')
      and (status is distinct from 'published' or app.has_capability(tenant_id, 'policy.publish'))
    )
  );

create policy policy_versions_delete on public.policy_versions
  for delete to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'policy.manage')
  );

create policy policy_factors_select on public.policy_factors
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'policy.view')
  );

create policy policy_factors_write on public.policy_factors
  for all to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'policy.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'policy.manage'));

create policy policy_thresholds_select on public.policy_thresholds
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'policy.view')
  );

create policy policy_thresholds_write on public.policy_thresholds
  for all to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'policy.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'policy.manage'));

-- Rollback: drop the policies, triggers, and tables above (policy_thresholds,
-- policy_factors, policy_versions) then drop the two guard functions. No data
-- migration is required because this migration only ever creates objects.

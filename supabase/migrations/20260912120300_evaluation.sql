-- TASK-002: evaluation bounded context.
-- An evaluation is a deterministic scoring run against an immutable published
-- policy version. Its decision_band is a recommendation only; it never
-- silently becomes the tenant's final business decision (see cases).
-- Completed/failed evaluations and their reason codes are immutable evidence.

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions (id),
  subject_reference text not null,
  input_hash text not null,
  normalized_input jsonb not null,
  score numeric,
  decision_band text check (decision_band in ('approve', 'review', 'reject')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  correlation_id uuid not null,
  actor_id uuid references auth.users (id),
  actor_type text not null default 'user' check (actor_type in ('user', 'service')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, correlation_id),
  unique (id, tenant_id)
);

create index if not exists idx_evaluations_tenant_id on public.evaluations (tenant_id);
create index if not exists idx_evaluations_policy_version_id on public.evaluations (policy_version_id);

create trigger trg_evaluations_updated_at
  before update on public.evaluations
  for each row execute function app.set_updated_at();

create table if not exists public.evaluation_reason_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  evaluation_id uuid not null,
  code text not null,
  description text not null,
  weight_contribution numeric,
  created_at timestamptz not null default now(),
  foreign key (evaluation_id, tenant_id)
    references public.evaluations (id, tenant_id) on delete cascade
);

create index if not exists idx_evaluation_reason_codes_tenant_id on public.evaluation_reason_codes (tenant_id);
create index if not exists idx_evaluation_reason_codes_evaluation_id on public.evaluation_reason_codes (evaluation_id);

-- Immutability enforcement ----------------------------------------------------

create or replace function app.forbid_completed_evaluation_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('completed', 'failed') then
    raise exception 'Evaluation % is immutable once %', old.id, old.status using errcode = '23001';
  end if;
  return new;
end;
$$;

create trigger trg_evaluations_immutable
  before update or delete on public.evaluations
  for each row execute function app.forbid_completed_evaluation_mutation();

create or replace function app.forbid_reason_code_mutation_after_completion()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_row record;
begin
  v_row := coalesce(new, old);
  select status into v_status from public.evaluations where id = v_row.evaluation_id;
  if v_status in ('completed', 'failed') then
    raise exception 'Cannot modify reason codes once evaluation % is %', v_row.evaluation_id, v_status
      using errcode = '23001';
  end if;
  return v_row;
end;
$$;

create trigger trg_evaluation_reason_codes_guard
  before insert or update or delete on public.evaluation_reason_codes
  for each row execute function app.forbid_reason_code_mutation_after_completion();

-- Row level security ----------------------------------------------------------

alter table public.evaluations enable row level security;
alter table public.evaluation_reason_codes enable row level security;

create policy evaluations_select on public.evaluations
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.view')
  );

create policy evaluations_insert on public.evaluations
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run')
  );

create policy evaluations_update on public.evaluations
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'));

-- No delete policy: evaluations are append-only evidence regardless of status.

create policy evaluation_reason_codes_select on public.evaluation_reason_codes
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.view')
  );

create policy evaluation_reason_codes_insert on public.evaluation_reason_codes
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run')
  );

create policy evaluation_reason_codes_update on public.evaluation_reason_codes
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'));

-- No delete policy: reason codes are append-only evidence.

-- Rollback: drop the policies, triggers, and tables above
-- (evaluation_reason_codes, evaluations) then drop the two guard functions.
-- No data migration is required because this migration only ever creates objects.

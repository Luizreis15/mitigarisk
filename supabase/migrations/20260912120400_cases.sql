-- TASK-002: cases bounded context.
-- A case carries the human decision that an evaluation's recommendation feeds
-- into. Evidence and decisions are append-only: correcting a mistake means
-- adding a new evidence/decision row, never editing or deleting a prior one.

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  evaluation_id uuid references public.evaluations (id),
  status text not null default 'open' check (status in ('open', 'in_review', 'escalated', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users (id),
  sla_due_at timestamptz,
  opened_by uuid not null references auth.users (id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists idx_cases_tenant_id on public.cases (tenant_id);
create index if not exists idx_cases_evaluation_id on public.cases (evaluation_id);

create trigger trg_cases_updated_at
  before update on public.cases
  for each row execute function app.set_updated_at();

create table if not exists public.case_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_id uuid not null,
  kind text not null,
  storage_ref text not null,
  sha256 text not null,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (case_id, tenant_id) references public.cases (id, tenant_id) on delete cascade
);

create index if not exists idx_case_evidence_tenant_id on public.case_evidence (tenant_id);
create index if not exists idx_case_evidence_case_id on public.case_evidence (case_id);

create trigger trg_case_evidence_append_only
  before update or delete on public.case_evidence
  for each row execute function app.forbid_mutation();

create table if not exists public.case_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_id uuid not null,
  decision text not null check (decision in ('approve', 'reject', 'escalate', 'request_more_info')),
  rationale text not null,
  decided_by uuid not null references auth.users (id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (case_id, tenant_id) references public.cases (id, tenant_id) on delete cascade
);

create index if not exists idx_case_decisions_tenant_id on public.case_decisions (tenant_id);
create index if not exists idx_case_decisions_case_id on public.case_decisions (case_id);

create trigger trg_case_decisions_append_only
  before update or delete on public.case_decisions
  for each row execute function app.forbid_mutation();

-- Row level security ----------------------------------------------------------

alter table public.cases enable row level security;
alter table public.case_evidence enable row level security;
alter table public.case_decisions enable row level security;

create policy cases_select on public.cases
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'case.view')
  );

create policy cases_insert on public.cases
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'case.manage')
  );

create policy cases_update on public.cases
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'case.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'case.manage'));

-- No delete policy: cases are closed via status, never removed.

create policy case_evidence_select on public.case_evidence
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'case.view')
  );

create policy case_evidence_insert on public.case_evidence
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'case.manage')
  );

-- No update/delete policy: enforced again at the trigger level above.

create policy case_decisions_select on public.case_decisions
  for select to authenticated using (
    app.is_platform_admin() or app.has_capability(tenant_id, 'case.view')
  );

create policy case_decisions_insert on public.case_decisions
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'case.decide')
  );

-- No update/delete policy: enforced again at the trigger level above.

-- Rollback: drop the policies, triggers, and tables above (case_decisions,
-- case_evidence, cases). No data migration is required because this
-- migration only ever creates objects.

-- TASK-025: immutable Company Admin final decision for a completed supplier
-- evaluation. The engine recommendation remains on evaluations.decision_band;
-- this table stores a separate human business fact.

create table public.supplier_final_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  supplier_id uuid not null,
  evaluation_id uuid not null,
  policy_version_id uuid not null,
  decision text not null check (decision in ('approve', 'review', 'reject')),
  rationale text check (rationale is null or (rationale = btrim(rationale) and char_length(rationale) between 1 and 500)),
  correlation_id uuid not null,
  decided_by uuid not null references auth.users (id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (supplier_id, tenant_id) references public.suppliers (id, tenant_id),
  foreign key (evaluation_id, tenant_id) references public.evaluations (id, tenant_id),
  foreign key (policy_version_id, tenant_id) references public.policy_versions (id, tenant_id),
  unique (tenant_id, evaluation_id),
  unique (tenant_id, correlation_id),
  unique (id, tenant_id)
);

create index idx_supplier_final_decisions_supplier on public.supplier_final_decisions (tenant_id, supplier_id);

create trigger trg_supplier_final_decisions_append_only
  before update or delete on public.supplier_final_decisions
  for each row execute function app.forbid_mutation();

alter table public.supplier_final_decisions enable row level security;

create policy supplier_final_decisions_select on public.supplier_final_decisions
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'evaluation.view')
  );

revoke insert, update, delete on public.supplier_final_decisions from authenticated, anon;
grant select on public.supplier_final_decisions to authenticated;

create or replace function public.can_record_supplier_final_decision(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select app.is_active_tenant_admin(p_tenant_id);
$$;

revoke all on function public.can_record_supplier_final_decision(uuid) from public;
grant execute on function public.can_record_supplier_final_decision(uuid) to authenticated;

create or replace function public.record_supplier_final_decision(
  p_tenant_id uuid,
  p_evaluation_id uuid,
  p_decision text,
  p_rationale text,
  p_correlation_id uuid
) returns public.supplier_final_decisions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evaluation public.evaluations;
  v_existing public.supplier_final_decisions;
  v_result public.supplier_final_decisions;
  v_rationale text := nullif(btrim(p_rationale), '');
begin
  if not app.is_active_tenant_admin(p_tenant_id) then
    raise exception 'Final supplier decision requires an active tenant admin' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approve', 'review', 'reject') then
    raise exception 'Invalid supplier final decision' using errcode = '22023';
  end if;
  if v_rationale is not null and char_length(v_rationale) > 500 then
    raise exception 'Supplier final decision rationale is too long' using errcode = '22001';
  end if;

  select * into v_evaluation
  from public.evaluations
  where id = p_evaluation_id
    and tenant_id = p_tenant_id
    and supplier_id is not null
    and status = 'completed';

  if not found then
    raise exception 'Completed supplier evaluation not found' using errcode = 'P0002';
  end if;

  -- Serialize all decisions for one evaluation so concurrent retries cannot
  -- race past the uniqueness checks.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_evaluation_id::text, 0));

  select * into v_existing from public.supplier_final_decisions
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;
  if found then
    if v_existing.evaluation_id = p_evaluation_id
       and v_existing.decision = p_decision
       and v_existing.rationale is not distinct from v_rationale then
      return v_existing;
    end if;
    raise exception 'Correlation identifier conflicts with an existing final decision' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.supplier_final_decisions
    where tenant_id = p_tenant_id and evaluation_id = p_evaluation_id
  ) then
    raise exception 'A final decision already exists for this evaluation' using errcode = '23505';
  end if;

  insert into public.supplier_final_decisions (
    tenant_id, supplier_id, evaluation_id, policy_version_id, decision,
    rationale, correlation_id, decided_by
  ) values (
    p_tenant_id, v_evaluation.supplier_id, v_evaluation.id,
    v_evaluation.policy_version_id, p_decision, v_rationale,
    p_correlation_id, auth.uid()
  ) returning * into v_result;

  perform public.record_audit_event(
    p_tenant_id,
    'supplier.final_decision_recorded',
    'supplier_final_decision',
    v_result.id::text,
    p_correlation_id,
    jsonb_build_object(
      'supplier_id', v_result.supplier_id,
      'evaluation_id', v_result.evaluation_id,
      'policy_version_id', v_result.policy_version_id,
      'recommendation', v_evaluation.decision_band,
      'decision', v_result.decision,
      'outcome', 'recorded'
    )
  );

  return v_result;
end;
$$;

revoke all on function public.record_supplier_final_decision(uuid, uuid, text, text, uuid) from public;
grant execute on function public.record_supplier_final_decision(uuid, uuid, text, text, uuid) to authenticated;

comment on table public.supplier_final_decisions is
  'Immutable Company Admin business decisions, separate from deterministic evaluation recommendations.';

-- Remediation/rollback: stop calling the RPC and revoke EXECUTE. Preserve
-- this table and its append-only audit evidence; do not destructively drop
-- production decisions. A later forward migration may archive the feature.

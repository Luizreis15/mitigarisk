-- Customer onboarding decisions: the human decision on a CRA result that
-- requires sign-off (outcome REVIEW_REQUIRED: high risk, EDD, PEP...).
--
-- MITIGA recommends; the entity decides (AMLR Art. 18). The decision is
-- recorded as immutable evidence, separate from the deterministic
-- assessment, mirroring public.supplier_final_decisions.
--
-- Chain (Lucimara's process, P1.8): the MLRO approves, rejects or escalates.
-- The board decides only when the MLRO escalates. One decision per level
-- per assessment; a decision always targets the customer's latest
-- assessment, so a re-assessment opens a new decision.

create table public.customer_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  assessment_id uuid not null,
  level text not null check (level in ('mlro', 'board')),
  decision text not null check (decision in ('approve', 'reject', 'escalate')),
  rationale text not null check (rationale = btrim(rationale) and char_length(rationale) between 10 and 1000),
  correlation_id uuid not null,
  decided_by uuid not null references auth.users (id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (level = 'mlro' or decision <> 'escalate'),
  foreign key (customer_id, tenant_id) references public.customers (id, tenant_id),
  unique (tenant_id, assessment_id, level),
  unique (tenant_id, correlation_id),
  unique (id, tenant_id)
);

-- customer_assessments has no (id, tenant_id) unique key yet; add it so the
-- decision can reference the assessment within the same tenant.
alter table public.customer_assessments
  add constraint customer_assessments_id_tenant_key unique (id, tenant_id);

alter table public.customer_decisions
  add constraint customer_decisions_assessment_fkey
  foreign key (assessment_id, tenant_id) references public.customer_assessments (id, tenant_id);

create index idx_customer_decisions_customer on public.customer_decisions (tenant_id, customer_id);

create trigger trg_customer_decisions_append_only
  before update or delete on public.customer_decisions
  for each row execute function app.forbid_mutation();

alter table public.customer_decisions enable row level security;

create policy customer_decisions_select on public.customer_decisions
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'customer.view')
  );

revoke insert, update, delete on public.customer_decisions from authenticated, anon;
grant select on public.customer_decisions to authenticated;

create or replace function public.record_customer_decision(
  p_tenant_id uuid,
  p_assessment_id uuid,
  p_decision text,
  p_rationale text,
  p_correlation_id uuid
) returns public.customer_decisions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment public.customer_assessments;
  v_existing public.customer_decisions;
  v_mlro public.customer_decisions;
  v_level text;
  v_result public.customer_decisions;
  v_rationale text := btrim(coalesce(p_rationale, ''));
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'case.decide') then
    raise exception 'Missing case.decide capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approve', 'reject', 'escalate') then
    raise exception 'Invalid customer decision' using errcode = '22023';
  end if;

  if char_length(v_rationale) < 10 then
    raise exception 'A decision rationale of at least 10 characters is required' using errcode = '22023';
  end if;
  if char_length(v_rationale) > 1000 then
    raise exception 'Customer decision rationale is too long' using errcode = '22001';
  end if;

  if p_correlation_id is null then
    raise exception 'A correlation identifier is required' using errcode = '22023';
  end if;

  select * into v_assessment
  from public.customer_assessments
  where id = p_assessment_id and tenant_id = p_tenant_id;
  if not found then
    raise exception 'Customer assessment not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_assessment_id::text, 0));

  -- Idempotent replay on the correlation identifier.
  select * into v_existing from public.customer_decisions
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;
  if found then
    if v_existing.assessment_id = p_assessment_id
       and v_existing.decision = p_decision
       and v_existing.rationale = v_rationale then
      return v_existing;
    end if;
    raise exception 'Correlation identifier conflicts with an existing decision' using errcode = '23505';
  end if;

  if v_assessment.outcome <> 'REVIEW_REQUIRED' then
    raise exception 'Only an assessment that requires review can be decided (outcome %)', v_assessment.outcome
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.customer_assessments a
    where a.tenant_id = p_tenant_id
      and a.customer_id = v_assessment.customer_id
      and a.assessed_at > v_assessment.assessed_at
  ) then
    raise exception 'A newer assessment exists for this customer; decide on the latest one' using errcode = '55000';
  end if;

  select * into v_mlro from public.customer_decisions
  where tenant_id = p_tenant_id and assessment_id = p_assessment_id and level = 'mlro';

  if not found then
    v_level := 'mlro';
  elsif v_mlro.decision = 'escalate' then
    if exists (
      select 1 from public.customer_decisions
      where tenant_id = p_tenant_id and assessment_id = p_assessment_id and level = 'board'
    ) then
      raise exception 'The board has already decided this assessment' using errcode = '23505';
    end if;
    if p_decision = 'escalate' then
      raise exception 'The board decision must approve or reject' using errcode = '22023';
    end if;
    v_level := 'board';
  else
    raise exception 'This assessment already has a final decision' using errcode = '23505';
  end if;

  insert into public.customer_decisions (
    tenant_id, customer_id, assessment_id, level, decision, rationale, correlation_id, decided_by
  ) values (
    p_tenant_id, v_assessment.customer_id, v_assessment.id, v_level, p_decision, v_rationale,
    p_correlation_id, auth.uid()
  ) returning * into v_result;

  perform public.record_audit_event(
    p_tenant_id,
    'customer.decision_recorded',
    'customer_decision',
    v_result.id::text,
    p_correlation_id,
    jsonb_build_object(
      'customer_id', v_result.customer_id,
      'assessment_id', v_result.assessment_id,
      'band', v_assessment.band,
      'dd_level', v_assessment.dd_level,
      'level', v_result.level,
      'decision', v_result.decision
    )
  );

  return v_result;
end;
$$;

revoke all on function public.record_customer_decision(uuid, uuid, text, text, uuid) from public;
grant execute on function public.record_customer_decision(uuid, uuid, text, text, uuid) to authenticated;

comment on table public.customer_decisions is
  'Immutable MLRO/board onboarding decisions on CRA results that require sign-off; separate from the deterministic assessment.';

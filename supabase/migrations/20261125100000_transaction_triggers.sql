-- Transaction trigger evaluator: the MITIGA gambling-industry default
-- ruleset (docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md §6,
-- Lucimara Q5 closed: industry default, not one client only).
--
-- MVP input is aggregates supplied by the caller (no raw transaction
-- ingestion). The database computes the result and stores it as immutable
-- evidence; the browser never sends a hit, a status or a threshold.
--
-- Net deposit = Σ deposits − 90% × Σ (winnings/withdrawals) within the
-- period. Thresholds are versioned in app.transaction_ruleset_v1().

-- 1. Versioned ruleset -------------------------------------------------------

create or replace function app.transaction_ruleset_v1()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'version', 'MITIGA-GAMBLING-DEFAULT-v1',
    'net_withdrawal_factor', 0.9,
    'derogation_threshold', 500,
    'deposits_180d_threshold', 2000,
    'linked_net_threshold', 10000,
    'linked_window_days', 180
  );
$$;

-- 2. Pure evaluator ---------------------------------------------------------
-- Input keys (EUR amounts, all >= 0; optional ones may be null/absent):
--   lifetime_deposits, lifetime_withdrawals            (required)
--   deposits_180d                                      (required)
--   sow_deposits, sow_withdrawals, affordability_limit (optional: only once the SOW questionnaire was answered)
--   linked_deposits, linked_withdrawals                (required)
--   days_since_registration                            (required, integer)
--   prior_sow_documents                                (required, boolean)
--   deposits_30d, declared_monthly_income              (optional: income only when declared)
-- Output: { version, net: {...}, results: [ {code, status, metric, threshold, action, if_not_provided} ],
--           hits: [codes with status 'hit'], actions: [action codes of hits] }
-- status: 'hit' | 'clear' | 'not_evaluated' | 'covered'.

create or replace function app.evaluate_transaction_triggers(p_input jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  r jsonb := app.transaction_ruleset_v1();
  f numeric := (r ->> 'net_withdrawal_factor')::numeric;
  k text;
  v_lifetime_dep numeric; v_lifetime_wd numeric; v_dep_180 numeric;
  v_sow_dep numeric; v_sow_wd numeric; v_limit numeric;
  v_link_dep numeric; v_link_wd numeric; v_days integer; v_prior boolean;
  v_dep_30 numeric; v_income numeric;
  v_sow_net numeric; v_link_net numeric; v_lifetime_total numeric;
  v_results jsonb := '[]'::jsonb;
  v_status text;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Transaction input must be an object' using errcode = '22023';
  end if;

  for k in select jsonb_object_keys(p_input) loop
    if k not in ('lifetime_deposits', 'lifetime_withdrawals', 'deposits_180d', 'sow_deposits', 'sow_withdrawals',
                 'affordability_limit', 'linked_deposits', 'linked_withdrawals', 'days_since_registration',
                 'prior_sow_documents', 'deposits_30d', 'declared_monthly_income') then
      raise exception 'Unknown transaction input %', k using errcode = '22023';
    end if;
    if k = 'prior_sow_documents' then
      if jsonb_typeof(p_input -> k) <> 'boolean' then
        raise exception 'prior_sow_documents must be true or false' using errcode = '22023';
      end if;
    elsif jsonb_typeof(p_input -> k) <> 'null' then
      if jsonb_typeof(p_input -> k) <> 'number' or (p_input ->> k)::numeric < 0 or (p_input ->> k)::numeric > 1000000000 then
        raise exception 'Input % must be a number between 0 and 1,000,000,000', k using errcode = '22023';
      end if;
    end if;
  end loop;

  foreach k in array array['lifetime_deposits', 'lifetime_withdrawals', 'deposits_180d', 'linked_deposits',
                           'linked_withdrawals', 'days_since_registration', 'prior_sow_documents'] loop
    if p_input -> k is null or jsonb_typeof(p_input -> k) = 'null' then
      raise exception 'Missing required transaction input %', k using errcode = '22023';
    end if;
  end loop;

  v_lifetime_dep := (p_input ->> 'lifetime_deposits')::numeric;
  v_lifetime_wd := (p_input ->> 'lifetime_withdrawals')::numeric;
  v_dep_180 := (p_input ->> 'deposits_180d')::numeric;
  v_sow_dep := (p_input ->> 'sow_deposits')::numeric;
  v_sow_wd := (p_input ->> 'sow_withdrawals')::numeric;
  v_limit := (p_input ->> 'affordability_limit')::numeric;
  v_link_dep := (p_input ->> 'linked_deposits')::numeric;
  v_link_wd := (p_input ->> 'linked_withdrawals')::numeric;
  v_days := (p_input ->> 'days_since_registration')::numeric;
  v_prior := (p_input ->> 'prior_sow_documents')::boolean;
  v_dep_30 := (p_input ->> 'deposits_30d')::numeric;
  v_income := (p_input ->> 'declared_monthly_income')::numeric;

  if (p_input ->> 'days_since_registration')::numeric <> v_days then
    raise exception 'days_since_registration must be a whole number' using errcode = '22023';
  end if;

  -- TRG_500_DEROGATION: deposits + withdrawals, lifetime, >= 500.
  v_lifetime_total := v_lifetime_dep + v_lifetime_wd;
  v_results := v_results || jsonb_build_object(
    'code', 'TRG_500_DEROGATION',
    'status', case when v_lifetime_total >= (r ->> 'derogation_threshold')::numeric then 'hit' else 'clear' end,
    'metric', v_lifetime_total, 'threshold', (r ->> 'derogation_threshold')::numeric,
    'action', 'FULL_KYC_AND_PURPOSE', 'if_not_provided', 'CAP_DEPOSITS_AT_500');

  -- TRG_2K_180D: deposits, rolling 180 days, >= 2,000.
  v_results := v_results || jsonb_build_object(
    'code', 'TRG_2K_180D',
    'status', case when v_dep_180 >= (r ->> 'deposits_180d_threshold')::numeric then 'hit' else 'clear' end,
    'metric', v_dep_180, 'threshold', (r ->> 'deposits_180d_threshold')::numeric,
    'action', 'SOW_QUESTIONNAIRE', 'if_not_provided', 'CAP_DEPOSITS_BELOW_2000');

  -- TRG_AFFORDABILITY: net deposits since the SOW answer > affordability limit.
  if v_limit is null or v_sow_dep is null then
    v_status := 'not_evaluated';
    v_sow_net := null;
  else
    v_sow_net := round(v_sow_dep - f * coalesce(v_sow_wd, 0), 2);
    v_status := case when v_sow_net > v_limit then 'hit' else 'clear' end;
  end if;
  v_results := v_results || jsonb_build_object(
    'code', 'TRG_AFFORDABILITY', 'status', v_status, 'metric', v_sow_net, 'threshold', v_limit,
    'action', 'SOW_DOCUMENTS', 'if_not_provided', 'CAP_DEPOSITS_AT_AFFORDABILITY');

  -- TRG_10K_180D_LINKED: net linked deposits in the first 180 days >= 10,000;
  -- covered when SOW documents were already provided. Outside the window
  -- compliance decides case by case (manual parameter), so not evaluated.
  v_link_net := round(v_link_dep - f * v_link_wd, 2);
  if v_days > (r ->> 'linked_window_days')::integer then
    v_status := 'not_evaluated';
  elsif v_link_net >= (r ->> 'linked_net_threshold')::numeric then
    v_status := case when v_prior then 'covered' else 'hit' end;
  else
    v_status := 'clear';
  end if;
  v_results := v_results || jsonb_build_object(
    'code', 'TRG_10K_180D_LINKED', 'status', v_status, 'metric', v_link_net,
    'threshold', (r ->> 'linked_net_threshold')::numeric,
    'action', 'SOW_SOF_DOCUMENTS', 'if_not_provided', 'CAP_DEPOSITS_BELOW_10000');

  -- TRG_30D_AFFORDABILITY: deposits in 30 days > declared monthly income.
  if v_income is null or v_dep_30 is null then
    v_status := 'not_evaluated';
  else
    v_status := case when v_dep_30 > v_income then 'hit' else 'clear' end;
  end if;
  v_results := v_results || jsonb_build_object(
    'code', 'TRG_30D_AFFORDABILITY', 'status', v_status, 'metric', v_dep_30, 'threshold', v_income,
    'action', 'SOF_DOCUMENTS_OR_ESCALATE', 'if_not_provided', 'BLOCK_TRIGGERING_TRANSACTION');

  return jsonb_build_object(
    'version', r ->> 'version',
    'net', jsonb_build_object('sow', v_sow_net, 'linked', v_link_net),
    'results', v_results,
    'hits', coalesce((select jsonb_agg(x ->> 'code') from jsonb_array_elements(v_results) x where x ->> 'status' = 'hit'), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(x ->> 'action') from jsonb_array_elements(v_results) x where x ->> 'status' = 'hit'), '[]'::jsonb)
  );
end;
$$;

-- 3. Immutable evidence ------------------------------------------------------

create table public.customer_transaction_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  ruleset_version text not null,
  inputs jsonb not null,
  result jsonb not null,
  hit_count integer not null check (hit_count >= 0),
  correlation_id uuid not null,
  checked_by uuid not null references auth.users (id),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (customer_id, tenant_id) references public.customers (id, tenant_id),
  unique (tenant_id, correlation_id)
);

create index idx_customer_transaction_checks_customer on public.customer_transaction_checks (tenant_id, customer_id, checked_at desc);

create trigger trg_customer_transaction_checks_append_only
  before update or delete on public.customer_transaction_checks
  for each row execute function app.forbid_mutation();

alter table public.customer_transaction_checks enable row level security;

create policy customer_transaction_checks_select on public.customer_transaction_checks
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'customer.view')
  );

revoke insert, update, delete on public.customer_transaction_checks from authenticated, anon;
grant select on public.customer_transaction_checks to authenticated;

-- 4. The one write path ----------------------------------------------------

create or replace function public.run_transaction_check(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_inputs jsonb,
  p_correlation_id uuid
) returns public.customer_transaction_checks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.customer_transaction_checks;
  v_result jsonb;
  v_row public.customer_transaction_checks;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'assessment.run') then
    raise exception 'Missing assessment.run capability for tenant %', p_tenant_id using errcode = '42501';
  end if;
  if p_correlation_id is null then
    raise exception 'A correlation identifier is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and tenant_id = p_tenant_id) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_correlation_id::text, 0));

  select * into v_existing from public.customer_transaction_checks
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;
  if found then
    if v_existing.customer_id = p_customer_id and v_existing.inputs = p_inputs then
      return v_existing;
    end if;
    raise exception 'Correlation identifier conflicts with an existing check' using errcode = '23505';
  end if;

  v_result := app.evaluate_transaction_triggers(p_inputs);

  insert into public.customer_transaction_checks (
    tenant_id, customer_id, ruleset_version, inputs, result, hit_count, correlation_id, checked_by
  ) values (
    p_tenant_id, p_customer_id, v_result ->> 'version', p_inputs, v_result,
    jsonb_array_length(v_result -> 'hits'), p_correlation_id, auth.uid()
  ) returning * into v_row;

  perform public.record_audit_event(
    p_tenant_id, 'customer.transaction_check_run', 'customer_transaction_check', v_row.id::text, p_correlation_id,
    jsonb_build_object('customer_id', p_customer_id, 'ruleset_version', v_row.ruleset_version, 'hits', v_result -> 'hits')
  );

  return v_row;
end;
$$;

revoke all on function public.run_transaction_check(uuid, uuid, jsonb, uuid) from public;
grant execute on function public.run_transaction_check(uuid, uuid, jsonb, uuid) to authenticated;

comment on table public.customer_transaction_checks is
  'Immutable transaction-trigger checks: caller-supplied aggregates evaluated in the database against a versioned ruleset.';

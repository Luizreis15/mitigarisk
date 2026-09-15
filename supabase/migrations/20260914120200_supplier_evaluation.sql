-- TASK-023: extend the existing evaluation bounded context
-- (20260912120300_evaluation.sql) for the real supplier evaluation slice.
--
-- Security correction (post-review, 2026-09-15): the first version of this
-- migration accepted score/decision_band/data_quality/normalized_input/
-- reasons as plain RPC parameters, trusting whatever the calling Next.js
-- Server Action computed. Since no service-role credential or shared
-- secret is available to distinguish "the real app" from "any other
-- authenticated PostgREST caller with evaluation.run," that made the
-- computed risk result entirely forgeable: any caller holding evaluation.run
-- could invoke the RPC directly with an arbitrary score and decision band.
-- This version closes that hole by making the database itself the
-- deterministic source of truth: public.run_supplier_evaluation() takes
-- only identifying references (tenant, supplier, correlation id), looks up
-- the tenant's own current published policy itself, re-derives the six
-- bounded facts from persisted supplier/evidence rows, computes the score,
-- recommendation band, data quality, and reason codes itself, and persists
-- exactly that — never a value the caller supplied. The TypeScript
-- deterministic engine (apps/web/lib/domain/evaluation-engine.ts) remains
-- the reference implementation this SQL mirrors; it is unmodified and no
-- longer sits on this write path (see the handoff for why duplicating the
-- scoring rules in SQL, rather than trusting a client-computed result, is
-- the only way to satisfy "no forgeable output" without a service role).

alter table public.evaluations
  add column if not exists supplier_id uuid,
  add column if not exists data_quality text check (data_quality in ('complete', 'partial', 'insufficient')),
  add column if not exists missing_required_factor_keys jsonb not null default '[]'::jsonb;

alter table public.evaluations
  add constraint evaluations_supplier_fk
  foreign key (supplier_id, tenant_id) references public.suppliers (id, tenant_id);

create index if not exists idx_evaluations_supplier_id on public.evaluations (supplier_id);

alter table public.evaluation_reason_codes
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Close the direct-table forgery path -----------------------------------------
-- With the RPC below now the trusted, non-forgeable boundary, a direct
-- authenticated INSERT/UPDATE into evaluations with an arbitrary score
-- would defeat it entirely. evaluations is a shared bounded-context table
-- (20260912120300_evaluation.sql predates this task and is also used, and
-- tested, for non-supplier subjects — see supabase/tests/020-integration-hardening.sql,
-- which directly inserts several plain authenticated evaluations with
-- supplier_id left null), so rather than revoking the grant outright this
-- narrows the existing evaluations_insert/evaluations_update policies
-- (20260912120800_security_and_english_first_hardening.sql) to rows with
-- supplier_id is null: a supplier evaluation (supplier_id is not null) can
-- now only ever be written by public.run_supplier_evaluation(), which is
-- security definer and bypasses these policies entirely, while every
-- pre-existing non-supplier test and use case is unaffected.
drop policy evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
    and actor_type = 'user'
    and actor_id = auth.uid()
    and supplier_id is null
  );

drop policy evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
  with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
    and actor_type = 'user'
    and actor_id = auth.uid()
    and supplier_id is null
  );

-- Same narrowing for select: a platform administrator retains the
-- existing bypass for a non-supplier evaluation (shared, pre-existing
-- behavior, unaffected by this task), but not for a supplier evaluation —
-- "no operational bypass through the real workspace" applies to reading a
-- supplier's evaluation result exactly as it does to creating it.
drop policy evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated using (
    case
      when supplier_id is not null then app.has_tenant_capability_as_member(tenant_id, 'evaluation.view')
      else app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.view')
    end
  );

drop policy evaluation_reason_codes_select on public.evaluation_reason_codes;
create policy evaluation_reason_codes_select on public.evaluation_reason_codes
  for select to authenticated using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_reason_codes.evaluation_id
        and e.tenant_id = evaluation_reason_codes.tenant_id
        and (
          case
            when e.supplier_id is not null then app.has_tenant_capability_as_member(e.tenant_id, 'evaluation.view')
            else app.is_platform_admin() or app.has_capability(e.tenant_id, 'evaluation.view')
          end
        )
    )
  );

-- Fact derivation (mirrors apps/web/lib/domain/supplier-evaluation-adapter.ts) -
-- Pure functions of persisted supplier/evidence rows only. No caller input
-- of any kind. Kept as separate helpers so public.run_supplier_evaluation()
-- reads as the orchestration, not the domain rules.

create or replace function app.best_supplier_evidence_state(
  p_tenant_id uuid, p_supplier_id uuid, p_evidence_type text
) returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when exists (
      select 1 from public.supplier_evidence e
      where e.tenant_id = p_tenant_id and e.supplier_id = p_supplier_id
        and e.evidence_type = p_evidence_type and e.verification_state = 'reviewed'
    ) then 'reviewed'
    when exists (
      select 1 from public.supplier_evidence e
      where e.tenant_id = p_tenant_id and e.supplier_id = p_supplier_id
        and e.evidence_type = p_evidence_type and e.verification_state = 'provided'
    ) then 'provided'
    when exists (
      select 1 from public.supplier_evidence e
      where e.tenant_id = p_tenant_id and e.supplier_id = p_supplier_id
        and e.evidence_type = p_evidence_type and e.verification_state = 'rejected'
    ) then 'rejected'
    else 'missing'
  end;
$$;

comment on function app.best_supplier_evidence_state(uuid, uuid, text) is
  'The most favorable (lowest-risk) verification state recorded for one evidence type, or "missing" if none exists. Mirrors bestVerificationStateFor() in apps/web/lib/domain/supplier-evaluation-adapter.ts.';

create or replace function app.derive_supplier_evaluation_facts(p_tenant_id uuid, p_supplier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_supplier public.suppliers;
  v_country_consistent boolean;
  v_identifier_plausible boolean;
  v_identity_risk numeric;
  v_distinct_country_count int;
  v_geo_risk numeric;
  v_ownership_state text;
  v_screening_state text;
  v_financial_risk numeric;
  v_required_types text[] := array[
    'incorporation_record', 'ownership_declaration', 'address_confirmation',
    'bank_account_confirmation', 'compliance_questionnaire'
  ];
  v_type text;
  v_state text;
  v_reviewed_count int := 0;
  v_any_rejected boolean := false;
  v_evidence_quality_risk numeric;
begin
  select * into v_supplier from public.suppliers where id = p_supplier_id and tenant_id = p_tenant_id;
  if v_supplier.id is null then
    raise exception 'Supplier % not found in tenant %', p_supplier_id, p_tenant_id using errcode = 'P0002';
  end if;

  v_country_consistent := v_supplier.registration_country_code = any (v_supplier.operating_country_codes);
  v_identifier_plausible := length(trim(v_supplier.registration_identifier)) >= 4;
  v_identity_risk := case
    when v_country_consistent and v_identifier_plausible then 0
    when v_country_consistent or v_identifier_plausible then 50
    else 100
  end;

  select count(distinct c) into v_distinct_country_count from unnest(v_supplier.operating_country_codes) as c;
  v_geo_risk := case
    when v_distinct_country_count <= 1 then 0
    when v_distinct_country_count = 2 then 50
    else 100
  end;

  v_ownership_state := app.best_supplier_evidence_state(p_tenant_id, p_supplier_id, 'ownership_declaration');
  v_screening_state := app.best_supplier_evidence_state(p_tenant_id, p_supplier_id, 'compliance_questionnaire');

  v_financial_risk := round(least(greatest(v_supplier.annual_exposure_minor / 100000000.0 * 100, 0), 100));

  foreach v_type in array v_required_types loop
    v_state := app.best_supplier_evidence_state(p_tenant_id, p_supplier_id, v_type);
    if v_state = 'reviewed' then
      v_reviewed_count := v_reviewed_count + 1;
    elsif v_state = 'rejected' then
      v_any_rejected := true;
    end if;
  end loop;

  v_evidence_quality_risk := round(
    case when v_any_rejected
      then greatest(100 - (v_reviewed_count::numeric / array_length(v_required_types, 1)) * 100, 70)
      else 100 - (v_reviewed_count::numeric / array_length(v_required_types, 1)) * 100
    end
  );

  return jsonb_build_object(
    'identity_integrity_risk', v_identity_risk,
    'geographic_risk', v_geo_risk,
    'ownership_transparency_risk', case v_ownership_state when 'reviewed' then 0 when 'provided' then 50 else 100 end,
    'integrity_screening_risk', case v_screening_state when 'reviewed' then 0 when 'provided' then 50 else 100 end,
    'financial_exposure_risk', v_financial_risk,
    'evidence_quality_risk', v_evidence_quality_risk
  );
end;
$$;

comment on function app.derive_supplier_evaluation_facts(uuid, uuid) is
  'The six bounded 0-100 evaluation facts for "Supplier onboarding policy" version 1, derived only from persisted suppliers/supplier_evidence rows. Mirrors deriveSupplierEvaluationFacts() in apps/web/lib/domain/supplier-evaluation-adapter.ts. Raises P0002 if the supplier does not exist in the given tenant.';

revoke all on function app.best_supplier_evidence_state(uuid, uuid, text) from public;
revoke all on function app.derive_supplier_evaluation_facts(uuid, uuid) from public;
grant execute on function app.best_supplier_evidence_state(uuid, uuid, text) to authenticated;
grant execute on function app.derive_supplier_evaluation_facts(uuid, uuid) to authenticated;

-- Atomic, capability-checked, audited evaluation -----------------------------
-- security definer (not invoker, unlike the pre-correction version): the
-- explicit app.has_tenant_capability_as_member() check is the only
-- enforcement boundary for this write, since there is deliberately no
-- platform-admin bypass here at all (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
-- acceptance criterion 9). Running as the defining role also lets this
-- function call app.* helpers directly and bypass the narrowed
-- evaluations_insert/evaluations_update policies above by design — those
-- policies exist to block a *direct* authenticated write with an arbitrary
-- score, not this one, audited path.
create or replace function public.run_supplier_evaluation(
  p_tenant_id uuid,
  p_supplier_id uuid,
  p_correlation_id uuid
) returns public.evaluations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.evaluations;
  v_evaluation public.evaluations;
  v_supplier_reference text;
  v_policy_version_id uuid;
  v_facts jsonb;
  v_factor record;
  v_raw numeric;
  v_min numeric;
  v_max numeric;
  v_direction text;
  v_required boolean;
  v_normalized numeric;
  v_weight numeric;
  v_weighted_sum numeric := 0;
  v_total_weight numeric := 0;
  v_score numeric;
  v_threshold record;
  v_decision_band text;
  v_missing_keys jsonb := '[]'::jsonb;
  v_required_count int := 0;
  v_missing_required_count int := 0;
  v_data_quality text;
  v_reasons jsonb := '[]'::jsonb;
  v_weight_share numeric;
  v_input_hash text;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'evaluation.run') then
    raise exception 'Missing evaluation.run capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  select reference into v_supplier_reference
  from public.suppliers
  where id = p_supplier_id and tenant_id = p_tenant_id;

  if v_supplier_reference is null then
    raise exception 'Supplier % not found in tenant %', p_supplier_id, p_tenant_id using errcode = 'P0002';
  end if;

  select id into v_policy_version_id
  from public.policy_versions
  where tenant_id = p_tenant_id and status = 'published'
  order by published_at desc
  limit 1;

  if v_policy_version_id is null then
    -- Reuses the plpgsql-reserved P0003 condition name for a second,
    -- distinct "no matching row" case in this function; distinguished from
    -- supplier-not-found (P0002) by errcode alone, matching this
    -- codebase's existing convention of mapping errors by SQLSTATE, not
    -- message text (apps/web/lib/supabase/*-repository.ts).
    raise exception 'Tenant % has no published policy version' , p_tenant_id using errcode = 'P0003';
  end if;

  -- Facts are re-derived from persisted data on every call, including a
  -- replay: this function never trusts a caller-supplied fact, score, or
  -- reason. See app.derive_supplier_evaluation_facts() above.
  v_facts := app.derive_supplier_evaluation_facts(p_tenant_id, p_supplier_id);

  -- Pass 1: total weight and required-factor count only. weightShare
  -- (weight / total_weight, matching roundShare() in
  -- apps/web/lib/domain/evaluation-reasons.ts) cannot be computed per
  -- factor until the total is known, so this is a genuine two-pass
  -- computation, not an arbitrary restructuring.
  for v_factor in
    select weight, config
    from public.policy_factors
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
  loop
    v_total_weight := v_total_weight + v_factor.weight;
    if (v_factor.config ->> 'required')::boolean then
      v_required_count := v_required_count + 1;
    end if;
  end loop;

  if v_total_weight <= 0 then
    raise exception 'Published policy % for tenant % has no usable factors', v_policy_version_id, p_tenant_id using errcode = '22023';
  end if;

  -- Pass 2: per-factor normalization, weighted sum, and reason codes, in
  -- stable definition order (factor insertion order — the same order the
  -- TS engine iterates policy.factors in).
  for v_factor in
    select key, weight, config
    from public.policy_factors
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
    order by created_at asc
  loop
    v_min := (v_factor.config ->> 'min')::numeric;
    v_max := (v_factor.config ->> 'max')::numeric;
    v_direction := v_factor.config ->> 'direction';
    v_required := (v_factor.config ->> 'required')::boolean;
    v_weight := v_factor.weight;
    v_weight_share := round(v_weight / v_total_weight, 4);

    if not (v_facts ? v_factor.key) then
      -- Absent fact: NEUTRAL_FACTOR_SCORE (apps/web/lib/domain/evaluation-scoring.ts),
      -- and — for a required factor — counted toward data quality and
      -- named in missing_required_factor_keys, exactly as the TS engine does.
      v_normalized := 50;
      if v_required then
        v_missing_required_count := v_missing_required_count + 1;
        v_missing_keys := v_missing_keys || to_jsonb(v_factor.key);
      end if;
      v_reasons := v_reasons || jsonb_build_object(
        'code', 'FACTOR_INPUT_MISSING',
        'description', 'No input was supplied for this factor; a neutral default score was used.',
        'metadata', jsonb_build_object(
          'factorKey', v_factor.key, 'required', v_required, 'neutralScore', 50, 'weightShare', v_weight_share
        )
      );
    else
      v_raw := (v_facts ->> v_factor.key)::numeric;
      v_normalized := case v_direction
        when 'higher_is_riskier' then (least(greatest(v_raw, v_min), v_max) - v_min) / (v_max - v_min) * 100
        else (1 - (least(greatest(v_raw, v_min), v_max) - v_min) / (v_max - v_min)) * 100
      end;
      v_reasons := v_reasons || jsonb_build_object(
        'code', case
          when v_normalized < 30 then 'FACTOR_LOW_RISK_CONTRIBUTION'
          when v_normalized >= 70 then 'FACTOR_HIGH_RISK_CONTRIBUTION'
          else 'FACTOR_MODERATE_RISK_CONTRIBUTION'
        end,
        'description', 'This factor''s normalized score contributed to the overall risk score.',
        'metadata', jsonb_build_object('factorKey', v_factor.key, 'normalizedScore', v_normalized, 'weightShare', v_weight_share)
      );
    end if;

    v_weighted_sum := v_weighted_sum + v_normalized * v_weight;
  end loop;

  v_score := round(v_weighted_sum / v_total_weight, 2);

  -- resolveBand() semantics (apps/web/lib/domain/evaluation-scoring.ts):
  -- [min, max) for every threshold except the one holding the overall
  -- maximum max_score, which is also max-inclusive.
  for v_threshold in
    select min_score, max_score, decision_band,
           max_score = max(max_score) over () as is_last
    from public.policy_thresholds
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
    order by min_score asc
  loop
    if v_score >= v_threshold.min_score and (v_score < v_threshold.max_score or v_threshold.is_last) then
      v_decision_band := v_threshold.decision_band;
      exit;
    end if;
  end loop;

  if v_decision_band is null then
    raise exception 'Score % is not covered by any threshold in policy % for tenant %', v_score, v_policy_version_id, p_tenant_id
      using errcode = '22023';
  end if;

  v_data_quality := case
    when v_required_count = 0 or v_missing_required_count = 0 then 'complete'
    when v_missing_required_count = v_required_count then 'insufficient'
    else 'partial'
  end;

  v_reasons := v_reasons || jsonb_build_object(
    'code', case v_decision_band
      when 'approve' then 'RECOMMENDATION_APPROVE'
      when 'review' then 'RECOMMENDATION_REVIEW'
      else 'RECOMMENDATION_REJECT'
    end,
    'description', 'Overall score resolved to this policy recommendation band.',
    'metadata', jsonb_build_object('score', v_score)
  );

  v_input_hash := encode(
    digest(v_policy_version_id::text || '|' || p_supplier_id::text || '|' || v_facts::text, 'sha256'),
    'hex'
  );

  select * into v_existing
  from public.evaluations
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;

  if found then
    if v_existing.input_hash is distinct from v_input_hash then
      raise exception 'Correlation id % was already used with different evaluation input for tenant %',
        p_correlation_id, p_tenant_id
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  -- Inserted as 'pending' first, not 'completed': the reason-codes guard
  -- trigger (app.forbid_reason_code_mutation_after_completion(), in
  -- 20260912120300_evaluation.sql) rejects any insert into
  -- evaluation_reason_codes once its parent evaluation's status is already
  -- 'completed' or 'failed'. All of this runs inside the single implicit
  -- transaction of this function call: any exception anywhere above rolls
  -- back every step, so a partial evaluation can never be observed by
  -- another session.
  insert into public.evaluations (
    tenant_id, supplier_id, policy_version_id, subject_reference, input_hash,
    normalized_input, score, decision_band, status, correlation_id,
    actor_id, actor_type, data_quality, missing_required_factor_keys
  ) values (
    p_tenant_id, p_supplier_id, v_policy_version_id, v_supplier_reference, v_input_hash,
    v_facts, v_score, v_decision_band, 'pending', p_correlation_id,
    auth.uid(), 'user', v_data_quality, v_missing_keys
  )
  returning * into v_evaluation;

  insert into public.evaluation_reason_codes (tenant_id, evaluation_id, code, description, weight_contribution, metadata)
  select
    p_tenant_id,
    v_evaluation.id,
    r ->> 'code',
    r ->> 'description',
    nullif(r -> 'metadata' ->> 'weightShare', '')::numeric,
    coalesce(r -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(v_reasons) as r;

  update public.evaluations
  set status = 'completed', completed_at = now()
  where id = v_evaluation.id
  returning * into v_evaluation;

  perform public.record_audit_event(
    p_tenant_id, 'evaluation.completed', 'evaluation', v_evaluation.id::text, p_correlation_id,
    jsonb_build_object(
      'supplier_id', p_supplier_id,
      'policy_version_id', v_policy_version_id,
      'decision_band', v_decision_band,
      'data_quality', v_data_quality
    )
  );

  return v_evaluation;
end;
$$;

comment on function public.run_supplier_evaluation(uuid, uuid, uuid) is
  'The only path to run a supplier evaluation. Security definer; checks evaluation.run via app.has_tenant_capability_as_member() (no platform-admin bypass); looks up the tenant''s own current published policy and re-derives all facts from persisted supplier/evidence rows; computes score, recommendation, data quality, and reason codes itself; persists atomically with a mandatory audit event. Accepts no engine output of any kind from the caller — only identifying references.';

revoke all on function public.run_supplier_evaluation(uuid, uuid, uuid) from public;
grant execute on function public.run_supplier_evaluation(uuid, uuid, uuid) to authenticated;

-- Rollback: drop function public.run_supplier_evaluation(uuid, uuid, uuid);
-- drop function app.derive_supplier_evaluation_facts(uuid, uuid); drop
-- function app.best_supplier_evidence_state(uuid, uuid, text); restore the
-- prior evaluations_insert/evaluations_update/evaluations_select/evaluation_reason_codes_select
-- policies (without the supplier_id-based narrowing) from
-- 20260912120800_security_and_english_first_hardening.sql; drop index
-- idx_evaluations_supplier_id; drop constraint evaluations_supplier_fk;
-- drop columns missing_required_factor_keys, data_quality, supplier_id
-- from public.evaluations. No data migration is required because every
-- added column is nullable or defaulted.

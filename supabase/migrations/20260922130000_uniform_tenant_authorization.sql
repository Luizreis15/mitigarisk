-- TASK-026: make the database the single, uniform authorization boundary for
-- every real supplier-workflow surface. Closes the gaps the TASK-025
-- independent review found by direct database probes (not through the
-- Server Actions): docs/tasks/TASK-026-claude-uniform-database-authorization.md.
--
-- Human decisions approved 2026-09-22 (Edu):
--   D1 - any public.platform_admins identity is denied on every tenant-
--        operational surface, even when it also holds an active membership.
--   D2 - operational reads and writes are denied when tenants.status is not
--        'active', at the same two helper functions.
--   D3 - the legacy (supplier_id is null) evaluations_insert/update/select
--        and evaluation_reason_codes_select policies drop their
--        platform-admin bypass and use the member-only helper instead.
-- Out of scope, unchanged here: whether operator keeps evaluation.run, and
-- any seed/role-matrix change.
--
-- Corrected references (TASK-026 item 7): the fact-derivation helpers below
-- mirror apps/web/lib/domain/supplier-evaluation-adapter.ts, and the only
-- write path for a supplier evaluation is public.run_supplier_evaluation()
-- itself -- there is no complete_supplier_evaluation() function in this
-- codebase (supabase/tests/040-supplier-evaluation.sql asserts it does not
-- exist). Earlier migration comments that named a stale
-- complete_supplier_evaluation() write path are corrected by this file, not
-- edited in place: applied migrations are immutable.

-- 1. D1 + D2 -------------------------------------------------------------
-- app.has_tenant_capability_as_member() and app.is_active_tenant_admin()
-- (20260914120050_no_bypass_authorization_helpers.sql) already excluded
-- every OTHER role from standing in for a tenant_admin, but neither denied
-- an identity that is simultaneously a platform_admins row and an active
-- tenant member: the membership EXISTS check passed regardless of that
-- identity also being a platform administrator, and neither function
-- checked the tenant's own status. Signatures are unchanged, so every
-- existing caller (RLS policy or RPC) inherits both fixes without its own
-- change. The explicit `app.is_platform_admin()` / tenant-status checks
-- TASK-025 added at the call sites (e.g. public.record_supplier_final_decision)
-- remain as defense in depth and are now redundant with, not contradicted
-- by, this fix.

create or replace function app.has_tenant_capability_as_member(p_tenant_id uuid, p_capability text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    not app.is_platform_admin()
    and exists (
      select 1
      from public.memberships m
      join public.role_capabilities rc on rc.role_key = m.role_key
      join public.tenants t on t.id = m.tenant_id
      where m.tenant_id = p_tenant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and rc.capability_key = p_capability
        and t.status = 'active'
    );
$$;

comment on function app.has_tenant_capability_as_member(uuid, text) is
  'Same shape as app.has_capability(uuid, text) but with no platform-admin bypass and no dual-role exception (TASK-026 D1): a platform_admins identity is denied here even with an active membership. Also denies when the tenant itself is not active (TASK-026 D2). True only for an active tenant membership, in an active tenant, whose role grants the capability, held by an identity that is not a platform administrator. Used where a platform administrator must never succeed, not merely be discouraged by the UI.';

create or replace function app.is_active_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    not app.is_platform_admin()
    and exists (
      select 1
      from public.memberships m
      join public.tenants t on t.id = m.tenant_id
      where m.tenant_id = p_tenant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role_key = 'tenant_admin'
        and t.status = 'active'
    );
$$;

comment on function app.is_active_tenant_admin(uuid) is
  'True only for an active tenant_admin membership in an active tenant, held by an identity that is not a platform administrator (TASK-026 D1, D2). No platform-admin bypass, no dual-role exception, and no other role, however capable, qualifies: a case decision or a supplier final decision is Company Admin authority specifically, not a generic capability route.';

-- 2. D3 --------------------------------------------------------------------
-- Rewrite the legacy (supplier_id is null) evaluations_insert/update/select
-- policies and evaluation_reason_codes_select to use the member-only
-- helper. The supplier branch of evaluations_select and
-- evaluation_reason_codes_select already used app.has_tenant_capability_as_member()
-- (20260914120200_supplier_evaluation.sql); with the legacy branch now
-- using the same helper, the two branches of the prior CASE expression are
-- identical, so the CASE collapses to a single unconditional check.

drop policy evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'evaluation.run')
    and actor_type = 'user'
    and actor_id = auth.uid()
    and supplier_id is null
  );

drop policy evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update to authenticated
  using (app.has_tenant_capability_as_member(tenant_id, 'evaluation.run'))
  with check (
    app.has_tenant_capability_as_member(tenant_id, 'evaluation.run')
    and actor_type = 'user'
    and actor_id = auth.uid()
    and supplier_id is null
  );

drop policy evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'evaluation.view')
  );

drop policy evaluation_reason_codes_select on public.evaluation_reason_codes;
create policy evaluation_reason_codes_select on public.evaluation_reason_codes
  for select to authenticated using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_reason_codes.evaluation_id
        and e.tenant_id = evaluation_reason_codes.tenant_id
        and app.has_tenant_capability_as_member(e.tenant_id, 'evaluation.view')
    )
  );

-- 3. run_supplier_evaluation(): policy validation guard, deterministic
-- factor order, and an advisory lock for idempotent concurrent retries -----
-- Full function replace (CREATE OR REPLACE FUNCTION): the prior version is
-- 20260914120200_supplier_evaluation.sql, unmodified there (applied
-- migrations are immutable). Behavior changes from that version:
--   - a structural policy-validation guard now runs first, before any
--     computation or write, and fails closed with SQLSTATE 22023 and no
--     partial write on an invalid published policy (TASK-026 item 3);
--   - factor iteration in the scoring pass is now `order by created_at, key`
--     rather than `order by created_at` alone -- the ordering contract for
--     this function and its mirrored TypeScript reference, made
--     deterministic even when every factor of a policy version shares one
--     `created_at` (TASK-026 item 4, TASK-025 review finding E);
--   - a pg_advisory_xact_lock on (tenant_id, correlation_id) now serializes
--     concurrent identical calls before the replay/conflict check, so two
--     concurrent retries with the same correlation id resolve to the same
--     row instead of racing (TASK-026 item 5).
-- The authorization check itself (app.has_tenant_capability_as_member(),
-- no platform-admin bypass) is unchanged from the prior version and already
-- satisfies D1/D2 through the redefinition above.

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
  v_thresholds_valid boolean;
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

  -- Policy validation guard (TASK-026 item 3): every structural defect is
  -- checked before any fact derivation, scoring, or write, so an invalid
  -- published policy fails closed with a stable SQLSTATE 22023 and leaves
  -- no partial evaluation or audit row behind.
  if exists (
    select 1
    from public.policy_factors
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
      and (
        config ->> 'min' is null
        or config ->> 'max' is null
        or (config ->> 'min')::numeric >= (config ->> 'max')::numeric
        or config ->> 'direction' is null
        or config ->> 'direction' not in ('higher_is_riskier', 'lower_is_riskier')
        or weight <= 0
      )
  ) then
    raise exception 'Published policy % for tenant % has an invalid factor configuration', v_policy_version_id, p_tenant_id
      using errcode = '22023';
  end if;

  -- Thresholds must cover [0, 100] with no gap and no overlap: ordered by
  -- min_score, the first row starts at 0, the last row ends at 100, and
  -- every row's min_score equals the previous row's max_score. A policy
  -- with zero thresholds fails closed too (bool_and() over zero rows is
  -- null, and `is not true` catches null).
  select
    min(min_score) = 0
    and max(max_score) = 100
    and bool_and(rn = 1 or prev_max_score = min_score)
  into v_thresholds_valid
  from (
    select
      min_score, max_score,
      row_number() over (order by min_score) as rn,
      lag(max_score) over (order by min_score) as prev_max_score
    from public.policy_thresholds
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
  ) t;

  if v_thresholds_valid is not true then
    raise exception 'Published policy % for tenant % has invalid or non-contiguous decision thresholds', v_policy_version_id, p_tenant_id
      using errcode = '22023';
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

  -- Pass 2: per-factor normalization, weighted sum, and reason codes.
  -- Ordering contract (TASK-026 item 4): `order by created_at, key` --
  -- created_at alone is not deterministic when a policy's factors were
  -- seeded or migrated in one batch and share the same timestamp (the
  -- TASK-025 review's finding E), so key is the required, always-unique
  -- tiebreaker. This is the same order the TS reference engine
  -- (apps/web/lib/domain/evaluation-engine.ts) iterates policy.factors in.
  for v_factor in
    select key, weight, config
    from public.policy_factors
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
    order by created_at, key
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

  -- Advisory lock on (tenant_id, correlation_id) (TASK-026 item 5): taken
  -- before the replay/conflict check below so two concurrent calls with the
  -- same correlation id are serialized and resolve idempotently -- the
  -- second call observes the first call's committed-within-this-transaction
  -- row rather than racing it. Namespaced with a distinct second argument
  -- (1) from public.record_supplier_final_decision()'s advisory lock (0) on
  -- a different key shape, so the two lock domains cannot collide.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_correlation_id::text, 1));

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
  'The only path to run a supplier evaluation. Security definer; checks evaluation.run via app.has_tenant_capability_as_member() (no platform-admin bypass, no dual-role exception, denied in a non-active tenant -- TASK-026 D1/D2); validates the published policy''s factors and thresholds before any computation and fails closed with SQLSTATE 22023 on a structural defect; looks up the tenant''s own current published policy and re-derives all facts from persisted supplier/evidence rows in a deterministic (created_at, key) factor order; computes score, recommendation, data quality, and reason codes itself; serializes concurrent replays of the same correlation id with an advisory lock; persists atomically with a mandatory audit event. Accepts no engine output of any kind from the caller — only identifying references.';

revoke all on function public.run_supplier_evaluation(uuid, uuid, uuid) from public;
grant execute on function public.run_supplier_evaluation(uuid, uuid, uuid) to authenticated;

-- Rollback: this migration only redefines existing functions and policies
-- (CREATE OR REPLACE FUNCTION, DROP POLICY + CREATE POLICY on unchanged
-- tables); no table, column, or data is added or removed. Restoring the
-- prior behavior means re-applying the exact function and policy bodies
-- from 20260914120050_no_bypass_authorization_helpers.sql and
-- 20260914120200_supplier_evaluation.sql. No data migration is required.

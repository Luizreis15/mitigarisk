-- TASK-034: the customer assessment form, i.e. which facts a CRA assessment
-- needs and which values each one accepts, for a caller who may run an
-- assessment but must never see the policy's weights or points (the operator
-- role has no policy.view, by design: knowing the points lets a 1st-line user
-- game the score).
--
-- The override values the form lists and the override values
-- public.run_customer_assessment() accepts come from the SAME helper below,
-- so the two can never disagree (TASK-033's fact-schema derivation rule,
-- unchanged).

-- 1. Provisional overrides -------------------------------------------------------
-- A template can mark an override as provisional (Template v1:
-- OVR_HNWI "status": "provisional_pending_Q6"). It is still evaluated exactly
-- like any other override; the flag only tells the form to present it as
-- pending a compliance decision. Existing rows default to false. Adding a
-- column fires no row trigger, so published versions stay untouched.

alter table public.policy_overrides
  add column provisional boolean not null default false;

comment on column public.policy_overrides.provisional is
  'True when the policy template marks this override as provisional (template JSON "status" starting with "provisional"). Informational only: app.evaluate_cra() ignores it.';

-- 2. Override fact-schema derivation (shared) -------------------------------------
-- TASK-033's rule, extracted verbatim from public.run_customer_assessment():
--   * allowed values for an override fact key = the union of match_values
--     across every override of the version sharing that fact_key, plus
--   * the explicit negative value: false when any of those match_values is a
--     JSON boolean, "none" otherwise.
-- Not callable by authenticated/anon: only the security-definer RPCs use it.

create or replace function app.cra_override_negative_value(
  p_tenant_id uuid,
  p_policy_version_id uuid,
  p_fact_key text
) returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when exists (
      select 1
      from public.policy_overrides po, jsonb_array_elements(po.match_values) e
      where po.policy_version_id = p_policy_version_id and po.tenant_id = p_tenant_id and po.fact_key = p_fact_key
        and jsonb_typeof(e) = 'boolean'
    ) then 'false'::jsonb
    else to_jsonb('none'::text)
  end;
$$;

create or replace function app.cra_override_allowed_values(
  p_tenant_id uuid,
  p_policy_version_id uuid,
  p_fact_key text
) returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select
    coalesce(
      (select jsonb_agg(distinct e)
       from public.policy_overrides po, jsonb_array_elements(po.match_values) e
       where po.policy_version_id = p_policy_version_id and po.tenant_id = p_tenant_id and po.fact_key = p_fact_key),
      '[]'::jsonb
    )
    || jsonb_build_array(app.cra_override_negative_value(p_tenant_id, p_policy_version_id, p_fact_key));
$$;

revoke all on function app.cra_override_negative_value(uuid, uuid, text) from public, anon, authenticated;
revoke all on function app.cra_override_allowed_values(uuid, uuid, text) from public, anon, authenticated;

-- 3. public.run_customer_assessment(): same behavior, shared derivation -----------
-- Body identical to 20260927100000_customer_assessment.sql except that the
-- override allowed-values expression now calls
-- app.cra_override_allowed_values(). Signature, grants and comment are kept.

create or replace function public.run_customer_assessment(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_facts jsonb,
  p_correlation_id uuid
) returns public.customer_assessments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_exists boolean;
  v_policy_version_id uuid;
  v_factor_keys text[];
  v_override_keys text[];
  v_allowed_keys text[];
  v_key text;
  v_allowed_values jsonb;
  v_result jsonb;
  v_input_hash text;
  v_existing public.customer_assessments;
  v_assessment public.customer_assessments;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'assessment.run') then
    raise exception 'Missing assessment.run capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  select exists (
    select 1 from public.customers where id = p_customer_id and tenant_id = p_tenant_id
  ) into v_customer_exists;
  if not v_customer_exists then
    raise exception 'Customer % not found in tenant %', p_customer_id, p_tenant_id using errcode = 'P0002';
  end if;

  if p_facts is null or jsonb_typeof(p_facts) <> 'object' then
    raise exception 'Assessment facts must be a JSON object' using errcode = '22023';
  end if;

  select id into v_policy_version_id
  from public.policy_versions
  where tenant_id = p_tenant_id and status = 'published' and engine_kind = 'cra_v2'
  order by published_at desc
  limit 1;

  if v_policy_version_id is null then
    raise exception 'Tenant % has no published cra_v2 policy version', p_tenant_id using errcode = 'P0003';
  end if;

  select coalesce(array_agg(distinct factor_key), '{}')
  into v_factor_keys
  from public.policy_category_factors
  where policy_version_id = v_policy_version_id and tenant_id = p_tenant_id;

  select coalesce(array_agg(distinct fact_key), '{}')
  into v_override_keys
  from public.policy_overrides
  where policy_version_id = v_policy_version_id and tenant_id = p_tenant_id;

  v_allowed_keys := v_factor_keys || v_override_keys;

  for v_key in select jsonb_object_keys(p_facts) loop
    if not (v_key = any (v_allowed_keys)) then
      raise exception 'Unknown fact key % for policy version %', v_key, v_policy_version_id using errcode = '22023';
    end if;
  end loop;

  foreach v_key in array v_override_keys loop
    if not (p_facts ? v_key) or jsonb_typeof(p_facts -> v_key) = 'null' then
      raise exception 'Override fact % is required and must be an explicit screening result (never absent or null)', v_key
        using errcode = '22023';
    end if;

    v_allowed_values := app.cra_override_allowed_values(p_tenant_id, v_policy_version_id, v_key);

    if not (v_allowed_values @> jsonb_build_array(p_facts -> v_key)) then
      raise exception 'Override fact % has an unsupported value for policy version %', v_key, v_policy_version_id
        using errcode = '22023';
    end if;
  end loop;

  v_input_hash := encode(
    digest(v_policy_version_id::text || '|' || p_customer_id::text || '|' || p_facts::text, 'sha256'),
    'hex'
  );

  -- Advisory lock on (tenant_id, correlation_id), same pattern as
  -- run_supplier_evaluation (namespace 1) and record_supplier_final_decision
  -- (namespace 0): namespaced 2 here so the three lock domains cannot collide.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_correlation_id::text, 2));

  select * into v_existing
  from public.customer_assessments
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;

  if found then
    if v_existing.input_hash is distinct from v_input_hash then
      raise exception 'Correlation id % was already used with different assessment input for tenant %',
        p_correlation_id, p_tenant_id
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  v_result := app.evaluate_cra(p_tenant_id, v_policy_version_id, p_facts);

  insert into public.customer_assessments (
    tenant_id, customer_id, policy_version_id, facts, result,
    overall_score, band, dd_level, outcome, next_review_due,
    correlation_id, input_hash, assessed_by
  ) values (
    p_tenant_id, p_customer_id, v_policy_version_id, p_facts, v_result,
    (v_result ->> 'overall_score')::numeric, v_result ->> 'band', v_result ->> 'dd_level', v_result ->> 'outcome',
    (current_date + ((v_result ->> 'review_months')::int || ' months')::interval)::date,
    p_correlation_id, v_input_hash, auth.uid()
  )
  returning * into v_assessment;

  -- No personal data (name, date of birth, etc.): only the recommendation
  -- shape, matching the audit-metadata posture of
  -- public.record_supplier_final_decision().
  perform public.record_audit_event(
    p_tenant_id, 'customer.assessed', 'customer_assessment', v_assessment.id::text, p_correlation_id,
    jsonb_build_object(
      'customer_id', p_customer_id,
      'policy_version_id', v_policy_version_id,
      'band', v_result -> 'band',
      'dd_level', v_result -> 'dd_level',
      'outcome', v_result -> 'outcome',
      'overrides_hit', v_result -> 'overrides_hit'
    )
  );

  return v_assessment;
end;
$$;

-- 4. public.get_customer_assessment_form() ----------------------------------------
-- Read-only, so no audit event. Returns the tenant's latest published cra_v2
-- version's form, and nothing that reveals how it is scored:
--   * categories (key, label, position) in position order, each with its
--     factors (key, position, values) in position order; a factor's values
--     are the keys of its points map, sorted by byte order (so the order
--     itself does not leak the points);
--   * overrides: one entry per distinct fact_key, in order of the fact's
--     first override position, with values/negative_value from the shared
--     derivation above and provisional = any of its overrides is provisional.
-- No weight, points, effect, action, approval or override code is returned.

create or replace function public.get_customer_assessment_form(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version public.policy_versions;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'assessment.run') then
    raise exception 'Missing assessment.run capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  select * into v_version
  from public.policy_versions
  where tenant_id = p_tenant_id and status = 'published' and engine_kind = 'cra_v2'
  order by published_at desc
  limit 1;

  if not found then
    raise exception 'Tenant % has no published cra_v2 policy version', p_tenant_id using errcode = 'P0003';
  end if;

  return jsonb_build_object(
    'policy_version_id', v_version.id,
    'policy_label', v_version.label,
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', c.key,
          'label', c.label,
          'position', c.position,
          'factors', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'key', f.factor_key,
                'position', f.position,
                'values', (
                  select coalesce(jsonb_agg(k order by k collate "C"), '[]'::jsonb)
                  from jsonb_object_keys(f.points) as k
                )
              )
              order by f.position
            )
            from public.policy_category_factors f
            where f.policy_version_id = c.policy_version_id and f.tenant_id = c.tenant_id and f.category_key = c.key
          ), '[]'::jsonb)
        )
        order by c.position
      )
      from public.policy_categories c
      where c.policy_version_id = v_version.id and c.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fact_key', o.fact_key,
          'values', app.cra_override_allowed_values(p_tenant_id, v_version.id, o.fact_key),
          'negative_value', app.cra_override_negative_value(p_tenant_id, v_version.id, o.fact_key),
          'provisional', o.provisional
        )
        order by o.first_position
      )
      from (
        select fact_key, min(position) as first_position, bool_or(provisional) as provisional
        from public.policy_overrides
        where policy_version_id = v_version.id and tenant_id = p_tenant_id
        group by fact_key
      ) as o
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_customer_assessment_form(uuid) is
  'TASK-034: the facts a CRA assessment needs and the values each accepts, for the tenant''s latest published cra_v2 version. Security definer; checks assessment.run via app.has_tenant_capability_as_member() (D1/D2 apply); P0003 if no published cra_v2 version. Never returns weights or points. Override values come from app.cra_override_allowed_values(), the same derivation public.run_customer_assessment() validates against.';

revoke all on function public.get_customer_assessment_form(uuid) from public, anon;
grant execute on function public.get_customer_assessment_form(uuid) to authenticated;

-- Rollback: drop public.get_customer_assessment_form(uuid); re-apply
-- public.run_customer_assessment() from 20260927100000_customer_assessment.sql
-- (inline derivation); drop app.cra_override_allowed_values(uuid, uuid, text)
-- and app.cra_override_negative_value(uuid, uuid, text); drop column
-- public.policy_overrides.provisional.

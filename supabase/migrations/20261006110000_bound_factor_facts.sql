-- TASK-034 Amendment 1 (from REVIEW-TASK-033, finding L1):
-- bound factor facts before public.run_customer_assessment() persists them.
-- Until now a factor value of any JSON type or size (a multi-megabyte
-- string, an object, a number) was accepted -- the evaluator scored it as
-- missing data -- and written forever into the append-only
-- public.customer_assessments.facts: unbounded growth and an erasure
-- problem. Now a factor fact must be absent, JSON null, or a JSON string of
-- at most 64 characters; anything else is 22023 and nothing is stored.
-- Unmapped string values keep TASK-032's missing-data semantics.

-- 1. The limit, defined once ------------------------------------------------------
-- apps/web/lib/domain/customer-assessment.ts mirrors it
-- (CRA_FACTOR_VALUE_MAX_LENGTH); a unit test keeps the two in sync.

create or replace function app.cra_factor_value_max_length()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select 64;
$$;

revoke all on function app.cra_factor_value_max_length() from public, anon, authenticated;

-- 2. public.run_customer_assessment(): factor facts bounded -------------------------
-- Body identical to 20261006100000_customer_assessment_form.sql plus the
-- factor-fact check right after the unknown-key check. Signature, grants
-- and comment are kept.

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

  -- TASK-034 Amendment 1: a factor fact is absent, JSON null, or a JSON
  -- string of at most app.cra_factor_value_max_length() characters.
  -- Anything else is rejected before anything is persisted.
  foreach v_key in array v_factor_keys loop
    if p_facts ? v_key and jsonb_typeof(p_facts -> v_key) <> 'null' then
      if jsonb_typeof(p_facts -> v_key) <> 'string' then
        raise exception 'Factor fact % must be a JSON string or null', v_key using errcode = '22023';
      end if;
      if char_length(p_facts ->> v_key) > app.cra_factor_value_max_length() then
        raise exception 'Factor fact % exceeds % characters', v_key, app.cra_factor_value_max_length() using errcode = '22023';
      end if;
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


-- 3. The form agrees with the rule ----------------------------------------------------
-- public.get_customer_assessment_form() lists a factor's points-map keys as
-- its allowed values. A cra_v2 version whose points map has a key longer
-- than the limit cannot be published, so the form never lists a value that
-- run_customer_assessment() would reject. A separate trigger (fires before
-- trg_policy_versions_cra_publish_validation, same transition, same 22023)
-- keeps app.validate_cra_policy_on_publish() untouched.

create or replace function app.validate_cra_factor_value_length_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_factor_key text;
begin
  if new.engine_kind is distinct from 'cra_v2' then
    return new;
  end if;
  if not (new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')) then
    return new;
  end if;

  select f.factor_key into v_factor_key
  from public.policy_category_factors f
  where f.policy_version_id = new.id and f.tenant_id = new.tenant_id
    and jsonb_typeof(f.points) = 'object'
    and exists (
      select 1 from jsonb_object_keys(f.points) k
      where char_length(k) > app.cra_factor_value_max_length()
    )
  order by f.factor_key
  limit 1;
  if found then
    raise exception 'CRA policy % factor % has a value longer than % characters', new.id, v_factor_key, app.cra_factor_value_max_length()
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function app.validate_cra_factor_value_length_on_publish() from public, anon, authenticated;

create trigger trg_policy_versions_cra_factor_value_length
  before insert or update on public.policy_versions
  for each row execute function app.validate_cra_factor_value_length_on_publish();

-- Rollback: drop trigger trg_policy_versions_cra_factor_value_length on
-- public.policy_versions; drop app.validate_cra_factor_value_length_on_publish();
-- re-apply public.run_customer_assessment() from
-- 20261006100000_customer_assessment_form.sql; drop
-- app.cra_factor_value_max_length().

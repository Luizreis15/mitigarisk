-- TASK-033: the customer as the assessed subject, and a trusted, persisted,
-- audited CRA assessment on top of app.evaluate_cra (TASK-032). Follows the
-- supplier slice patterns: security-definer RPCs with explicit
-- authorization, atomic audit, immutable evidence, idempotency.
--
-- Closes docs/reviews/REVIEW-TASK-032.md's finding: app.evaluate_cra is a
-- pure function that compares override facts strictly (correct for a pure
-- function), so a caller sending a wrong-typed or wrong-cased override
-- value gets no override at all, silently. public.run_customer_assessment()
-- below is the trusted intake boundary: it validates the whole facts
-- document against the published policy's own structure before ever
-- calling the evaluator, and fails closed with 22023, storing nothing, on
-- any unknown key or unsupported override value.

-- 1. Capabilities -------------------------------------------------------------

insert into public.capabilities (key, description) values
  ('customer.view', 'View tenant customer records and their CRA assessments.'),
  ('customer.manage', 'Create tenant customer records.'),
  ('assessment.run', 'Run a CRA assessment for a tenant customer.')
on conflict (key) do nothing;

insert into public.role_capabilities (role_key, capability_key) values
  ('tenant_admin', 'customer.view'),
  ('tenant_admin', 'customer.manage'),
  ('tenant_admin', 'assessment.run'),
  ('risk_analyst', 'customer.view'),
  ('risk_analyst', 'customer.manage'),
  ('risk_analyst', 'assessment.run'),
  ('operator', 'customer.view'),
  ('operator', 'customer.manage'),
  ('operator', 'assessment.run'),
  ('auditor', 'customer.view')
on conflict do nothing;

-- 2. public.customers -----------------------------------------------------------
-- Minimal personal data (docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md
-- P1.1/P1.2): the fields Template v1's Customer and Geography categories and
-- overrides actually reference. No document numbers, addresses, or contact
-- details -- out of scope for this task. Country codes are ISO 3166-1
-- alpha-2 *shape* only, same posture as public.suppliers.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  external_reference text not null check (char_length(external_reference) between 1 and 100),
  full_name text not null check (char_length(full_name) between 1 and 200),
  date_of_birth date not null check (date_of_birth < current_date),
  country_of_birth text not null check (country_of_birth ~ '^[A-Z]{2}$'),
  nationality text not null check (nationality ~ '^[A-Z]{2}$'),
  residence_country text not null check (residence_country ~ '^[A-Z]{2}$'),
  onboarding_channel text not null check (onboarding_channel in ('face_to_face', 'non_face_to_face')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_reference),
  unique (id, tenant_id)
);

create index idx_customers_tenant_id on public.customers (tenant_id);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

-- Identity/provenance frozen after insert, mirrors app.guard_supplier_identity()
-- (20260914120100_suppliers.sql): self-row only, no cross-table read, so
-- security invoker is correct here (the TASK-029 lesson does not apply).
create or replace function app.guard_customer_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.external_reference is distinct from old.external_reference
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Customer identity and creation provenance cannot be changed'
      using errcode = '23001';
  end if;
  return new;
end;
$$;

create trigger trg_customers_identity_guard
  before update on public.customers
  for each row execute function app.guard_customer_identity();

alter table public.customers enable row level security;

create policy customers_select on public.customers
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'customer.view')
  );

-- No insert/update/delete policy for authenticated/anon: every write goes
-- through public.create_customer() below. Direct writes are also revoked at
-- the grant level so they fail on the grant itself, not only on RLS.
revoke insert, update, delete on public.customers from authenticated, anon;

-- 3. public.customer_assessments -------------------------------------------------
-- Append-only evidence, mirrors public.evaluations/public.supplier_final_decisions:
-- the facts snapshot and the exact app.evaluate_cra() result are both
-- stored verbatim, plus denormalized columns for cheap listing/filtering.

create table public.customer_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  policy_version_id uuid not null,
  facts jsonb not null,
  result jsonb not null,
  overall_score numeric not null,
  band text not null check (band in ('LOW', 'MEDIUM', 'HIGH')),
  dd_level text not null check (dd_level in ('SDD', 'CDD', 'EDD')),
  outcome text not null check (outcome in ('PROCEED', 'REVIEW_REQUIRED', 'REJECT')),
  next_review_due date not null,
  correlation_id uuid not null,
  input_hash text not null,
  assessed_by uuid not null references auth.users (id),
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, correlation_id),
  foreign key (customer_id, tenant_id) references public.customers (id, tenant_id),
  foreign key (policy_version_id, tenant_id) references public.policy_versions (id, tenant_id)
);

create index idx_customer_assessments_tenant_id on public.customer_assessments (tenant_id);
create index idx_customer_assessments_customer_id on public.customer_assessments (customer_id);

-- Append-only: no column is ever mutated, including by an admin, mirroring
-- public.audit_events/public.supplier_final_decisions. app.forbid_mutation()
-- is self-contained (raises unconditionally, no cross-table read), so it is
-- unaffected by the TASK-029 security-invoker lesson.
create trigger trg_customer_assessments_append_only
  before update or delete on public.customer_assessments
  for each row execute function app.forbid_mutation();

alter table public.customer_assessments enable row level security;

create policy customer_assessments_select on public.customer_assessments
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'customer.view')
  );

-- No insert/update/delete policy: the only write path is
-- public.run_customer_assessment() below.
revoke insert, update, delete on public.customer_assessments from authenticated, anon;

-- 4. public.create_customer() ----------------------------------------------------
-- Mirrors public.create_supplier(): security definer (no authenticated
-- insert grant/policy exists), checks customer.manage via
-- app.has_tenant_capability_as_member() (no platform-admin bypass), pins
-- created_by/updated_by to auth.uid(), records a mandatory atomic audit
-- event. Idempotent on (tenant_id, external_reference): a replay with the
-- exact same fields returns the existing row; a replay with any different
-- field is a stable typed conflict (23505), never a silent overwrite --
-- same posture as public.run_supplier_evaluation()'s correlation-id replay.

create or replace function public.create_customer(
  p_tenant_id uuid,
  p_external_reference text,
  p_full_name text,
  p_date_of_birth date,
  p_country_of_birth text,
  p_nationality text,
  p_residence_country text,
  p_onboarding_channel text
) returns public.customers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.customers;
  v_customer public.customers;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'customer.manage') then
    raise exception 'Missing customer.manage capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  select * into v_existing
  from public.customers
  where tenant_id = p_tenant_id and external_reference = p_external_reference;

  if found then
    if v_existing.full_name = p_full_name
       and v_existing.date_of_birth = p_date_of_birth
       and v_existing.country_of_birth = p_country_of_birth
       and v_existing.nationality = p_nationality
       and v_existing.residence_country = p_residence_country
       and v_existing.onboarding_channel = p_onboarding_channel
    then
      return v_existing;
    end if;
    raise exception 'Customer reference % already exists with different data for tenant %', p_external_reference, p_tenant_id
      using errcode = '23505';
  end if;

  insert into public.customers (
    tenant_id, external_reference, full_name, date_of_birth, country_of_birth,
    nationality, residence_country, onboarding_channel, created_by, updated_by
  ) values (
    p_tenant_id, p_external_reference, p_full_name, p_date_of_birth, p_country_of_birth,
    p_nationality, p_residence_country, p_onboarding_channel, auth.uid(), auth.uid()
  )
  returning * into v_customer;

  perform public.record_audit_event(
    p_tenant_id, 'customer.created', 'customer', v_customer.id::text, null,
    jsonb_build_object('external_reference', p_external_reference)
  );

  return v_customer;
end;
$$;

comment on function public.create_customer(uuid, text, text, date, text, text, text, text) is
  'Only path to create a customer: security definer, checks customer.manage via app.has_tenant_capability_as_member() (no platform-admin bypass), pins created_by/updated_by to auth.uid(), records a mandatory audit event atomically, and is idempotent on (tenant_id, external_reference).';

revoke all on function public.create_customer(uuid, text, text, date, text, text, text, text) from public;
grant execute on function public.create_customer(uuid, text, text, date, text, text, text, text) to authenticated;

-- 5. public.run_customer_assessment() --------------------------------------------
-- The trusted intake boundary and the only write path for a CRA assessment.
-- Strict validation is derived from the published policy's own structure,
-- not hard-coded to Template v1, so a future policy version with different
-- factors/overrides is validated correctly without a code change:
--   * allowed keys = this version's factor keys, union its override fact
--     keys;
--   * a key in the facts document that is not an allowed key -> 22023;
--   * an override fact key must be present and non-null in the facts
--     document (screening results must be explicit) -> 22023 if absent or
--     JSON null;
--   * an override fact's value must equal, by JSON-typed comparison (jsonb
--     "@>" -- true type-and-value equality, so "true" the string is never
--     confused with true the boolean, and "Confirmed" is never confused
--     with "confirmed"), one of that fact key's declared match_values
--     (unioned across every override sharing the same fact_key) plus the
--     explicit negative value for a fact key that never hits: false when
--     any of its match_values is a JSON boolean, "none" when its
--     match_values are JSON strings (Template v1's own convention: every
--     string-valued override fact already uses "none" as its negative
--     value in the casebook and nowhere lists it as a match value) ->
--     22023 if the value is not in that set;
--   * a factor key's value, if present, is passed through unchanged: it is
--     app.evaluate_cra()'s own job to treat an absent, null, or unmapped
--     factor value as missing data (DATA_MISSING_*/INVALID_VALUE_* reason
--     codes), per TASK-032's casebook (CB-19, CB-20). Validating factor
--     values strictly here would reject cases the casebook requires to
--     succeed with degraded data quality instead.

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

    select
      coalesce(
        (select jsonb_agg(distinct e)
         from public.policy_overrides po, jsonb_array_elements(po.match_values) e
         where po.policy_version_id = v_policy_version_id and po.tenant_id = p_tenant_id and po.fact_key = v_key),
        '[]'::jsonb
      )
      || case
        when exists (
          select 1
          from public.policy_overrides po, jsonb_array_elements(po.match_values) e
          where po.policy_version_id = v_policy_version_id and po.tenant_id = p_tenant_id and po.fact_key = v_key
            and jsonb_typeof(e) = 'boolean'
        ) then jsonb_build_array(false)
        else jsonb_build_array('none'::text)
      end
    into v_allowed_values;

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

comment on function public.run_customer_assessment(uuid, uuid, jsonb, uuid) is
  'The only path to run a CRA customer assessment. Security definer; checks assessment.run via app.has_tenant_capability_as_member(); validates every fact against the published cra_v2 policy''s own structure before any computation, failing closed with 22023 on an unknown key or an unsupported/missing/null override value (closes docs/reviews/REVIEW-TASK-032.md); calls app.evaluate_cra() for the actual scoring; persists atomically with a mandatory, PII-free audit event; serializes and replays concurrent identical calls by correlation id.';

revoke all on function public.run_customer_assessment(uuid, uuid, jsonb, uuid) from public;
grant execute on function public.run_customer_assessment(uuid, uuid, jsonb, uuid) to authenticated;

-- Rollback: this migration only creates objects (two tables with their
-- triggers/policies/indexes, three functions, two capabilities and their
-- role grants); no existing table, column, or function is altered. Restore
-- by: dropping public.run_customer_assessment(uuid, uuid, jsonb, uuid);
-- dropping public.create_customer(uuid, text, text, date, text, text, text, text);
-- dropping table public.customer_assessments (cascades its policy/trigger);
-- dropping app.guard_customer_identity() and table public.customers
-- (cascades its policy/triggers); deleting the three role_capabilities
-- inserts and the three capabilities rows above.

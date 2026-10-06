-- TASK-034 verification: public.get_customer_assessment_form().
-- Proves the exact form for the seeded demo policy, that no weight, points or
-- any other scoring detail leaks, that every override value the form lists is
-- exactly what public.run_customer_assessment() accepts (each listed value is
-- submitted successfully, an unlisted one is rejected with 22023), and the
-- full authorization matrix (roles, outsider, D1, D2, no published policy).
--
-- Run in a single psql session after 000-local-auth-shim.sql, all
-- migrations and supabase/seed.sql. See supabase/tests/README.md.

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not p_condition then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
  raise notice 'ok - %', p_message;
end;
$$;

create or replace function pg_temp.sqlstate_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlstate;
end;
$$;

-- Fixtures: demo tenant D = ...0004 (published cra_v2 policy P = 2000...0020
-- from the dev seed), demo customer C3 = 3000...0003, Meridian M = ...0003
-- (weighted_v1 only, no cra_v2). The seed gives D a tenant_admin (002) and an
-- operator (004); add a risk_analyst (003) and an auditor (005) here.
insert into public.memberships (tenant_id, user_id, role_key, status) values
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'risk_analyst', 'active'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'auditor', 'active')
on conflict (tenant_id, user_id) do nothing;

create temp table form_snapshot (form jsonb) on commit drop;
grant select, insert on form_snapshot to authenticated;

-- 0. Grants -------------------------------------------------------------------
select pg_temp.assert(
  has_function_privilege('authenticated', 'public.get_customer_assessment_form(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_customer_assessment_form(uuid)', 'execute'),
  'get_customer_assessment_form is executable by authenticated only (not anon)'
);
select pg_temp.assert(
  not has_function_privilege('authenticated', 'app.cra_override_allowed_values(uuid, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'app.cra_override_negative_value(uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'app.cra_override_allowed_values(uuid, uuid, text)', 'execute'),
  'the shared derivation helpers are not callable by authenticated/anon'
);
select pg_temp.assert(
  pg_get_functiondef('public.run_customer_assessment(uuid, uuid, jsonb, uuid)'::regprocedure) like '%app.cra_override_allowed_values(%'
  and pg_get_functiondef('public.get_customer_assessment_form(uuid)'::regprocedure) like '%app.cra_override_allowed_values(%',
  'the form and run_customer_assessment derive override values from the same helper'
);

-- 1. Shape and exact content for the seeded demo policy (as the operator) -----
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
insert into form_snapshot select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004');
select pg_temp.assert(
  (select count(*) from public.policy_category_factors where tenant_id = '10000000-0000-0000-0000-000000000004') = 0,
  'the operator has no policy.view: the raw policy tables return nothing to it'
);
select pg_temp.assert(
  (select form from form_snapshot) = public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004'),
  'the form is deterministic (two calls return the same document)'
);
reset role;

select pg_temp.assert(
  (select form from form_snapshot) = $expected${
    "policy_version_id": "20000000-0000-0000-0000-000000000020",
    "policy_label": "MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)",
    "categories": [
      {"key": "customer", "label": "Customer", "position": 1, "factors": [
        {"key": "purpose", "position": 1, "values": ["ecommerce", "gambling", "multipurpose"]},
        {"key": "employment_status", "position": 2, "values": ["employed", "retired", "self_employed", "student", "unemployed"]},
        {"key": "occupation_risk", "position": 3, "values": ["cash_intensive", "high_risk", "standard"]},
        {"key": "adverse_media_non_material", "position": 4, "values": ["multiple", "none", "single"]},
        {"key": "prior_str", "position": 5, "values": ["none", "one_or_more"]}
      ]},
      {"key": "geography", "label": "Geography", "position": 2, "factors": [
        {"key": "residence_country_risk", "position": 1, "values": ["high_risk_third_country", "higher", "standard"]},
        {"key": "nationality_risk", "position": 2, "values": ["high_risk_third_country", "higher", "standard"]},
        {"key": "sow_country_risk", "position": 3, "values": ["high_risk_third_country", "higher", "standard"]}
      ]},
      {"key": "product_payment", "label": "Product / Service / Payment", "position": 3, "factors": [
        {"key": "payment_method", "position": 1, "values": ["bank_transfer", "card", "cash"]},
        {"key": "product_type", "position": 2, "values": ["closed_loop", "open_loop"]}
      ]},
      {"key": "channel", "label": "Delivery channel", "position": 4, "factors": [
        {"key": "channel", "position": 1, "values": ["face_to_face", "non_face_to_face"]}
      ]},
      {"key": "transactions", "label": "Transactions", "position": 5, "factors": [
        {"key": "affordability", "position": 1, "values": ["above_limit", "near_limit", "not_observed", "within"]},
        {"key": "behaviour_change", "position": 2, "values": ["moderate", "none", "not_observed", "significant"]},
        {"key": "high_value_transactions", "position": 3, "values": ["no", "not_observed", "yes"]}
      ]}
    ],
    "overrides": [
      {"fact_key": "sanctions_match", "values": ["confirmed", "inconclusive", "none"], "negative_value": "none", "provisional": false},
      {"fact_key": "blacklisted_country_link", "values": [true, false], "negative_value": false, "provisional": false},
      {"fact_key": "pep_status", "values": ["confirmed", "self_declared", "none"], "negative_value": "none", "provisional": false},
      {"fact_key": "adverse_media_material", "values": ["material", "potential", "none"], "negative_value": "none", "provisional": false},
      {"fact_key": "hnwi", "values": [true, false], "negative_value": false, "provisional": true}
    ]
  }$expected$::jsonb,
  'the demo form has the exact expected categories, factors, values and overrides (OVR_HNWI provisional)'
);

-- Every factor's values are exactly its points-map keys, and every factor and
-- override of the version appears once (checked against the raw tables).
select pg_temp.assert(
  (
    select count(*) = 14 and bool_and(
      (select jsonb_agg(k order by k collate "C") from jsonb_object_keys(f.points) k) = ff.values
    )
    from public.policy_category_factors f
    join (
      select fct ->> 'key' as factor_key, fct -> 'values' as values
      from form_snapshot, jsonb_array_elements(form -> 'categories') cat, jsonb_array_elements(cat -> 'factors') fct
    ) ff on ff.factor_key = f.factor_key
    where f.policy_version_id = '20000000-0000-0000-0000-000000000020'
  ),
  'all 14 factors are listed, each with exactly the keys of its points map'
);
select pg_temp.assert(
  (select array_agg(o ->> 'fact_key' order by o ->> 'fact_key') from form_snapshot, jsonb_array_elements(form -> 'overrides') o)
  = (select array_agg(distinct fact_key order by fact_key) from public.policy_overrides where policy_version_id = '20000000-0000-0000-0000-000000000020'),
  'every override fact key of the version is listed exactly once'
);

-- 2. No scoring detail anywhere in the output ---------------------------------
select pg_temp.assert(
  not jsonb_path_exists((select form from form_snapshot), 'lax $.**.weight')
  and not jsonb_path_exists((select form from form_snapshot), 'lax $.**.points'),
  'no weight or points key appears anywhere in the form'
);
select pg_temp.assert(
  (
    select array_agg(distinct k order by k)
    from form_snapshot, jsonb_path_query(form, 'lax $.**') as n(v),
         lateral jsonb_object_keys(case when jsonb_typeof(n.v) = 'object' then n.v else '{}'::jsonb end) as k
  ) = array['categories', 'fact_key', 'factors', 'key', 'label', 'negative_value', 'overrides', 'policy_label', 'policy_version_id', 'position', 'provisional', 'values'],
  'the form contains only the whitelisted keys (no weight, points, effect, actions, approvals, code, bands)'
);
select pg_temp.assert(
  (select form::text from form_snapshot) !~ '"(weight|points|effect|actions|approvals|code|missing_factor_points)"',
  'no scoring-related key name appears anywhere in the serialized form'
);

-- 3. Override values == what run_customer_assessment accepts (as the operator) --
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
do $$
declare
  v_form jsonb := (select form from form_snapshot);
  v_base jsonb;
  v_override jsonb;
  v_value jsonb;
  v_corr uuid;
  v_row public.customer_assessments;
  v_accepted int := 0;
begin
  -- A clean baseline built from the form itself: the first value of every
  -- factor, and every override fact at its negative value.
  select jsonb_object_agg(fct ->> 'key', fct -> 'values' -> 0)
  into v_base
  from jsonb_array_elements(v_form -> 'categories') cat, jsonb_array_elements(cat -> 'factors') fct;
  select v_base || jsonb_object_agg(o ->> 'fact_key', o -> 'negative_value')
  into v_base
  from jsonb_array_elements(v_form -> 'overrides') o;

  v_row := public.run_customer_assessment(
    '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', v_base, gen_random_uuid()
  );
  perform pg_temp.assert(v_row.id is not null and v_row.result -> 'missing_factors' = '[]'::jsonb,
    'a seeded demo customer is assessed successfully from a facts document built only from the form (no missing factors)');

  for v_override in select value from jsonb_array_elements(v_form -> 'overrides') loop
    for v_value in select value from jsonb_array_elements(v_override -> 'values') loop
      v_row := public.run_customer_assessment(
        '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003',
        v_base || jsonb_build_object(v_override ->> 'fact_key', v_value), gen_random_uuid()
      );
      if v_row.id is null then
        raise exception 'ASSERTION FAILED: listed value % for % was not accepted', v_value, v_override ->> 'fact_key';
      end if;
      v_accepted := v_accepted + 1;
      raise notice 'ok - listed override value % for % is accepted by run_customer_assessment', v_value, v_override ->> 'fact_key';
    end loop;

    v_corr := gen_random_uuid();
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format(
        $q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, %L::jsonb, %L::uuid)$q$,
        v_base || jsonb_build_object(v_override ->> 'fact_key', 'not_a_listed_value'), v_corr
      )) = '22023'
      and not exists (select 1 from public.customer_assessments where tenant_id = '10000000-0000-0000-0000-000000000004' and correlation_id = v_corr),
      format('an unlisted value for %s is rejected with 22023 and nothing is stored', v_override ->> 'fact_key')
    );
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format(
        $q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, %L::jsonb, gen_random_uuid())$q$,
        v_base - (v_override ->> 'fact_key')
      )) = '22023',
      format('the listed override fact %s is required by run_customer_assessment (absent -> 22023)', v_override ->> 'fact_key')
    );
  end loop;

  perform pg_temp.assert(v_accepted = 13, format('all 13 listed override values were accepted (got %s)', v_accepted));
end;
$$;

-- 3b. TASK-034 Amendment 1: every listed factor value satisfies the factor
-- bound and is accepted by run_customer_assessment, scored (not missing).
do $$
declare
  v_form jsonb := (select form from form_snapshot);
  v_base jsonb;
  v_factor jsonb;
  v_value jsonb;
  v_row public.customer_assessments;
  v_accepted int := 0;
begin
  select jsonb_object_agg(fct ->> 'key', fct -> 'values' -> 0)
  into v_base
  from jsonb_array_elements(v_form -> 'categories') cat, jsonb_array_elements(cat -> 'factors') fct;
  select v_base || jsonb_object_agg(o ->> 'fact_key', o -> 'negative_value')
  into v_base
  from jsonb_array_elements(v_form -> 'overrides') o;

  for v_factor in select fct from jsonb_array_elements(v_form -> 'categories') cat, jsonb_array_elements(cat -> 'factors') fct loop
    for v_value in select value from jsonb_array_elements(v_factor -> 'values') loop
      if jsonb_typeof(v_value) <> 'string' or char_length(v_value #>> '{}') > 64 then
        raise exception 'ASSERTION FAILED: listed value % for % violates the factor bound', v_value, v_factor ->> 'key';
      end if;
      v_row := public.run_customer_assessment(
        '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003',
        v_base || jsonb_build_object(v_factor ->> 'key', v_value), gen_random_uuid()
      );
      if v_row.result -> 'missing_factors' <> '[]'::jsonb then
        raise exception 'ASSERTION FAILED: listed value % for % was scored as missing', v_value, v_factor ->> 'key';
      end if;
      v_accepted := v_accepted + 1;
    end loop;
  end loop;

  perform pg_temp.assert(v_accepted = 43,
    format('all 43 listed factor values are strings within the 64-character bound and are accepted and scored (got %s)', v_accepted));
end;
$$;
reset role;

-- 4. Authorization -----------------------------------------------------------------
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(
  public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004') = (select form from form_snapshot),
  'tenant_admin (assessment.run) gets the form'
);
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
select pg_temp.assert(
  public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004') = (select form from form_snapshot),
  'risk_analyst (assessment.run) gets the form'
);
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004')$q$) = '42501',
  'auditor (no assessment.run) is denied the form (42501)'
);
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004')$q$) = '42501',
  'an outsider with no membership in the tenant is denied the form (42501)'
);
reset role;

-- D1: dual-role platform admin, and platform admin with no membership.
insert into public.memberships (tenant_id, user_id, role_key, status, invited_by) values
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'tenant_admin', 'active', '00000000-0000-0000-0000-000000000002');
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004')$q$) = '42501',
  'D1: dual-role platform admin is denied the form despite an active tenant_admin membership'
);
reset role;
delete from public.memberships where tenant_id = '10000000-0000-0000-0000-000000000004' and user_id = '00000000-0000-0000-0000-000000000001';

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004')$q$) = '42501',
  'D1: platform admin with no membership is denied the form'
);
reset role;

-- D2: suspended tenant.
update public.tenants set status = 'suspended' where id = '10000000-0000-0000-0000-000000000004';
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004')$q$) = '42501',
  'D2: suspended-tenant admin is denied the form'
);
reset role;
update public.tenants set status = 'active' where id = '10000000-0000-0000-0000-000000000004';

-- Authorized but no published cra_v2 policy: Meridian (weighted_v1 only).
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000003')$q$) = 'P0003',
  'a tenant with no published cra_v2 policy (Meridian) raises P0003'
);
reset role;

-- Unauthenticated: anon cannot execute it at all.
set role anon; set local "request.jwt.claim.role" = 'anon'; set local "request.jwt.claim.sub" = '';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004')$q$) = '42501',
  'anon is denied execute on the form (42501)'
);
reset role;

-- 5. TASK-034 Amendment 1: a policy whose points map has a key longer than
-- the factor bound cannot be published, so the form can never list it.
-- Runs last: the boundary copy becomes the demo tenant's latest version.
create or replace function pg_temp.copy_demo_cra(p_version_number int)
returns uuid language plpgsql as $$
declare
  v_new uuid := gen_random_uuid();
  v_src constant uuid := '20000000-0000-0000-0000-000000000020';
  v_tenant constant uuid := '10000000-0000-0000-0000-000000000004';
begin
  insert into public.policy_versions (id, tenant_id, version_number, status, created_by, engine_kind, label, missing_factor_points)
  select v_new, v_tenant, p_version_number, 'draft', '00000000-0000-0000-0000-000000000002', 'cra_v2', label, missing_factor_points
  from public.policy_versions where id = v_src;
  insert into public.policy_categories (tenant_id, policy_version_id, key, label, weight, position)
  select v_tenant, v_new, key, label, weight, position from public.policy_categories where policy_version_id = v_src;
  insert into public.policy_category_factors (tenant_id, policy_version_id, category_key, factor_key, weight, position, points)
  select v_tenant, v_new, category_key, factor_key, weight, position, points from public.policy_category_factors where policy_version_id = v_src;
  insert into public.policy_overrides (tenant_id, policy_version_id, code, position, fact_key, match_values, effect, actions, approvals, provisional)
  select v_tenant, v_new, code, position, fact_key, match_values, effect, actions, approvals, provisional from public.policy_overrides where policy_version_id = v_src;
  insert into public.policy_cra_bands (tenant_id, policy_version_id, band, min_score, max_score, max_inclusive, dd_level, review_months, actions, approvals)
  select v_tenant, v_new, band, min_score, max_score, max_inclusive, dd_level, review_months, actions, approvals from public.policy_cra_bands where policy_version_id = v_src;
  return v_new;
end;
$$;

do $$
declare
  v_long uuid := pg_temp.copy_demo_cra(90);
  v_edge uuid := pg_temp.copy_demo_cra(91);
  v_state text;
begin
  update public.policy_category_factors
  set points = points || jsonb_build_object(repeat('y', 65), 100)
  where policy_version_id = v_long and factor_key = 'purpose';
  begin
    update public.policy_versions
    set status = 'published', effective_from = now(), published_at = now(), published_by = '00000000-0000-0000-0000-000000000002'
    where id = v_long;
    v_state := 'OK';
  exception when others then
    v_state := sqlstate;
  end;
  perform pg_temp.assert(v_state = '22023', 'publish is blocked with 22023 when a points-map key exceeds 64 characters');
  perform pg_temp.assert((select status from public.policy_versions where id = v_long) = 'draft',
    'no partial publish when a points-map key exceeds 64 characters');

  update public.policy_category_factors
  set points = points || jsonb_build_object(repeat('y', 64), 100)
  where policy_version_id = v_edge and factor_key = 'purpose';
  update public.policy_versions
  set status = 'published', effective_from = now(), published_at = now(), published_by = '00000000-0000-0000-0000-000000000002'
  where id = v_edge;
  perform pg_temp.assert((select status from public.policy_versions where id = v_edge) = 'published',
    'a points-map key of exactly 64 characters publishes');
end;
$$;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select pg_temp.assert(
  (select fct -> 'values' @> to_jsonb(array[repeat('y', 64)])
   from jsonb_array_elements(public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004') -> 'categories') cat,
        jsonb_array_elements(cat -> 'factors') fct
   where fct ->> 'key' = 'purpose'),
  'the form lists the 64-character value of the newest published version'
);
do $$
declare
  v_facts jsonb := (select c from (
    select jsonb_object_agg(fct ->> 'key', fct -> 'values' -> 0) as c
    from jsonb_array_elements(public.get_customer_assessment_form('10000000-0000-0000-0000-000000000004') -> 'categories') cat,
         jsonb_array_elements(cat -> 'factors') fct) s);
  v_row public.customer_assessments;
begin
  v_facts := v_facts || '{"sanctions_match": "none", "blacklisted_country_link": false, "pep_status": "none", "adverse_media_material": "none", "hnwi": false}'::jsonb
             || jsonb_build_object('purpose', repeat('y', 64));
  v_row := public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', v_facts, gen_random_uuid());
  perform pg_temp.assert(v_row.result -> 'missing_factors' = '[]'::jsonb,
    'run_customer_assessment accepts and scores that listed 64-character value (form and RPC agree at the boundary)');
end;
$$;
reset role;

do $$
begin
  raise notice 'Assessment form verification completed successfully.';
end;
$$;

rollback;

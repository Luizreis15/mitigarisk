-- Hosted demo tenant: "MITIGA Demo Ltd." with the published MITIGA EU
-- Payments & Gaming CRA (Template v1 DRAFT) and three fictional, assessed
-- customers. Approved by the project owner on 2026-10-06.
--
-- NOT a migration and NOT the dev seed. Render it with
-- scripts/hosted/render-demo-tenant.mjs, which injects the template from
-- apps/web/tests/fixtures/cra-template-v1-draft.json and the demo account
-- e-mails (never committed). The demo accounts must already exist in
-- Supabase Auth.
--
-- Every tenant, membership, customer and assessment write goes through the
-- official security-definer RPCs, acting as the real user (request.jwt.claims),
-- so authorization checks and audit events apply exactly as in the app.
-- Policy rows have no RPC yet (tenant policy authoring is a later task), so
-- they are inserted directly and the publish-time validator checks the whole
-- structure; the publication is audited as the tenant admin.
--
-- Idempotent: does nothing if the tenant slug already exists. Atomic: the
-- renderer wraps it in a single transaction (COMMIT or ROLLBACK).

do $demo$
declare
  c_tenant_name constant text := 'MITIGA Demo Ltd.';
  c_tenant_slug constant text := 'mitiga-demo';
  c_admin_email constant text := lower('__ADMIN_EMAIL__');
  c_operator_email constant text := lower('__OPERATOR_EMAIL__');
  c_auditor_email constant text := lower('__AUDITOR_EMAIL__');
  c_template constant jsonb := $template$__TEMPLATE_JSON__$template$::jsonb;
  v_platform_admin uuid;
  v_admin uuid;
  v_operator uuid;
  v_auditor uuid;
  v_tenant public.tenants;
  v_membership public.memberships;
  v_version uuid := gen_random_uuid();
  v_customer public.customers;
  v_assessment public.customer_assessments;
  v_base_facts jsonb := '{"purpose":"ecommerce","employment_status":"employed","occupation_risk":"standard","adverse_media_non_material":"none","prior_str":"none","residence_country_risk":"standard","nationality_risk":"standard","sow_country_risk":"standard","payment_method":"bank_transfer","product_type":"closed_loop","channel":"face_to_face","affordability":"not_observed","behaviour_change":"not_observed","high_value_transactions":"not_observed","sanctions_match":"none","pep_status":"none","adverse_media_material":"none","hnwi":false,"blacklisted_country_link":false}'::jsonb;
  r record;
begin
  if exists (select 1 from public.tenants where slug = c_tenant_slug) then
    raise notice 'Tenant % already exists; nothing to do.', c_tenant_slug;
    return;
  end if;

  if (select count(*) from public.platform_admins) <> 1 then
    raise exception 'Expected exactly one platform administrator';
  end if;
  select user_id into v_platform_admin from public.platform_admins;

  select id into v_admin from auth.users where lower(email) = c_admin_email;
  select id into v_operator from auth.users where lower(email) = c_operator_email;
  select id into v_auditor from auth.users where lower(email) = c_auditor_email;
  if v_admin is null or v_operator is null or v_auditor is null then
    raise exception 'Every demo account must exist in Supabase Auth before running this script';
  end if;
  if v_platform_admin in (v_admin, v_operator, v_auditor) then
    raise exception 'Demo accounts must not be the platform administrator';
  end if;

  -- 1. Tenant, as the platform administrator (audited: tenant.bootstrapped).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_platform_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_platform_admin::text, true);
  v_tenant := public.bootstrap_tenant(c_tenant_name, c_tenant_slug, v_admin);

  -- 2. Members, invited by the tenant admin and accepted by each user.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  for r in select * from (values (v_operator, 'operator'), (v_auditor, 'auditor')) as m(user_id, role_key) loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    v_membership := public.invite_member(v_tenant.id, r.user_id, r.role_key);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', r.user_id::text, true);
    perform public.accept_invitation(v_membership.id);
  end loop;

  -- 3. Policy, loaded from the template and published as the tenant admin.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  insert into public.policy_versions (
    id, tenant_id, version_number, status, created_by, engine_kind, label, missing_factor_points
  ) values (
    v_version, v_tenant.id, 1, 'draft', v_admin, 'cra_v2',
    'MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)', (c_template ->> 'missing_factor_points')::numeric
  );

  insert into public.policy_categories (tenant_id, policy_version_id, key, label, weight, position)
  select v_tenant.id, v_version, c.value ->> 'key', c.value ->> 'label', (c.value ->> 'weight')::numeric, c.ordinality
  from jsonb_array_elements(c_template -> 'categories') with ordinality as c;

  insert into public.policy_category_factors (tenant_id, policy_version_id, category_key, factor_key, weight, position, points)
  select v_tenant.id, v_version, c.value ->> 'key', f.value ->> 'key', (f.value ->> 'weight')::numeric, f.ordinality, f.value -> 'points'
  from jsonb_array_elements(c_template -> 'categories') as c,
       lateral jsonb_array_elements(c.value -> 'factors') with ordinality as f;

  insert into public.policy_overrides (tenant_id, policy_version_id, code, position, fact_key, match_values, effect, actions, approvals, provisional)
  select v_tenant.id, v_version, o.value ->> 'code', o.ordinality, o.value ->> 'fact', o.value -> 'in',
         o.value ->> 'effect', coalesce(o.value -> 'actions', '[]'::jsonb), coalesce(o.value -> 'approvals', '[]'::jsonb),
         starts_with(coalesce(o.value ->> 'status', ''), 'provisional')
  from jsonb_array_elements(c_template -> 'overrides') with ordinality as o;

  insert into public.policy_cra_bands (tenant_id, policy_version_id, band, min_score, max_score, max_inclusive, dd_level, review_months, actions, approvals)
  select v_tenant.id, v_version, b.value ->> 'band', (b.value ->> 'min')::numeric,
         coalesce(b.value ->> 'max_exclusive', b.value ->> 'max_inclusive')::numeric,
         (b.value ? 'max_inclusive'), b.value ->> 'dd_level', (b.value ->> 'review_months')::integer,
         coalesce(b.value -> 'actions', '[]'::jsonb), coalesce(b.value -> 'approvals', '[]'::jsonb)
  from jsonb_array_elements(c_template -> 'bands') as b;

  update public.policy_versions
  set status = 'published', effective_from = now(), published_at = now()
  where id = v_version and status = 'draft';

  perform public.record_audit_event(
    v_tenant.id, 'policy.published', 'policy_version', v_version::text, null,
    jsonb_build_object('engine_kind', 'cra_v2', 'template_key', c_template ->> 'template_key',
                       'version_label', c_template ->> 'version_label', 'source', 'hosted demo script')
  );

  -- 4. Fictional customers, created and assessed by the operator.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_operator::text, true);
  for r in select * from (values
    ('DEMO-001', 'Alex Example (fictional)', date '1985-04-12', 'MT', 'MT', 'MT', '{}'::jsonb),
    ('DEMO-002', 'Blake Sample (fictional)', date '1972-09-30', 'DE', 'DE', 'MT', '{"pep_status":"confirmed"}'::jsonb),
    ('DEMO-003', 'Casey Placeholder (fictional)', date '1990-01-05', 'CY', 'CY', 'CY', '{"sanctions_match":"confirmed"}'::jsonb)
  ) as c(ext_ref, full_name, dob, cob, nat, res, overrides) loop
    v_customer := public.create_customer(v_tenant.id, r.ext_ref, r.full_name, r.dob, r.cob, r.nat, r.res, 'face_to_face');
    v_assessment := public.run_customer_assessment(v_tenant.id, v_customer.id, v_base_facts || r.overrides, gen_random_uuid());
    raise notice '% -> band %, dd %, outcome %', r.ext_ref, v_assessment.band, v_assessment.dd_level, v_assessment.outcome;
  end loop;

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'Created tenant % (%), policy version %', v_tenant.slug, v_tenant.id, v_version;
end
$demo$;

-- Post-conditions (fail the transaction if anything is off).
do $check$
declare
  v_tenant uuid := (select id from public.tenants where slug = 'mitiga-demo');
begin
  if (select count(*) from public.memberships where tenant_id = v_tenant and status = 'active') <> 3 then
    raise exception 'Expected 3 active memberships';
  end if;
  if (select count(*) from public.policy_versions where tenant_id = v_tenant and status = 'published' and engine_kind = 'cra_v2') <> 1 then
    raise exception 'Expected 1 published cra_v2 policy';
  end if;
  if (select string_agg(band || '/' || outcome, ',' order by c.external_reference)
      from public.customer_assessments a join public.customers c on c.id = a.customer_id
      where a.tenant_id = v_tenant) <> 'LOW/PROCEED,HIGH/REVIEW_REQUIRED,HIGH/REJECT' then
    raise exception 'Unexpected assessment results';
  end if;
end
$check$;

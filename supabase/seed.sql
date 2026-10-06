-- TASK-002: development-only seed data.
-- Applied by `supabase db reset` / `supabase start` against a local project.
-- Every identity, tenant, and record here is fictional. Never point this at
-- a hosted project and never add real customer, employee, or partner data.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-platform-admin@example.test', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-tenant-admin@example.test', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-risk-analyst@example.test', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-operator@example.test', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-auditor@example.test', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-outsider@example.test', '', now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.platform_admins (user_id) values
  ('00000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

insert into public.tenants (id, name, slug, status) values
  ('10000000-0000-0000-0000-000000000001', 'Helix Commerce Ltd.', 'helix-commerce', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'Nimbus Payments Inc.', 'nimbus-payments', 'active'),
  -- TASK-023: a dedicated fictional tenant for the real supplier evaluation
  -- slice, rather than adding a second policy version under Helix Commerce
  -- (10000000-...-0001). supabase/tests/010-rls-tenant-isolation.sql
  -- asserts that tenant has exactly one policy_versions row; a second
  -- published version there would break that unrelated, pre-existing
  -- assertion. A fresh tenant keeps this task's fixtures fully additive.
  ('10000000-0000-0000-0000-000000000003', 'Meridian Industrial Holdings', 'meridian-industrial', 'active')
on conflict (id) do nothing;

insert into public.memberships (tenant_id, user_id, role_key, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'tenant_admin', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'risk_analyst', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'operator', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'auditor', 'active'),
  -- Membership in the second tenant only, to exercise cross-tenant denial in tests.
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', 'tenant_admin', 'active'),
  -- TASK-023: the same fictional dev accounts, mirrored into the dedicated
  -- Meridian tenant so a local browser demo can sign in as any of them.
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'tenant_admin', 'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'risk_analyst', 'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'operator', 'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'auditor', 'active')
on conflict (tenant_id, user_id) do nothing;

insert into public.policy_versions (id, tenant_id, version_number, status, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'draft', '00000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.policy_factors (tenant_id, policy_version_id, key, label, weight) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'kyc_match_score', 'KYC document match score', 0.4),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'sanctions_hit', 'Sanctions list hit', 0.6)
on conflict (policy_version_id, key) do nothing;

insert into public.policy_thresholds (tenant_id, policy_version_id, label, min_score, max_score, decision_band) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Low risk', 0, 30, 'approve'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medium risk', 31, 70, 'review'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'High risk', 71, 100, 'reject');

-- TASK-023: "Supplier onboarding policy" version 1 — the one immutable
-- published policy the real supplier evaluation slice runs against
-- (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md, "Initial
-- policy proposal"), under the dedicated Meridian tenant above. Every
-- factor uses the engine's existing configuration contract (min = 0,
-- max = 100, direction = higher_is_riskier, required = true) exactly as
-- specified by the task; thresholds reuse the engine's existing
-- [min, max) / final-band-inclusive resolution semantics unchanged.
-- Inserted as 'draft' first: app.forbid_children_when_not_draft() (supabase/migrations/20260912120200_risk_policy.sql)
-- rejects inserting factors/thresholds under a parent that is already
-- published. Flipped to 'published' below, after its factors and
-- thresholds exist, exactly like a real draft-then-publish authoring flow.
insert into public.policy_versions (id, tenant_id, version_number, status, created_by) values
  (
    '20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 1, 'draft',
    '00000000-0000-0000-0000-000000000002'
  )
on conflict (id) do nothing;

insert into public.policy_factors (tenant_id, policy_version_id, key, label, weight, config) values
  (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'identity_integrity_risk',
    'Identity integrity risk', 20, '{"min": 0, "max": 100, "direction": "higher_is_riskier", "required": true}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'geographic_risk',
    'Geographic risk', 15, '{"min": 0, "max": 100, "direction": "higher_is_riskier", "required": true}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'ownership_transparency_risk',
    'Ownership transparency risk', 15, '{"min": 0, "max": 100, "direction": "higher_is_riskier", "required": true}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'integrity_screening_risk',
    'Integrity screening risk', 25, '{"min": 0, "max": 100, "direction": "higher_is_riskier", "required": true}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'financial_exposure_risk',
    'Financial exposure risk', 10, '{"min": 0, "max": 100, "direction": "higher_is_riskier", "required": true}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'evidence_quality_risk',
    'Evidence quality risk', 15, '{"min": 0, "max": 100, "direction": "higher_is_riskier", "required": true}'::jsonb
  )
on conflict (policy_version_id, key) do nothing;

insert into public.policy_thresholds (tenant_id, policy_version_id, label, min_score, max_score, decision_band) values
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'Approve', 0, 35, 'approve'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'Review', 35, 70, 'review'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'Reject', 70, 100, 'reject');

update public.policy_versions
set status = 'published', effective_from = now(), published_at = now(), published_by = '00000000-0000-0000-0000-000000000002'
where id = '20000000-0000-0000-0000-000000000010' and status = 'draft';

-- TASK-032 (dev only): the CRA Template v1 DRAFT, loaded EXACTLY from its
-- machine-readable JSON into a NEW fictional tenant as a published cra_v2
-- policy version. The JSON literal below is byte-identical to
-- apps/web/tests/fixtures/cra-template-v1-draft.json (a unit test enforces
-- it); every category, factor, points map, override and band row is derived
-- from that literal with jsonb functions, never typed a second time. The
-- policy numbers are DRAFT until the compliance lead signs them off. Never
-- point this at a hosted project.
-- TASK-034: published here (dev seed only) so the local stack and previews
-- can run public.run_customer_assessment end to end; labelled as a demo.

insert into public.tenants (id, name, slug, status) values
  ('10000000-0000-0000-0000-000000000004', 'EU Payments Demo Ltd.', 'eu-payments-demo', 'active')
on conflict (id) do nothing;

do $seed$
declare
  v_tenant constant uuid := '10000000-0000-0000-0000-000000000004';
  v_version constant uuid := '20000000-0000-0000-0000-000000000020';
  v_template constant jsonb := $template${
  "template_key": "eu-payments-gaming-cra",
  "version_label": "v1-DRAFT",
  "status_note": "DRAFT: Lucimara Oct 2026 closed Q1–Q5,Q7 (customisable weights 0–100; Mitiga branding; tenant-scored lists; 76=HIGH; gambling-industry triggers; MLRO for EDD, board on escalation only). Q6 HNWI definition and Q8 mandatory intake fields still open. Demo weights are illustrative defaults.",
  "missing_factor_points": 50,
  "rounding": "half-up to 2 decimals at category and overall level",
  "categories": [
    {"key": "customer", "label": "Customer", "weight": 20, "factors": [
      {"key": "purpose", "weight": 30, "points": {"ecommerce": 0, "gambling": 50, "multipurpose": 100}},
      {"key": "employment_status", "weight": 20, "points": {"employed": 0, "self_employed": 50, "retired": 50, "student": 50, "unemployed": 100}},
      {"key": "occupation_risk", "weight": 20, "points": {"standard": 0, "cash_intensive": 50, "high_risk": 100}},
      {"key": "adverse_media_non_material", "weight": 15, "points": {"none": 0, "single": 50, "multiple": 100}},
      {"key": "prior_str", "weight": 15, "points": {"none": 0, "one_or_more": 100}}
    ]},
    {"key": "geography", "label": "Geography", "weight": 10, "factors": [
      {"key": "residence_country_risk", "weight": 40, "points": {"standard": 0, "higher": 50, "high_risk_third_country": 100}},
      {"key": "nationality_risk", "weight": 30, "points": {"standard": 0, "higher": 50, "high_risk_third_country": 100}},
      {"key": "sow_country_risk", "weight": 30, "points": {"standard": 0, "higher": 50, "high_risk_third_country": 100}}
    ]},
    {"key": "product_payment", "label": "Product / Service / Payment", "weight": 15, "factors": [
      {"key": "payment_method", "weight": 60, "points": {"bank_transfer": 0, "card": 50, "cash": 100}},
      {"key": "product_type", "weight": 40, "points": {"closed_loop": 0, "open_loop": 100}}
    ]},
    {"key": "channel", "label": "Delivery channel", "weight": 10, "factors": [
      {"key": "channel", "weight": 100, "points": {"face_to_face": 0, "non_face_to_face": 100}}
    ]},
    {"key": "transactions", "label": "Transactions", "weight": 45, "factors": [
      {"key": "affordability", "weight": 50, "points": {"not_observed": 0, "within": 0, "near_limit": 50, "above_limit": 100}},
      {"key": "behaviour_change", "weight": 30, "points": {"not_observed": 0, "none": 0, "moderate": 50, "significant": 100}},
      {"key": "high_value_transactions", "weight": 20, "points": {"not_observed": 0, "no": 0, "yes": 100}}
    ]}
  ],
  "overrides": [
    {"code": "OVR_SANCTIONS_CONFIRMED", "fact": "sanctions_match", "in": ["confirmed"], "effect": "reject", "actions": ["FREEZE_FUNDS_AND_BLOCK_IF_EXISTING", "REJECT_IF_PROSPECT", "REPORT_TO_MLRO"]},
    {"code": "OVR_BLACKLISTED_COUNTRY", "fact": "blacklisted_country_link", "in": [true], "effect": "reject", "actions": ["REJECT_OR_TERMINATE", "REPORT_TO_MLRO"]},
    {"code": "OVR_SANCTIONS_INCONCLUSIVE", "fact": "sanctions_match", "in": ["inconclusive"], "effect": "force_high", "actions": ["BLOCK_PENDING_MANUAL_REVIEW"]},
    {"code": "OVR_PEP", "fact": "pep_status", "in": ["confirmed", "self_declared"], "effect": "force_high", "actions": [], "approvals": ["MLRO"]},
    {"code": "OVR_ADVERSE_MEDIA_MATERIAL", "fact": "adverse_media_material", "in": ["material"], "effect": "force_high", "actions": ["REPORT_TO_MLRO"]},
    {"code": "OVR_ADVERSE_MEDIA_POTENTIAL", "fact": "adverse_media_material", "in": ["potential"], "effect": "force_high", "actions": []},
    {"code": "OVR_HNWI", "fact": "hnwi", "in": [true], "effect": "force_high", "actions": [], "status": "provisional_pending_Q6"}
  ],
  "bands": [
    {"band": "LOW", "min": 0, "max_exclusive": 36, "dd_level": "SDD", "review_months": 36, "approvals": [], "actions": ["IDENTIFY_CUSTOMER", "VERIFY_ID", "ONGOING_SCREENING"]},
    {"band": "MEDIUM", "min": 36, "max_exclusive": 76, "dd_level": "CDD", "review_months": 24, "approvals": [], "actions": ["IDENTIFY_CUSTOMER", "VERIFY_ID", "ONGOING_SCREENING", "OBTAIN_PURPOSE_AND_NATURE"]},
    {"band": "HIGH", "min": 76, "max_inclusive": 100, "dd_level": "EDD", "review_months": 12, "approvals": ["MLRO"], "actions": ["IDENTIFY_CUSTOMER", "VERIFY_ID", "ONGOING_SCREENING", "OBTAIN_PURPOSE_AND_NATURE", "OBTAIN_SOW_SOF_DOCUMENTS"]}
  ],
  "rules": {
    "override_precedence": "reject > force_high; all hit overrides are reported",
    "reject_outcome": "band HIGH, dd_level EDD, outcome REJECT (score still computed and reported)",
    "force_high_outcome": "band HIGH, dd_level EDD, outcome REVIEW_REQUIRED",
    "missing_factor": "factor fact absent or value not in map -> missing_factor_points and DATA_MISSING_<factor> reason; value not in map is also INVALID_VALUE_<factor>"
  }
}$template$::jsonb;
begin
  if exists (select 1 from public.policy_versions where id = v_version) then
    return;
  end if;

  insert into public.policy_versions (
    id, tenant_id, version_number, status, created_by, engine_kind, label, missing_factor_points
  ) values (
    v_version, v_tenant, 1, 'draft', '00000000-0000-0000-0000-000000000002', 'cra_v2',
    'MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)', (v_template ->> 'missing_factor_points')::numeric
  );

  insert into public.policy_categories (tenant_id, policy_version_id, key, label, weight, position)
  select v_tenant, v_version, c.value ->> 'key', c.value ->> 'label', (c.value ->> 'weight')::numeric, c.ordinality
  from jsonb_array_elements(v_template -> 'categories') with ordinality as c;

  insert into public.policy_category_factors (tenant_id, policy_version_id, category_key, factor_key, weight, position, points)
  select v_tenant, v_version, c.value ->> 'key', f.value ->> 'key', (f.value ->> 'weight')::numeric, f.ordinality, f.value -> 'points'
  from jsonb_array_elements(v_template -> 'categories') as c,
       lateral jsonb_array_elements(c.value -> 'factors') with ordinality as f;

  -- TASK-034: an override "status" starting with "provisional" (OVR_HNWI,
  -- pending Lucimara Q6) sets the informational provisional flag; any other
  -- template key the columns below do not name is ignored.
  insert into public.policy_overrides (tenant_id, policy_version_id, code, position, fact_key, match_values, effect, actions, approvals, provisional)
  select v_tenant, v_version, o.value ->> 'code', o.ordinality, o.value ->> 'fact', o.value -> 'in',
         o.value ->> 'effect', coalesce(o.value -> 'actions', '[]'::jsonb), coalesce(o.value -> 'approvals', '[]'::jsonb),
         starts_with(coalesce(o.value ->> 'status', ''), 'provisional')
  from jsonb_array_elements(v_template -> 'overrides') with ordinality as o;

  insert into public.policy_cra_bands (tenant_id, policy_version_id, band, min_score, max_score, max_inclusive, dd_level, review_months, actions, approvals)
  select v_tenant, v_version, b.value ->> 'band', (b.value ->> 'min')::numeric,
         coalesce(b.value ->> 'max_exclusive', b.value ->> 'max_inclusive')::numeric,
         (b.value ? 'max_inclusive'), b.value ->> 'dd_level', (b.value ->> 'review_months')::integer,
         coalesce(b.value -> 'actions', '[]'::jsonb), coalesce(b.value -> 'approvals', '[]'::jsonb)
  from jsonb_array_elements(v_template -> 'bands') as b;

  -- Publish last: the publish-time validator checks the whole structure.
  update public.policy_versions
  set status = 'published', effective_from = now(), published_at = now(),
      published_by = '00000000-0000-0000-0000-000000000002'
  where id = v_version and status = 'draft';
end
$seed$;

-- TASK-033 (dev only): fictional members of the "EU Payments Demo Ltd."
-- tenant (mirrors the same fictional dev accounts already used for the
-- other tenants), plus 3 fictional customers to exercise the CRA
-- assessment flow. Never point this at a hosted project.

insert into public.memberships (tenant_id, user_id, role_key, status) values
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'tenant_admin', 'active'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'operator', 'active')
on conflict (tenant_id, user_id) do nothing;

insert into public.customers (
  id, tenant_id, external_reference, full_name, date_of_birth, country_of_birth,
  nationality, residence_country, onboarding_channel, created_by, updated_by
) values
  (
    '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'CUST-DEMO-001',
    'Elena Marchetti', '1988-04-12', 'IT', 'IT', 'MT', 'face_to_face',
    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'
  ),
  (
    '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'CUST-DEMO-002',
    'Rahim Osei', '1995-11-03', 'GH', 'GH', 'MT', 'non_face_to_face',
    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'
  ),
  (
    '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 'CUST-DEMO-003',
    'Ilse van der Berg', '1979-07-22', 'NL', 'NL', 'MT', 'non_face_to_face',
    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'
  )
on conflict (id) do nothing;

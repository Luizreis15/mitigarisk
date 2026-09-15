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

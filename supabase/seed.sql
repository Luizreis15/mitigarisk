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
  ('10000000-0000-0000-0000-000000000002', 'Nimbus Payments Inc.', 'nimbus-payments', 'active')
on conflict (id) do nothing;

insert into public.memberships (tenant_id, user_id, role_key, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'tenant_admin', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'risk_analyst', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'operator', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'auditor', 'active'),
  -- Membership in the second tenant only, to exercise cross-tenant denial in tests.
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', 'tenant_admin', 'active')
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

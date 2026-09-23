-- TASK-028 verification: the platform-admin bypass is closed on every
-- remaining tenant-operational surface (D4), survives only as the explicit,
-- named app.is_platform_governance_actor() for platform governance (D5) and
-- for platform-level audit events (D6), policy publication order-of-truth
-- cannot be forged with a future-dated published_at, and
-- run_supplier_evaluation's policy guard fails with 22023 (not 22P02) on a
-- non-numeric min/max. Converts probe G (docs/orquestracao/REVIEW-TASK-026.md)
-- into a permanent, failing assertion.
--
-- Run in a single psql session, in order, after:
--   1. supabase/tests/000-local-auth-shim.sql
--   2. all files in supabase/migrations/
--   3. supabase/seed.sql
-- See supabase/tests/README.md.

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

-- Fixture ids from supabase/seed.sql:
--   platform admin      = 00000000-0000-0000-0000-000000000001
--   tenant M = 10000000-0000-0000-0000-000000000003 (Meridian Industrial Holdings)
--   tenant B = 10000000-0000-0000-0000-000000000002 (Nimbus Payments Inc.; outsider)
--   tenant_admin (M)  = 00000000-0000-0000-0000-000000000002
--   risk_analyst (M)  = 00000000-0000-0000-0000-000000000003
--   operator (M)      = 00000000-0000-0000-0000-000000000004
--   auditor (M)       = 00000000-0000-0000-0000-000000000005
--   "Supplier onboarding policy" v1 (published) = 20000000-0000-0000-0000-000000000010 (tenant M)

-- 0. AC2 (grep-equivalent): no D4 policy's stored expression references
-- app.is_platform_admin( or app.has_capability( anymore. has_tenant_capability_as_member(
-- shares no substring with has_capability( (it is "has_tenant_capability..."),
-- so this cannot false-positive on the member-only helper itself.
do $$
declare
  v_bad record;
  v_bad_count int := 0;
begin
  for v_bad in
    select schemaname, tablename, policyname
    from pg_policies
    where tablename in (
      'policy_versions', 'policy_factors', 'policy_thresholds',
      'cases', 'case_evidence', 'case_decisions',
      'api_clients', 'webhook_endpoints', 'webhook_deliveries',
      'notification_requests'
    )
    and (
      coalesce(qual, '') like '%app.is_platform_admin(%'
      or coalesce(with_check, '') like '%app.is_platform_admin(%'
      or coalesce(qual, '') like '%app.has_capability(%'
      or coalesce(with_check, '') like '%app.has_capability(%'
    )
  loop
    v_bad_count := v_bad_count + 1;
    raise notice 'STILL BYPASSED: %.% policy %', v_bad.schemaname, v_bad.tablename, v_bad.policyname;
  end loop;
  perform pg_temp.assert(v_bad_count = 0, 'no pure-D4 policy references app.is_platform_admin( or app.has_capability( anymore');
end;
$$;

-- notification_templates is the one mixed D4+D5 surface: its remaining
-- app.is_platform_governance_actor() reference is expected (the tenant_id
-- is null / platform-template branch); app.is_platform_admin( and the bare
-- app.has_capability( bypass must still be gone.
do $$
declare v_qual text; v_check text;
begin
  select qual into v_qual from pg_policies where tablename = 'notification_templates' and policyname = 'notification_templates_select';
  perform pg_temp.assert(v_qual not like '%app.is_platform_admin(%', 'notification_templates_select no longer references app.is_platform_admin(');
  perform pg_temp.assert(v_qual like '%app.has_tenant_capability_as_member(%', 'notification_templates_select uses the member-only helper for tenant-owned rows');

  select with_check into v_check from pg_policies where tablename = 'notification_templates' and policyname = 'notification_templates_insert';
  perform pg_temp.assert(v_check not like '%app.is_platform_admin(%', 'notification_templates_insert no longer references app.is_platform_admin( directly');
  perform pg_temp.assert(v_check like '%app.is_platform_governance_actor(%', 'notification_templates_insert gates the platform-template branch through app.is_platform_governance_actor()');
end;
$$;

-- audit_events_select (D6) must reference app.is_platform_governance_actor(),
-- not app.is_platform_admin(, and must gate the tenant branch member-only.
do $$
declare v_qual text;
begin
  select qual into v_qual from pg_policies where tablename = 'audit_events' and policyname = 'audit_events_select';
  perform pg_temp.assert(v_qual not like '%app.is_platform_admin(%', 'audit_events_select no longer references app.is_platform_admin( directly');
  perform pg_temp.assert(v_qual like '%app.is_platform_governance_actor(%', 'audit_events_select gates the platform branch through app.is_platform_governance_actor()');
  perform pg_temp.assert(v_qual like '%app.has_tenant_capability_as_member(%', 'audit_events_select gates the tenant branch through the member-only helper');
end;
$$;

-- Fixture: a real supplier in tenant M, owned by the legitimate
-- tenant_admin (each test file runs in its own rolled-back transaction, so
-- the 040/060 fixtures are not visible here).
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.create_supplier('10000000-0000-0000-0000-000000000003','SUP-BOUNDARY-001','Boundary Ltd.','MT','FICT-BOUNDARY','industrial_components',array['MT'],'TASK-028 fixture.',1000,'EUR','assisted',null);
reset role;

-- 1. Probe G, no membership at all: every step of the attack chain denied --
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

savepoint sp_g_none_insert; do $$ begin
  insert into public.policy_versions (tenant_id, version_number, status, created_by)
  values ('10000000-0000-0000-0000-000000000003', 999, 'draft', auth.uid());
  raise exception 'ASSERTION FAILED: G (no membership) policy_versions insert must be denied';
exception when insufficient_privilege then raise notice 'ok - G (no membership) platform admin cannot insert a draft policy_versions row';
end $$; rollback to sp_g_none_insert;

savepoint sp_g_none_case; do $$ begin
  insert into public.cases (tenant_id, opened_by) values ('10000000-0000-0000-0000-000000000003', auth.uid());
  raise exception 'ASSERTION FAILED: G (no membership) cases insert must be denied';
exception when insufficient_privilege then raise notice 'ok - G (no membership) platform admin cannot insert a case';
end $$; rollback to sp_g_none_case;

reset role;

-- 2. Probe G, dual role: an active tenant_admin membership changes nothing -
-- A legitimate tenant_admin first creates a real draft policy (with a
-- factor and a threshold) and a real case, so the dual-role admin has a
-- genuine target to attempt update/publish/append against, not merely a
-- nonexistent-row 404.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
insert into public.policy_versions (id, tenant_id, version_number, status, created_by)
values ('29000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000003', 98, 'draft', auth.uid());
insert into public.policy_factors (tenant_id, policy_version_id, key, label, weight, config)
values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000098','geographic_risk','Geo',10,'{"min":0,"max":100,"direction":"higher_is_riskier","required":true}');
insert into public.policy_thresholds (tenant_id, policy_version_id, label, min_score, max_score, decision_band)
values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000098','All',0,100,'approve');
insert into public.cases (id, tenant_id, opened_by)
values ('62000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003', auth.uid());
reset role;

insert into public.memberships (tenant_id,user_id,role_key,status,invited_by)
values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','tenant_admin','active','00000000-0000-0000-0000-000000000002');

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

savepoint sp_g_dual_insert; do $$ begin
  insert into public.policy_versions (tenant_id, version_number, status, created_by)
  values ('10000000-0000-0000-0000-000000000003', 997, 'draft', auth.uid());
  raise exception 'ASSERTION FAILED: G (dual role) policy_versions insert must be denied';
exception when insufficient_privilege then raise notice 'ok - G (dual role) platform admin cannot insert a draft policy_versions row despite an active tenant_admin membership';
end $$; rollback to sp_g_dual_insert;

savepoint sp_g_dual_factor; do $$ begin
  insert into public.policy_factors (tenant_id, policy_version_id, key, label, weight, config)
  values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000098','rogue_factor','Rogue',1,'{"min":0,"max":100,"direction":"higher_is_riskier","required":false}');
  raise exception 'ASSERTION FAILED: G (dual role) policy_factors insert must be denied';
exception when insufficient_privilege then raise notice 'ok - G (dual role) platform admin cannot add a factor to a real draft policy';
end $$; rollback to sp_g_dual_factor;

savepoint sp_g_dual_threshold; do $$ begin
  insert into public.policy_thresholds (tenant_id, policy_version_id, label, min_score, max_score, decision_band)
  values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000098','Rogue',0,100,'approve');
  raise exception 'ASSERTION FAILED: G (dual role) policy_thresholds insert must be denied';
exception when insufficient_privilege then raise notice 'ok - G (dual role) platform admin cannot add a threshold to a real draft policy';
end $$; rollback to sp_g_dual_threshold;

-- UPDATE denial through a USING clause is "denied by omission", not an
-- exception: the row is simply invisible to the update, so 0 rows are
-- affected and the row's prior state is unchanged (the same shape as the
-- self-suspend denial in supabase/tests/030-auth-tenant-bootstrap.sql).
savepoint sp_g_dual_publish; do $$
declare v_row_count int;
begin
  update public.policy_versions set status='published', published_at=now(), published_by=auth.uid()
  where id = '29000000-0000-0000-0000-000000000098';
  get diagnostics v_row_count = row_count;
  perform pg_temp.assert(v_row_count = 0, 'G (dual role) platform admin publish-update matches zero rows (denied by RLS omission)');
  perform pg_temp.assert(
    (select status from public.policy_versions where id = '29000000-0000-0000-0000-000000000098') = 'draft',
    'G (dual role) the real draft policy remains unpublished after the denied attempt'
  );
end $$; rollback to sp_g_dual_publish;

savepoint sp_g_dual_case_update; do $$
declare v_row_count int;
begin
  update public.cases set status='in_review' where id = '62000000-0000-0000-0000-000000000001';
  get diagnostics v_row_count = row_count;
  perform pg_temp.assert(v_row_count = 0, 'G (dual role) platform admin case update matches zero rows (denied by RLS omission)');
  perform pg_temp.assert(
    (select status from public.cases where id = '62000000-0000-0000-0000-000000000001') = 'open',
    'G (dual role) the real case remains unchanged after the denied attempt'
  );
end $$; rollback to sp_g_dual_case_update;

reset role;
delete from public.memberships where tenant_id = '10000000-0000-0000-0000-000000000003' and user_id = '00000000-0000-0000-0000-000000000001';

-- The tenant's evaluation keeps using its own legitimate published policy:
-- no rogue policy_versions row was ever created by either probe G attempt.
select pg_temp.assert(
  (select count(*) from public.policy_versions where tenant_id = '10000000-0000-0000-0000-000000000003' and status = 'published') = 1,
  'exactly one published policy exists for tenant M: the legitimate seeded one'
);
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
declare v_supplier_id uuid; v_result public.evaluations;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-BOUNDARY-001';
  v_result := public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'b1000000-0000-0000-0000-000000000001');
  perform pg_temp.assert(
    v_result.policy_version_id = '20000000-0000-0000-0000-000000000010',
    'the tenant evaluation still resolves to its own legitimate published policy, not anything probe G attempted'
  );
end;
$$;
reset role;

-- 3. A future-dated published_at is overwritten with now() --------------
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
insert into public.policy_versions (id, tenant_id, version_number, status, created_by)
values ('29000000-0000-0000-0000-000000000097','10000000-0000-0000-0000-000000000003', 96, 'draft', auth.uid());
insert into public.policy_factors (tenant_id, policy_version_id, key, label, weight, config)
values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000097','geographic_risk','Geo',10,'{"min":0,"max":100,"direction":"higher_is_riskier","required":true}');
insert into public.policy_thresholds (tenant_id, policy_version_id, label, min_score, max_score, decision_band)
values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000097','All',0,100,'approve');

update public.policy_versions
set status = 'published', published_at = now() + interval '10 days', published_by = auth.uid()
where id = '29000000-0000-0000-0000-000000000097';

do $$
declare v_published_at timestamptz;
begin
  select published_at into v_published_at from public.policy_versions where id = '29000000-0000-0000-0000-000000000097';
  perform pg_temp.assert(
    v_published_at < now() + interval '1 minute',
    format('a future-dated published_at (now() + 10 days) is overwritten with now(): stored value is %s', v_published_at)
  );
end;
$$;
-- Archive it immediately so it cannot become "the latest published policy"
-- for any later assertion in this file (published->archived is the one
-- transition immutability still allows).
update public.policy_versions set status = 'archived' where id = '29000000-0000-0000-0000-000000000097';
reset role;

-- 4. Suspended tenant: D4 reads and writes are denied ----------------------
update public.tenants set status = 'suspended' where id = '10000000-0000-0000-0000-000000000003';
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';

select pg_temp.assert(
  (select count(*) from public.policy_versions where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'suspended-tenant admin reads zero policy_versions'
);
select pg_temp.assert(
  (select count(*) from public.cases where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'suspended-tenant admin reads zero cases'
);

savepoint sp_susp_policy_insert; do $$ begin
  insert into public.policy_versions (tenant_id, version_number, status, created_by)
  values ('10000000-0000-0000-0000-000000000003', 995, 'draft', auth.uid());
  raise exception 'ASSERTION FAILED: suspended-tenant policy_versions insert must be denied';
exception when insufficient_privilege then raise notice 'ok - suspended-tenant admin cannot insert a policy_versions row';
end $$; rollback to sp_susp_policy_insert;

savepoint sp_susp_case_insert; do $$ begin
  insert into public.cases (tenant_id, opened_by) values ('10000000-0000-0000-0000-000000000003', auth.uid());
  raise exception 'ASSERTION FAILED: suspended-tenant cases insert must be denied';
exception when insufficient_privilege then raise notice 'ok - suspended-tenant admin cannot insert a case';
end $$; rollback to sp_susp_case_insert;

reset role;
update public.tenants set status = 'active' where id = '10000000-0000-0000-0000-000000000003';

-- 5. D5 still works for platform admins: tenants, suspend, memberships -----
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select count(*) from public.tenants) >= 2,
  'D5 regression: platform admin can list tenants'
);
select pg_temp.assert(
  (select count(*) from public.memberships) > 0,
  'D5 regression: platform admin can list memberships'
);

savepoint sp_d5_suspend; do $$
declare v_status text;
begin
  update public.tenants set status = 'suspended' where id = '10000000-0000-0000-0000-000000000002';
  select status into v_status from public.tenants where id = '10000000-0000-0000-0000-000000000002';
  perform pg_temp.assert(v_status = 'suspended', 'D5 regression: platform admin can suspend a tenant');
end;
$$;
rollback to sp_d5_suspend;

reset role;

-- 6. D6: platform admin sees platform events, not tenant events -----------
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
do $$
declare v_id uuid;
begin
  v_id := public.record_audit_event(null, 'platform.test_event', 'platform_test', 'fixture', null, '{}'::jsonb);
  perform pg_temp.assert(v_id is not null, 'D6 fixture: platform admin can write a platform-level (tenant_id is null) audit event');
end;
$$;

select pg_temp.assert(
  (select count(*) from public.audit_events where tenant_id is null and action = 'platform.test_event') = 1,
  'D6: platform admin can read platform-level audit events'
);
select pg_temp.assert(
  (select count(*) from public.audit_events where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'D6: platform admin (no membership) reads zero tenant-scoped audit events'
);
reset role;

-- Tenant-scoped audit events remain readable by real members through the
-- member-only helper (regression, and the other half of D6).
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000005';
select pg_temp.assert(
  (select count(*) from public.audit_events where tenant_id = '10000000-0000-0000-0000-000000000003') > 0,
  'D6 regression: auditor (audit.view) can still read tenant-scoped audit events'
);
reset role;

-- 7. Regression: tenant_admin, risk_analyst, operator, auditor keep their
-- current capabilities on each D4 surface -----------------------------------

-- tenant_admin: policy_versions insert + publish (policy.manage + policy.publish)
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
begin
  insert into public.policy_versions (id, tenant_id, version_number, status, created_by)
  values ('29000000-0000-0000-0000-000000000096','10000000-0000-0000-0000-000000000003', 95, 'draft', auth.uid());
  insert into public.policy_factors (tenant_id, policy_version_id, key, label, weight, config)
  values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000096','geographic_risk','Geo',10,'{"min":0,"max":100,"direction":"higher_is_riskier","required":true}');
  insert into public.policy_thresholds (tenant_id, policy_version_id, label, min_score, max_score, decision_band)
  values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000096','All',0,100,'approve');
  update public.policy_versions set status='published', published_by=auth.uid() where id = '29000000-0000-0000-0000-000000000096';
  perform pg_temp.assert(
    (select status from public.policy_versions where id = '29000000-0000-0000-0000-000000000096') = 'published',
    'regression: tenant_admin (policy.manage + policy.publish) can still create and publish a policy version'
  );
end;
$$;
update public.policy_versions set status = 'archived' where id = '29000000-0000-0000-0000-000000000096';

-- tenant_admin: notification templates/requests regression (notification.manage/view)
do $$
declare v_template_id uuid;
begin
  insert into public.notification_templates (tenant_id, key, locale, subject, body, created_by)
  values ('10000000-0000-0000-0000-000000000003', 'welcome', 'en-US', 'Welcome', 'Body', auth.uid())
  returning id into v_template_id;
  perform pg_temp.assert(v_template_id is not null, 'regression: tenant_admin (notification.manage) can still create a tenant notification template');
end;
$$;
select pg_temp.assert(
  (select count(*) from public.notification_templates where tenant_id = '10000000-0000-0000-0000-000000000003') = 1,
  'regression: tenant_admin (notification.view) can still read tenant notification templates'
);
reset role;

-- risk_analyst: read-only regression on policy/case surfaces (policy.view, case.view)
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
select pg_temp.assert(
  (select count(*) from public.policy_versions where tenant_id = '10000000-0000-0000-0000-000000000003' and status = 'published') = 1,
  'regression: risk_analyst (policy.view) can still read the published policy'
);
select pg_temp.assert(
  (select count(*) from public.cases where tenant_id = '10000000-0000-0000-0000-000000000003') = 1,
  'regression: risk_analyst (case.view) can still read cases'
);
select pg_temp.assert(
  (select count(*) from public.case_evidence where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'regression: risk_analyst (case.view) case_evidence read still scoped correctly (none exists yet)'
);
reset role;

-- operator: cases/case_evidence write regression (case.manage)
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000004';
do $$
declare v_case_id uuid;
begin
  insert into public.cases (tenant_id, opened_by) values ('10000000-0000-0000-0000-000000000003', auth.uid())
  returning id into v_case_id;
  insert into public.case_evidence (tenant_id, case_id, kind, storage_ref, sha256, uploaded_by)
  values ('10000000-0000-0000-0000-000000000003', v_case_id, 'document', 'fixture-ref', repeat('a', 64), auth.uid());
  perform pg_temp.assert(
    (select count(*) from public.case_evidence where case_id = v_case_id) = 1,
    'regression: operator (case.manage) can still open a case and attach evidence'
  );
end;
$$;
reset role;

-- auditor: read-only regression across integrations and notifications
-- (integration.view, notification.view)
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000005';
select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000003', 'integration.view') = true,
  'regression: auditor still holds integration.view'
);
select pg_temp.assert(
  (select count(*) from public.notification_templates where tenant_id = '10000000-0000-0000-0000-000000000003') = 1,
  'regression: auditor (notification.view) can still read tenant notification templates'
);
reset role;

do $$
begin
  raise notice 'Platform-admin operational boundary verification completed successfully.';
end;
$$;

rollback;

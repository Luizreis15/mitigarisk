-- TASK-023 verification: supplier + fictional evidence RLS, actor
-- provenance, cross-tenant denial, and the non-forgeable
-- public.create_supplier() / public.create_supplier_evidence() /
-- public.run_supplier_evaluation() RPCs.
--
-- Security correction (post-review, 2026-09-15): rewritten to exercise the
-- RPC-only write boundary (no more direct authenticated table inserts),
-- the removal of every platform-admin bypass from suppliers/supplier_evidence/
-- supplier-evaluation select and write paths, the database-computed (not
-- caller-supplied) evaluation result, and the tenant_admin-only case
-- decision policy.
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
--   tenant M = 10000000-0000-0000-0000-000000000003 (Meridian Industrial Holdings;
--              dedicated TASK-023 tenant, kept separate from Helix Commerce Ltd.
--              so this suite's second policy version never breaks the
--              pre-existing "exactly one policy_versions row" assertion in
--              010-rls-tenant-isolation.sql)
--   tenant B = 10000000-0000-0000-0000-000000000002 (Nimbus Payments Inc.; outsider)
--   tenant_admin (M)  = 00000000-0000-0000-0000-000000000002
--   risk_analyst (M)  = 00000000-0000-0000-0000-000000000003
--   operator (M)      = 00000000-0000-0000-0000-000000000004
--   auditor (M)       = 00000000-0000-0000-0000-000000000005
--   tenant_admin (B, outsider to M) = 00000000-0000-0000-0000-000000000006
--   "Supplier onboarding policy" v1 (published) = 20000000-0000-0000-0000-000000000010 (tenant M)

-- 0. TASK-023 approved decision rule: risk_analyst no longer decides cases --

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';

select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000003', 'case.decide') = false,
  'risk_analyst no longer holds case.decide (TASK-023 human-approved decision rule)'
);
select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000003', 'supplier.manage') = true,
  'risk_analyst holds the new supplier.manage capability'
);

reset role;

-- 1. Supplier creation is RPC-only: no direct table insert exists at all --

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
declare
  v_supplier public.suppliers;
begin
  v_supplier := public.create_supplier(
    '10000000-0000-0000-0000-000000000003', 'SUP-ATLAS-001', 'Atlas Components Ltd.', 'MT',
    'C-FICTIONAL-1042', 'industrial_components', array['MT', 'IT'],
    'Supply of replacement components for operational equipment.', 24000000, 'EUR', 'assisted',
    'atlas-components.example'
  );
  perform pg_temp.assert(v_supplier.status = 'draft', 'newly created supplier defaults to draft status');
  perform pg_temp.assert(v_supplier.created_by = auth.uid(), 'supplier created_by is pinned to the acting tenant_admin');
  perform pg_temp.assert(
    (select count(*) from public.audit_events
       where target_type = 'supplier' and target_id = v_supplier.id::text and action = 'supplier.created') = 1,
    'create_supplier records a mandatory audit event atomically'
  );
end;
$$;

-- Direct table insert is not merely denied by RLS, it has no grant at all —
-- proven here by a caller (tenant_admin) who *does* hold supplier.manage.
savepoint sp_direct_insert_forbidden;
do $$
begin
  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', 'SUP-DIRECT-001', 'Direct Insert Ltd.', 'MT', 'C-0001',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', auth.uid(), auth.uid()
  );
  raise exception 'ASSERTION FAILED: a direct table insert must be impossible regardless of capability';
exception
  when insufficient_privilege then
    raise notice 'ok - direct supplier insert has no grant at all, even for a caller with supplier.manage';
end;
$$;
rollback to savepoint sp_direct_insert_forbidden;

savepoint sp_duplicate_reference;
do $$
begin
  perform public.create_supplier(
    '10000000-0000-0000-0000-000000000003', 'SUP-ATLAS-001', 'Duplicate reference', 'MT', 'C-0002',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', null
  );
  raise exception 'ASSERTION FAILED: duplicate tenant-scoped reference must be rejected';
exception
  when unique_violation then
    raise notice 'ok - supplier reference is unique per tenant, even created via the RPC';
end;
$$;
rollback to savepoint sp_duplicate_reference;

savepoint sp_bad_country;
do $$
begin
  perform public.create_supplier(
    '10000000-0000-0000-0000-000000000003', 'SUP-BAD-COUNTRY', 'Bad Country Ltd.', 'MLT', 'C-0003',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', null
  );
  raise exception 'ASSERTION FAILED: a non-ISO-shaped country code must be rejected';
exception
  when check_violation then
    raise notice 'ok - registration_country_code shape is enforced by a database constraint even through the RPC';
end;
$$;
rollback to savepoint sp_bad_country;

reset role;

-- 2. Cross-tenant denial: tenant B cannot see, create, or evaluate in M ----

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

select pg_temp.assert(
  (select count(*) from public.suppliers where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'tenant B cannot see the Meridian tenant''s suppliers'
);

savepoint sp_cross_tenant_manage;
do $$
begin
  perform public.create_supplier(
    '10000000-0000-0000-0000-000000000003', 'SUP-CROSS-001', 'Cross Tenant Ltd.', 'MT', 'C-0004',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', null
  );
  raise exception 'ASSERTION FAILED: tenant B admin must not create a supplier in the Meridian tenant';
exception
  when sqlstate '42501' then
    raise notice 'ok - cross-tenant supplier creation is rejected (no membership in the target tenant)';
end;
$$;
rollback to savepoint sp_cross_tenant_manage;

reset role;

-- 3. Platform administrator: no bypass at all, for select or write --------

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select count(*) from public.suppliers where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'platform administrator cannot select suppliers in a tenant they are not a member of'
);

savepoint sp_platform_admin_create_supplier;
do $$
begin
  perform public.create_supplier(
    '10000000-0000-0000-0000-000000000003', 'SUP-PLATFORM-001', 'Platform Admin Ltd.', 'MT', 'C-0005',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', null
  );
  raise exception 'ASSERTION FAILED: a platform administrator must not create a supplier through the real workspace';
exception
  when sqlstate '42501' then
    raise notice 'ok - platform administrator cannot create a supplier (no bypass in create_supplier)';
end;
$$;
rollback to savepoint sp_platform_admin_create_supplier;

savepoint sp_platform_admin_direct_insert;
do $$
begin
  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', 'SUP-PLATFORM-DIRECT', 'Platform Direct Ltd.', 'MT', 'C-0006',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', auth.uid(), auth.uid()
  );
  raise exception 'ASSERTION FAILED: a platform administrator must not be able to insert a supplier directly either';
exception
  when insufficient_privilege then
    raise notice 'ok - platform administrator has no direct insert grant on suppliers either';
end;
$$;
rollback to savepoint sp_platform_admin_direct_insert;

reset role;

-- 4. Least privilege: operator (evaluation.run + supplier.view, no supplier.manage) --

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000003', 'supplier.manage') = false,
  'operator does not hold supplier.manage'
);
select pg_temp.assert(
  (select count(*) from public.suppliers where reference = 'SUP-ATLAS-001') = 1,
  'operator can still read the supplier via supplier.view'
);

savepoint sp_operator_manage;
do $$
begin
  perform public.create_supplier(
    '10000000-0000-0000-0000-000000000003', 'SUP-OPERATOR-001', 'Operator Attempt Ltd.', 'MT', 'C-0007',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', null
  );
  raise exception 'ASSERTION FAILED: operator must not create a supplier';
exception
  when sqlstate '42501' then
    raise notice 'ok - operator (no supplier.manage) cannot create a supplier';
end;
$$;
rollback to savepoint sp_operator_manage;

reset role;

-- 5. Fictional evidence metadata: RPC-only, capability + actor provenance --

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';

do $$
declare
  v_supplier_id uuid;
  v_evidence public.supplier_evidence;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';

  v_evidence := public.create_supplier_evidence(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, 'compliance_questionnaire',
    'Atlas fictional compliance questionnaire', 'MT', '2026-01-15', 'reviewed', repeat('a', 64)
  );
  perform pg_temp.assert(v_evidence.created_by = auth.uid(), 'supplier evidence created_by is pinned to the acting risk_analyst');
  perform pg_temp.assert(
    (select count(*) from public.audit_events
       where target_type = 'supplier_evidence' and target_id = v_evidence.id::text and action = 'supplier_evidence.created') = 1,
    'create_supplier_evidence records a mandatory audit event atomically'
  );
end;
$$;

savepoint sp_evidence_direct_insert;
do $$
declare
  v_supplier_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  insert into public.supplier_evidence (
    tenant_id, supplier_id, evidence_type, display_name, verification_state, digest_sha256, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', v_supplier_id, 'incorporation_record', 'Direct insert attempt',
    'provided', repeat('b', 64), auth.uid(), auth.uid()
  );
  raise exception 'ASSERTION FAILED: a direct evidence table insert must be impossible';
exception
  when insufficient_privilege then
    raise notice 'ok - direct supplier evidence insert has no grant at all';
end;
$$;
rollback to savepoint sp_evidence_direct_insert;

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

select pg_temp.assert(
  (select count(*) from public.supplier_evidence where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'tenant B cannot see the Meridian tenant''s supplier evidence'
);

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select count(*) from public.supplier_evidence where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'platform administrator cannot select supplier evidence in a tenant they are not a member of'
);

reset role;

-- 6. public.run_supplier_evaluation(): database-computed, non-forgeable ----
-- Facts at this point: registration_country_code MT is in operating
-- countries [MT, IT] (2 distinct) and the identifier is plausible ->
-- identity_integrity_risk 0, geographic_risk 50. compliance_questionnaire
-- is reviewed -> integrity_screening_risk 0. ownership_declaration has no
-- evidence at all -> ownership_transparency_risk 100. annual_exposure_minor
-- 24,000,000 / 100,000,000 ceiling * 100 -> financial_exposure_risk 24.
-- 1 of 5 required evidence types reviewed -> evidence_quality_risk
-- round(100 - (1/5)*100) = 80. Weighted score = (0*20 + 50*15 + 100*15 +
-- 0*25 + 24*10 + 80*15) / 100 = 3690 / 100 = 36.90, which falls in the
-- published policy's [35, 70) "review" band. These exact numbers are
-- asserted below specifically so this test fails if the SQL scoring
-- diverges from apps/web/lib/domain/supplier-evaluation-adapter.ts's
-- reference algorithm (now unused for this write path, but still the
-- documented specification these SQL functions mirror).

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
declare
  v_supplier_id uuid;
  v_result public.evaluations;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';

  v_result := public.run_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, '90000000-0000-0000-0000-000000000001'
  );
  perform pg_temp.assert(v_result.status = 'completed', 'evaluation completes atomically with score/band set');
  perform pg_temp.assert(v_result.actor_id = auth.uid(), 'evaluation actor_id is pinned to the acting user');
  perform pg_temp.assert(v_result.score = 36.90, format('database-computed score is 36.90, got %s', v_result.score));
  perform pg_temp.assert(v_result.decision_band = 'review', format('database-computed band is review, got %s', v_result.decision_band));
  perform pg_temp.assert(v_result.data_quality = 'complete', 'all six factors were present, so data quality is complete');
  perform pg_temp.assert(
    (v_result.normalized_input ->> 'evidence_quality_risk')::numeric = 80,
    'normalized_input reflects the database''s own derived facts, not anything the caller could have supplied'
  );
  perform pg_temp.assert(
    (select count(*) from public.evaluation_reason_codes where evaluation_id = v_result.id) = 7,
    'six factor reasons plus one recommendation reason were persisted'
  );
  perform pg_temp.assert(
    (select count(*) from public.audit_events
       where target_type = 'evaluation' and target_id = v_result.id::text and action = 'evaluation.completed') = 1,
    'run_supplier_evaluation records a mandatory audit event atomically'
  );
end;
$$;

-- Forged evaluation output is impossible: the old, forgeable RPC contract
-- no longer exists, and a direct authenticated insert of a supplier
-- evaluation (with an attacker-chosen score) has no path at all — the
-- narrowed evaluations_insert with-check requires supplier_id is null.
savepoint sp_old_rpc_gone;
do $$
begin
  perform pg_temp.assert(
    not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'complete_supplier_evaluation'
    ),
    'the old, caller-supplied-score RPC (complete_supplier_evaluation) no longer exists'
  );
end;
$$;
rollback to savepoint sp_old_rpc_gone;

savepoint sp_forged_score_direct_insert;
do $$
declare
  v_supplier_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  insert into public.evaluations (
    tenant_id, supplier_id, policy_version_id, subject_reference, input_hash,
    normalized_input, score, decision_band, status, correlation_id, actor_id, actor_type
  ) values (
    '10000000-0000-0000-0000-000000000003', v_supplier_id, '20000000-0000-0000-0000-000000000010',
    'SUP-ATLAS-001', 'forged-hash', '{}'::jsonb, 0, 'approve', 'completed',
    '90000000-0000-0000-0000-000000000099', auth.uid(), 'user'
  );
  raise exception 'ASSERTION FAILED: a direct insert forging a supplier evaluation score must be impossible';
exception
  when insufficient_privilege then
    raise notice 'ok - a direct authenticated insert cannot forge a supplier evaluation score (evaluations_insert requires supplier_id is null)';
end;
$$;
rollback to savepoint sp_forged_score_direct_insert;

-- Idempotent replay: same correlation id, same underlying data -> same row.
do $$
declare
  v_supplier_id uuid;
  v_result public.evaluations;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  v_result := public.run_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, '90000000-0000-0000-0000-000000000001'
  );
  perform pg_temp.assert(v_result.score = 36.90, 'replay returns the original persisted, database-computed outcome');
end;
$$;

select pg_temp.assert(
  (select count(*) from public.evaluations where correlation_id = '90000000-0000-0000-0000-000000000001') = 1,
  'replaying the same correlation id never creates a second evaluation'
);

-- Conflict: same correlation id, but the underlying facts have since
-- changed (a new reviewed ownership_declaration lowers ownership_transparency_risk
-- from 100 to 0) -> the recomputed hash differs -> stable typed conflict.
reset role;
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';

do $$
declare
  v_supplier_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  perform public.create_supplier_evidence(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, 'ownership_declaration',
    'Atlas fictional ownership declaration', 'MT', '2026-01-20', 'reviewed', repeat('c', 64)
  );
end;
$$;

reset role;
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

savepoint sp_correlation_conflict;
do $$
declare
  v_supplier_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  perform public.run_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, '90000000-0000-0000-0000-000000000001'
  );
  raise exception 'ASSERTION FAILED: a reused correlation id whose underlying data changed must be rejected';
exception
  when unique_violation then
    raise notice 'ok - a reused correlation id whose recomputed facts differ fails as a stable typed conflict (23505)';
end;
$$;
rollback to savepoint sp_correlation_conflict;

-- The completed evaluation and its reason codes remain immutable evidence.
savepoint sp_evaluation_immutable;
do $$
begin
  update public.evaluations set score = 0
  where correlation_id = '90000000-0000-0000-0000-000000000001';
  raise exception 'ASSERTION FAILED: a completed evaluation must be immutable';
exception
  when sqlstate '23001' then
    raise notice 'ok - a completed supplier evaluation is immutable';
end;
$$;
rollback to savepoint sp_evaluation_immutable;

reset role;

-- 7. Cross-tenant, missing-capability, and platform-admin fail-closed on the RPC --

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

savepoint sp_rpc_cross_tenant_supplier;
do $$
declare
  v_supplier_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  perform public.run_supplier_evaluation(
    '10000000-0000-0000-0000-000000000002', v_supplier_id, '90000000-0000-0000-0000-000000000002'
  );
  raise exception 'ASSERTION FAILED: evaluating another tenant''s supplier id must fail';
exception
  when sqlstate 'P0002' then
    raise notice 'ok - evaluating a supplier id from another tenant fails closed (not found), leaking nothing';
end;
$$;
rollback to savepoint sp_rpc_cross_tenant_supplier;

savepoint sp_rpc_wrong_tenant_capability;
do $$
declare
  v_supplier_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  perform public.run_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, '90000000-0000-0000-0000-000000000003'
  );
  raise exception 'ASSERTION FAILED: a non-member of the Meridian tenant must not run an evaluation for it';
exception
  when sqlstate '42501' then
    raise notice 'ok - a caller with no membership/capability in the target tenant is rejected';
end;
$$;
rollback to savepoint sp_rpc_wrong_tenant_capability;

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select count(*) from public.evaluations where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'platform administrator cannot select the Meridian tenant''s evaluations either'
);

savepoint sp_platform_admin_evaluate;
do $$
declare
  v_supplier_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  perform public.run_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, '90000000-0000-0000-0000-000000000004'
  );
  raise exception 'ASSERTION FAILED: a platform administrator must not be able to run a supplier evaluation';
exception
  when sqlstate '42501' then
    raise notice 'ok - platform administrator cannot run a supplier evaluation (no bypass in run_supplier_evaluation)';
end;
$$;
rollback to savepoint sp_platform_admin_evaluate;

reset role;

-- 8. Case decisions: active tenant_admin only, no capability route, no bypass --

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
declare
  v_supplier_id uuid;
  v_evaluation_id uuid;
  v_case_id uuid;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-ATLAS-001';
  select id into v_evaluation_id from public.evaluations where correlation_id = '90000000-0000-0000-0000-000000000001';

  insert into public.cases (id, tenant_id, evaluation_id, opened_by)
  values ('61000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', v_evaluation_id, auth.uid());
end;
$$;

reset role;

-- risk_analyst: no longer holds case.decide, and the new policy would
-- reject even if it did (role, not capability, is now the gate).
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';

savepoint sp_risk_analyst_decide;
do $$
begin
  insert into public.case_decisions (tenant_id, case_id, decision, rationale, decided_by)
  values (
    '10000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001',
    'approve', 'Fictional rationale.', auth.uid()
  );
  raise exception 'ASSERTION FAILED: risk_analyst must not record a case decision';
exception
  when insufficient_privilege then
    raise notice 'ok - risk_analyst (not tenant_admin) cannot record a case decision';
end;
$$;
rollback to savepoint sp_risk_analyst_decide;

reset role;

-- platform admin: no bypass either.
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

savepoint sp_platform_admin_decide;
do $$
begin
  insert into public.case_decisions (tenant_id, case_id, decision, rationale, decided_by)
  values (
    '10000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001',
    'approve', 'Fictional rationale.', auth.uid()
  );
  raise exception 'ASSERTION FAILED: a platform administrator must not record a case decision';
exception
  when insufficient_privilege then
    raise notice 'ok - platform administrator cannot record a case decision (no bypass)';
end;
$$;
rollback to savepoint sp_platform_admin_decide;

reset role;

-- tenant_admin: forging decided_by to another user must still fail.
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

savepoint sp_forged_decided_by;
do $$
begin
  insert into public.case_decisions (tenant_id, case_id, decision, rationale, decided_by)
  values (
    '10000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001',
    'approve', 'Fictional rationale.', '00000000-0000-0000-0000-000000000003'
  );
  raise exception 'ASSERTION FAILED: decided_by must not be forgeable to another user';
exception
  when insufficient_privilege then
    raise notice 'ok - decided_by cannot be forged to another user';
end;
$$;
rollback to savepoint sp_forged_decided_by;

-- tenant_admin: the one role this policy allows, records the decision.
do $$
declare
  v_decision public.case_decisions;
begin
  insert into public.case_decisions (tenant_id, case_id, decision, rationale, decided_by)
  values (
    '10000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001',
    'approve', 'Fictional rationale for the local test fixture.', auth.uid()
  )
  returning * into v_decision;
  perform pg_temp.assert(v_decision.decided_by = auth.uid(), 'active tenant_admin can record a case decision, attributed to themselves');
end;
$$;

reset role;

do $$
begin
  raise notice 'Supplier evaluation slice verification completed successfully.';
end;
$$;

rollback;

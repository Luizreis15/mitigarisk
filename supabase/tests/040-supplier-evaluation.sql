-- TASK-023 verification: supplier + fictional evidence RLS, actor
-- provenance, cross-tenant denial, and the atomic
-- public.complete_supplier_evaluation() RPC (happy path, idempotent
-- replay, conflict-on-reuse, cross-tenant/missing-capability fail-closed).
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

-- 1. Supplier creation: capability, actor provenance, forced draft status --

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

insert into public.suppliers (
  id, tenant_id, reference, display_name, registration_country_code, registration_identifier,
  industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
  annual_exposure_currency, onboarding_channel, website_domain, created_by, updated_by
) values (
  '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'SUP-ATLAS-001',
  'Atlas Components Ltd.', 'MT', 'C-FICTIONAL-1042', 'industrial_components', array['MT', 'IT'],
  'Supply of replacement components for operational equipment.', 24000000, 'EUR', 'assisted',
  'atlas-components.example', auth.uid(), auth.uid()
);

select pg_temp.assert(
  (select status from public.suppliers where id = '40000000-0000-0000-0000-000000000001') = 'draft',
  'newly created supplier defaults to draft status'
);
select pg_temp.assert(
  (select created_by from public.suppliers where id = '40000000-0000-0000-0000-000000000001') = auth.uid(),
  'supplier created_by is pinned to the acting tenant_admin'
);

savepoint sp_forged_actor;
do $$
begin
  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', 'SUP-FORGED-001', 'Forged Actor Ltd.', 'MT', 'C-0001',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted',
    '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006'
  );
  raise exception 'ASSERTION FAILED: supplier created_by must not be forgeable';
exception
  when insufficient_privilege then
    raise notice 'ok - supplier created_by cannot be forged to another user';
end;
$$;
rollback to savepoint sp_forged_actor;

savepoint sp_duplicate_reference;
do $$
begin
  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', 'SUP-ATLAS-001', 'Duplicate reference', 'MT', 'C-0002',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', auth.uid(), auth.uid()
  );
  raise exception 'ASSERTION FAILED: duplicate tenant-scoped reference must be rejected';
exception
  when unique_violation then
    raise notice 'ok - supplier reference is unique per tenant';
end;
$$;
rollback to savepoint sp_duplicate_reference;

savepoint sp_bad_country;
do $$
begin
  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', 'SUP-BAD-COUNTRY', 'Bad Country Ltd.', 'MLT', 'C-0003',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', auth.uid(), auth.uid()
  );
  raise exception 'ASSERTION FAILED: a non-ISO-shaped country code must be rejected';
exception
  when check_violation then
    raise notice 'ok - registration_country_code shape is enforced by a database constraint';
end;
$$;
rollback to savepoint sp_bad_country;

reset role;

-- 2. Cross-tenant denial: tenant B cannot see or manage the Meridian tenant's supplier -

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

select pg_temp.assert(
  (select count(*) from public.suppliers where id = '40000000-0000-0000-0000-000000000001') = 0,
  'tenant B cannot see the Meridian tenant''s supplier'
);

savepoint sp_cross_tenant_manage;
do $$
begin
  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', 'SUP-CROSS-001', 'Cross Tenant Ltd.', 'MT', 'C-0004',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', auth.uid(), auth.uid()
  );
  raise exception 'ASSERTION FAILED: tenant B admin must not create a supplier in the Meridian tenant';
exception
  when insufficient_privilege then
    raise notice 'ok - cross-tenant supplier creation is rejected by RLS';
end;
$$;
rollback to savepoint sp_cross_tenant_manage;

reset role;

-- 3. Least privilege: operator (evaluation.run, no supplier.manage) --------

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000003', 'supplier.manage') = false,
  'operator does not hold supplier.manage'
);
select pg_temp.assert(
  (select count(*) from public.suppliers where id = '40000000-0000-0000-0000-000000000001') = 1,
  'operator can still read the supplier via supplier.view'
);

savepoint sp_operator_manage;
do $$
begin
  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, created_by, updated_by
  ) values (
    '10000000-0000-0000-0000-000000000003', 'SUP-OPERATOR-001', 'Operator Attempt Ltd.', 'MT', 'C-0005',
    'industrial_components', array['MT'], 'Test.', 0, 'EUR', 'assisted', auth.uid(), auth.uid()
  );
  raise exception 'ASSERTION FAILED: operator must not create a supplier';
exception
  when insufficient_privilege then
    raise notice 'ok - operator (no supplier.manage) cannot create a supplier';
end;
$$;
rollback to savepoint sp_operator_manage;

reset role;

-- 4. Fictional evidence metadata: capability + actor provenance ------------

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';

insert into public.supplier_evidence (
  id, tenant_id, supplier_id, evidence_type, display_name, issuer_country_code, issue_date,
  verification_state, digest_sha256, created_by, updated_by
) values (
  '41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000001', 'compliance_questionnaire',
  'Atlas fictional compliance questionnaire', 'MT', '2026-01-15', 'reviewed',
  repeat('a', 64), auth.uid(), auth.uid()
);

select pg_temp.assert(
  (select created_by from public.supplier_evidence where id = '41000000-0000-0000-0000-000000000001') = auth.uid(),
  'supplier evidence created_by is pinned to the acting risk_analyst'
);

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

select pg_temp.assert(
  (select count(*) from public.supplier_evidence where id = '41000000-0000-0000-0000-000000000001') = 0,
  'tenant B cannot see the Meridian tenant''s supplier evidence'
);

reset role;

-- 5. public.complete_supplier_evaluation(): happy path, replay, conflict ---

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
declare
  v_result public.evaluations;
begin
  v_result := public.complete_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000010',
    '90000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    '{"identity_integrity_risk": 0, "geographic_risk": 50}'::jsonb,
    18.5, 'approve', 'complete', '[]'::jsonb,
    '[{"code": "RECOMMENDATION_APPROVE", "description": "test", "metadata": {"score": 18.5}}]'::jsonb
  );
  perform pg_temp.assert(v_result.status = 'completed', 'evaluation completes atomically with score/band set');
  perform pg_temp.assert(v_result.actor_id = auth.uid(), 'evaluation actor_id is pinned to the acting user');
  perform pg_temp.assert(
    (select count(*) from public.evaluation_reason_codes where evaluation_id = v_result.id) = 1,
    'exactly one reason code was persisted alongside the completed evaluation'
  );
end;
$$;

select pg_temp.assert(
  (select count(*) from public.evaluations where correlation_id = '90000000-0000-0000-0000-000000000001') = 1,
  'exactly one evaluation row exists for this correlation id'
);

-- Idempotent replay: same correlation id, same input hash -> same row, no duplicate.
do $$
declare
  v_result public.evaluations;
begin
  v_result := public.complete_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000010',
    '90000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    '{"identity_integrity_risk": 0, "geographic_risk": 50}'::jsonb,
    18.5, 'approve', 'complete', '[]'::jsonb,
    '[{"code": "RECOMMENDATION_APPROVE", "description": "test", "metadata": {"score": 18.5}}]'::jsonb
  );
  perform pg_temp.assert(v_result.score = 18.5, 'replay returns the original persisted outcome');
end;
$$;

select pg_temp.assert(
  (select count(*) from public.evaluations where correlation_id = '90000000-0000-0000-0000-000000000001') = 1,
  'replaying the same correlation id never creates a second evaluation'
);
select pg_temp.assert(
  (select count(*) from public.evaluation_reason_codes
     where evaluation_id = (select id from public.evaluations where correlation_id = '90000000-0000-0000-0000-000000000001')) = 1,
  'replaying the same correlation id never duplicates reason codes'
);

-- Conflict: same correlation id, different input hash -> stable typed conflict.
savepoint sp_correlation_conflict;
do $$
begin
  perform public.complete_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000010',
    '90000000-0000-0000-0000-000000000001',
    repeat('c', 64),
    '{"identity_integrity_risk": 100}'::jsonb,
    99, 'reject', 'complete', '[]'::jsonb, '[]'::jsonb
  );
  raise exception 'ASSERTION FAILED: a reused correlation id with different input must be rejected';
exception
  when unique_violation then
    raise notice 'ok - a reused correlation id with different input fails as a stable typed conflict (23505)';
end;
$$;
rollback to savepoint sp_correlation_conflict;

-- The completed evaluation and its reason code remain immutable evidence.
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

-- 6. Cross-tenant and missing-capability fail-closed on the RPC itself -----

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

savepoint sp_rpc_cross_tenant_supplier;
do $$
begin
  perform public.complete_supplier_evaluation(
    '10000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000010',
    '90000000-0000-0000-0000-000000000002',
    repeat('d', 64), '{}'::jsonb, 10, 'approve', 'complete', '[]'::jsonb, '[]'::jsonb
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
begin
  perform public.complete_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000010',
    '90000000-0000-0000-0000-000000000003',
    repeat('e', 64), '{}'::jsonb, 10, 'approve', 'complete', '[]'::jsonb, '[]'::jsonb
  );
  raise exception 'ASSERTION FAILED: a non-member of the Meridian tenant must not run an evaluation for it';
exception
  when sqlstate '42501' then
    raise notice 'ok - a caller with no membership/capability in the target tenant is rejected';
end;
$$;
rollback to savepoint sp_rpc_wrong_tenant_capability;

reset role;

do $$
begin
  raise notice 'Supplier evaluation slice verification completed successfully.';
end;
$$;

rollback;

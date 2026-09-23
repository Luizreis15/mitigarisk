-- TASK-026 verification: the database is a uniform authorization boundary
-- for every real supplier-workflow surface, regardless of Server Action
-- involvement. Converts the TASK-025 independent review's direct-database
-- probes (scenarios A-F) into permanent, failing assertions, adds the
-- policy-validation guard and idempotency-lock checks, and proves every
-- legitimate role still works.
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
--   tenant_admin (B, outsider to M) = 00000000-0000-0000-0000-000000000006
--   "Supplier onboarding policy" v1 (published) = 20000000-0000-0000-0000-000000000010 (tenant M)

-- Fixture: one real supplier and one real, completed supplier evaluation in
-- tenant M, as the legitimate tenant_admin. Used below both as the "real
-- cross-tenant evaluation id" for the final-decision probe and as the
-- deterministic-order fixture for scenario E.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.create_supplier('10000000-0000-0000-0000-000000000003','SUP-UNIFORM-001','Uniform Ltd.','MT','FICT-UNIFORM','industrial_components',array['MT'],'Uniform authorization fixture.',1000,'EUR','assisted',null);

do $$
declare
  v_supplier_id uuid;
  v_result public.evaluations;
  v_ordered_keys text[];
  v_factor_count int;
  v_distinct_created_at int;
  v_actual_keys text[];
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  v_result := public.run_supplier_evaluation(
    '10000000-0000-0000-0000-000000000003', v_supplier_id, 'a1000000-0000-0000-0000-000000000001'
  );
  perform pg_temp.assert(v_result.status = 'completed', 'fixture: tenant_admin can still run a supplier evaluation');

  -- E. Factor iteration order is deterministic: order by created_at, key
  -- (TASK-026 item 4; TASK-025 review finding E). The seeded factors for
  -- this published policy share one created_at, so key is the only
  -- possible deterministic tiebreaker.
  select count(*), count(distinct created_at)
    into v_factor_count, v_distinct_created_at
    from public.policy_factors
    where policy_version_id = '20000000-0000-0000-0000-000000000010';
  perform pg_temp.assert(
    v_factor_count = 6 and v_distinct_created_at = 1,
    format('E: seeded factors share one created_at (%s rows, %s distinct created_at), so key is the required tiebreaker', v_factor_count, v_distinct_created_at)
  );

  select array_agg(key order by created_at, key)
    into v_ordered_keys
    from public.policy_factors
    where policy_version_id = '20000000-0000-0000-0000-000000000010';
  perform pg_temp.assert(
    v_ordered_keys = array[
      'evidence_quality_risk','financial_exposure_risk','geographic_risk',
      'identity_integrity_risk','integrity_screening_risk','ownership_transparency_risk'
    ],
    'E: order by created_at, key yields a fixed, deterministic factor order'
  );

  select array_agg(metadata ->> 'factorKey' order by ctid)
    into v_actual_keys
    from public.evaluation_reason_codes
    where evaluation_id = v_result.id and metadata ? 'factorKey';
  perform pg_temp.assert(
    v_actual_keys = v_ordered_keys,
    'E: run_supplier_evaluation persists reason codes in the same deterministic (created_at, key) factor order'
  );
end;
$$;
reset role;

-- A. Dual-role platform admin (001) with an active tenant_admin membership
-- in tenant M is denied on every operational surface (TASK-026 D1) --------
insert into public.memberships (tenant_id,user_id,role_key,status,invited_by)
values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','tenant_admin','active','00000000-0000-0000-0000-000000000002');

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

savepoint sp_a1; do $$ begin
  perform public.create_supplier('10000000-0000-0000-0000-000000000003','SUP-DUAL-001','Dual Ltd.','MT','FICT-DUAL','industrial_components',array['MT'],'Probe.',1000,'EUR','assisted',null);
  raise exception 'ASSERTION FAILED: A1 dual-role create_supplier must be denied';
exception when sqlstate '42501' then raise notice 'ok - A1 dual-role platform admin cannot create_supplier despite an active tenant_admin membership';
end $$; rollback to sp_a1;

savepoint sp_a2; do $$ declare v_supplier_id uuid; begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  perform public.create_supplier_evidence('10000000-0000-0000-0000-000000000003', v_supplier_id, 'incorporation_record', 'Dual role doc', null, null, 'provided', repeat('a',64));
  raise exception 'ASSERTION FAILED: A2 dual-role create_supplier_evidence must be denied';
exception when sqlstate '42501' then raise notice 'ok - A2 dual-role platform admin cannot create_supplier_evidence despite an active tenant_admin membership';
end $$; rollback to sp_a2;

savepoint sp_a3; do $$ declare v_supplier_id uuid; begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  perform public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'a1000000-0000-0000-0000-000000000099');
  raise exception 'ASSERTION FAILED: A3 dual-role run_supplier_evaluation must be denied';
exception when sqlstate '42501' then raise notice 'ok - A3 dual-role platform admin cannot run_supplier_evaluation despite an active tenant_admin membership';
end $$; rollback to sp_a3;

select pg_temp.assert(
  (select count(*) from public.suppliers where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'A4 dual-role platform admin reads zero suppliers despite an active tenant_admin membership'
);
select pg_temp.assert(
  (select count(*) from public.evaluations where tenant_id = '10000000-0000-0000-0000-000000000003' and supplier_id is not null) = 0,
  'A5 dual-role platform admin reads zero supplier evaluations despite an active tenant_admin membership'
);

reset role;
delete from public.memberships where tenant_id = '10000000-0000-0000-0000-000000000003' and user_id = '00000000-0000-0000-0000-000000000001';

-- Real cross-tenant evaluation id in record_supplier_final_decision: a
-- genuinely existing evaluation (fixture above, tenant M) presented by a
-- legitimate tenant_admin of a DIFFERENT tenant (B), rather than the
-- nonexistent-uuid probe used elsewhere. The mismatch must fail exactly as
-- "not found" and not disclose that the id exists in another tenant.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000006';
savepoint sp_cross_tenant_real_id; do $$ declare v_evaluation_id uuid; begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'a1000000-0000-0000-0000-000000000001';
  perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000002', v_evaluation_id, 'approve', null, gen_random_uuid());
  raise exception 'ASSERTION FAILED: a real evaluation id belonging to another tenant must be rejected as not found';
exception when sqlstate 'P0002' then raise notice 'ok - a real, existing evaluation id from tenant M is not found for tenant B (cross-tenant lookup, not string-forgery)';
end $$; rollback to sp_cross_tenant_real_id;
reset role;

-- B. Suspended tenant M denies every operational read and write, even for
-- its own active tenant_admin (TASK-026 D2) --------------------------------
update public.tenants set status = 'suspended' where id = '10000000-0000-0000-0000-000000000003';

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';

select pg_temp.assert(
  (select count(*) from public.suppliers where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'B1 suspended-tenant admin reads zero suppliers'
);

savepoint sp_b2; do $$ begin
  perform public.create_supplier('10000000-0000-0000-0000-000000000003','SUP-SUSP-001','Susp Ltd.','MT','FICT-SUSP','industrial_components',array['MT'],'Probe.',1000,'EUR','assisted',null);
  raise exception 'ASSERTION FAILED: B2 suspended-tenant create_supplier must be denied';
exception when sqlstate '42501' then raise notice 'ok - B2 suspended-tenant admin cannot create_supplier';
end $$; rollback to sp_b2;

savepoint sp_b3; do $$ declare v_supplier_id uuid; begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  perform public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'a1000000-0000-0000-0000-000000000098');
  raise exception 'ASSERTION FAILED: B3 suspended-tenant run_supplier_evaluation must be denied';
exception when sqlstate '42501' then raise notice 'ok - B3 suspended-tenant admin cannot run_supplier_evaluation';
end $$; rollback to sp_b3;

savepoint sp_b4; do $$ declare v_evaluation_id uuid; begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'a1000000-0000-0000-0000-000000000001';
  perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003', v_evaluation_id, 'approve', null, gen_random_uuid());
  raise exception 'ASSERTION FAILED: B4 suspended-tenant record_supplier_final_decision must be denied';
exception when sqlstate '42501' then raise notice 'ok - B4 suspended-tenant admin cannot record_supplier_final_decision';
end $$; rollback to sp_b4;

select pg_temp.assert(
  (select count(*) from public.supplier_final_decisions where tenant_id = '10000000-0000-0000-0000-000000000003') = 0,
  'B5 suspended-tenant admin reads zero supplier final decisions'
);

reset role;
update public.tenants set status = 'active' where id = '10000000-0000-0000-0000-000000000003';

-- C. Regression: operator (evaluation.run, no supplier.manage) can still
-- run a supplier evaluation -------------------------------------------------
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000004';
do $$
declare
  v_supplier_id uuid;
  v_result public.evaluations;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  v_result := public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'a1000000-0000-0000-0000-000000000002');
  perform pg_temp.assert(v_result.status = 'completed', 'C1 regression: operator can still run_supplier_evaluation');
end;
$$;
reset role;

-- Regression: risk_analyst (supplier.manage) can still create evidence ----
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
do $$
declare
  v_supplier_id uuid;
  v_evidence public.supplier_evidence;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  v_evidence := public.create_supplier_evidence('10000000-0000-0000-0000-000000000003', v_supplier_id, 'ownership_declaration', 'Uniform ownership declaration', 'MT', '2026-01-15', 'reviewed', repeat('b', 64));
  perform pg_temp.assert(v_evidence.created_by = auth.uid(), 'regression: risk_analyst can still create_supplier_evidence');
end;
$$;
reset role;

-- Regression: auditor (read-only) can still read suppliers, evaluations,
-- reason codes, and final decisions -----------------------------------------
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000005';
select pg_temp.assert(
  (select count(*) from public.suppliers where tenant_id = '10000000-0000-0000-0000-000000000003') >= 1,
  'regression: auditor can still read suppliers'
);
select pg_temp.assert(
  (select count(*) from public.evaluations where tenant_id = '10000000-0000-0000-0000-000000000003' and supplier_id is not null) >= 1,
  'regression: auditor can still read supplier evaluations'
);
do $$
declare v_evaluation_id uuid; begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'a1000000-0000-0000-0000-000000000001';
  perform pg_temp.assert(
    (select count(*) from public.evaluation_reason_codes where evaluation_id = v_evaluation_id) > 0,
    'regression: auditor can still read evaluation reason codes'
  );
end;
$$;
reset role;

-- Regression: a legitimate tenant_admin can still write a legacy
-- (supplier_id is null) evaluation directly -- D3 narrows the platform-
-- admin bypass, not the member-only path a real tenant admin already used.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
begin
  insert into public.evaluations (
    tenant_id, policy_version_id, subject_reference, input_hash,
    normalized_input, correlation_id, actor_id, actor_type
  ) values (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010',
    'LEGACY-REGRESSION', repeat('d', 64), '{}'::jsonb,
    'a3000000-0000-0000-0000-000000000001', auth.uid(), 'user'
  );
  perform pg_temp.assert(
    (select count(*) from public.evaluations where correlation_id = 'a3000000-0000-0000-0000-000000000001') = 1,
    'regression: a legitimate tenant_admin can still write a legacy (supplier_id is null) evaluation directly'
  );
end;
$$;
reset role;

-- F. Legacy evaluation path: a platform admin with NO membership at all in
-- tenant M can neither write nor read a legacy (supplier_id is null)
-- evaluation (TASK-026 D3) ---------------------------------------------------
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

savepoint sp_f1; do $$ begin
  insert into public.evaluations (
    tenant_id, policy_version_id, subject_reference, input_hash,
    normalized_input, correlation_id, actor_id, actor_type
  ) values (
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010',
    'LEGACY-X', repeat('c', 64), '{}'::jsonb,
    gen_random_uuid(), auth.uid(), 'user'
  );
  raise exception 'ASSERTION FAILED: F1 platform-admin direct legacy evaluation insert must be denied';
exception when insufficient_privilege then raise notice 'ok - F1 platform admin (no membership) cannot insert a legacy evaluation into tenant M';
end $$; rollback to sp_f1;

select pg_temp.assert(
  (select count(*) from public.evaluations where tenant_id = '10000000-0000-0000-0000-000000000003' and supplier_id is null) = 0,
  'F2 platform admin (no membership) reads zero legacy evaluations in tenant M'
);

reset role;

-- D. A structurally invalid published policy (a factor with min = max)
-- fails closed with SQLSTATE 22023, before any write --------------------
insert into public.policy_versions (id, tenant_id, version_number, status, created_by)
values ('29000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000003',99,'draft','00000000-0000-0000-0000-000000000002');
insert into public.policy_factors (tenant_id, policy_version_id, key, label, weight, config)
values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000099','geographic_risk','Geo',10,'{"min": 5, "max": 5, "direction": "higher_is_riskier", "required": true}');
insert into public.policy_thresholds (tenant_id, policy_version_id, label, min_score, max_score, decision_band)
values ('10000000-0000-0000-0000-000000000003','29000000-0000-0000-0000-000000000099','All',0,100,'approve');

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
update public.policy_versions set status = 'published', effective_from = now(), published_at = now() + interval '1 minute', published_by = auth.uid()
where id = '29000000-0000-0000-0000-000000000099';

savepoint sp_d1; do $$ declare v_supplier_id uuid; begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  perform public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'a1000000-0000-0000-0000-000000000003');
  raise exception 'ASSERTION FAILED: D a degenerate (min = max) published policy must fail with 22023';
exception when sqlstate '22023' then raise notice 'ok - D degenerate published policy factor (min = max) is rejected before any computation (%)', sqlerrm;
end $$; rollback to sp_d1;

select pg_temp.assert(
  (select count(*) from public.evaluations where correlation_id = 'a1000000-0000-0000-0000-000000000003') = 0,
  'D no evaluation row is left behind by the rejected degenerate policy'
);
select pg_temp.assert(
  (select count(*) from public.audit_events where action = 'evaluation.completed' and correlation_id = 'a1000000-0000-0000-0000-000000000003') = 0,
  'D no audit row is left behind by the rejected degenerate policy'
);

-- The degenerate policy version itself is outside any savepoint above (a
-- published policy version is immutable, so its insert cannot be rolled
-- back and replayed the way a failed evaluation attempt is): archive it
-- now, the one status transition immutability still allows, so it stops
-- being tenant M's most-recently-published policy and cannot shadow the
-- valid fixture policy for the idempotency check below.
update public.policy_versions set status = 'archived'
where id = '29000000-0000-0000-0000-000000000099';

reset role;

-- Idempotency: two identical calls with the same correlation id, executed
-- back to back under the new advisory lock, return the same row -----------
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
declare
  v_supplier_id uuid;
  v_first public.evaluations;
  v_second public.evaluations;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-UNIFORM-001';
  v_first := public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'a1000000-0000-0000-0000-000000000004');
  v_second := public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'a1000000-0000-0000-0000-000000000004');
  perform pg_temp.assert(v_first.id = v_second.id, 'two identical calls with the same correlation id return the same evaluation row');
end;
$$;
select pg_temp.assert(
  (select count(*) from public.evaluations where correlation_id = 'a1000000-0000-0000-0000-000000000004') = 1,
  'a replayed correlation id never creates a second evaluation row'
);
reset role;

do $$
begin
  raise notice 'Uniform database authorization verification completed successfully.';
end;
$$;

rollback;

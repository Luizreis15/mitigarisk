-- TASK-029 verification: completed evaluation evidence and audit evidence
-- cannot be forged or altered through the database, by any identity.
-- Converts REVIEW-TASK-028's findings R and AU into permanent, failing
-- assertions, and proves the guard-trigger fixes (item 2) fail closed.
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
--   tenant_admin (M)  = 00000000-0000-0000-0000-000000000002
--   risk_analyst (M)  = 00000000-0000-0000-0000-000000000003
--   "Supplier onboarding policy" v1 (published) = 20000000-0000-0000-0000-000000000010 (tenant M)

-- Fixture: a real supplier and a real, completed supplier evaluation (with
-- real reason codes) in tenant M, as the legitimate tenant_admin.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.create_supplier('10000000-0000-0000-0000-000000000003','SUP-INTEGRITY-001','Integrity Ltd.','MT','FICT-INTEGRITY','industrial_components',array['MT'],'TASK-029 fixture.',1000,'EUR','assisted',null);
do $$
declare v_supplier_id uuid; v_result public.evaluations;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-INTEGRITY-001';
  v_result := public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003', v_supplier_id, 'c1000000-0000-0000-0000-000000000001');
  perform pg_temp.assert(v_result.status = 'completed', 'fixture: a real, completed evaluation exists to attack');
  perform pg_temp.assert(
    (select count(*) from public.evaluation_reason_codes where evaluation_id = v_result.id) = 7,
    'fixture: the completed evaluation has real reason codes'
  );
end;
$$;
reset role;

-- R: neither a mass UPDATE nor a forged INSERT can touch reason codes,
-- for any identity -- platform admin with no membership, dual-role,
-- tenant_admin, risk_analyst. D8 revokes the grant outright, so every
-- attempt fails on the grant itself (insufficient_privilege, 42501),
-- before RLS or the trigger is ever reached.
insert into public.memberships (tenant_id,user_id,role_key,status,invited_by)
values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','tenant_admin','active','00000000-0000-0000-0000-000000000002');

-- Dual-role platform admin, tenant_admin, and risk_analyst, all denied
-- identically: D8's revoke makes no distinction by role or membership.
set role authenticated;
do $$
declare
  v_identity record;
  v_evaluation_id uuid;
begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'c1000000-0000-0000-0000-000000000001';

  for v_identity in
    select * from (values
      ('00000000-0000-0000-0000-000000000001'::uuid, 'dual-role platform admin'),
      ('00000000-0000-0000-0000-000000000002'::uuid, 'tenant_admin'),
      ('00000000-0000-0000-0000-000000000003'::uuid, 'risk_analyst')
    ) as t(sub, label)
  loop
    perform set_config('request.jwt.claim.sub', v_identity.sub::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    begin
      update public.evaluation_reason_codes set description = 'TAMPERED';
      raise exception 'ASSERTION FAILED: R mass update by % must be denied', v_identity.label;
    exception when insufficient_privilege then
      raise notice 'ok - R: % cannot run an unqualified UPDATE on evaluation_reason_codes', v_identity.label;
    end;

    begin
      insert into public.evaluation_reason_codes (tenant_id, evaluation_id, code, description)
      values ('10000000-0000-0000-0000-000000000003', v_evaluation_id, 'FORGED', 'Forged reason');
      raise exception 'ASSERTION FAILED: R forged insert by % must be denied', v_identity.label;
    exception when insufficient_privilege then
      raise notice 'ok - R: % cannot INSERT a forged reason code into a completed evaluation', v_identity.label;
    end;
  end loop;
end;
$$;
reset role;

-- The genuine "platform admin, no membership at all" case: remove the
-- dual-role fixture membership first.
delete from public.memberships where tenant_id = '10000000-0000-0000-0000-000000000003' and user_id = '00000000-0000-0000-0000-000000000001';
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
do $$
declare v_evaluation_id uuid;
begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'c1000000-0000-0000-0000-000000000001';
  begin
    update public.evaluation_reason_codes set description = 'TAMPERED';
    raise exception 'ASSERTION FAILED: R mass update by platform admin (no membership) must be denied';
  exception when insufficient_privilege then
    raise notice 'ok - R: platform admin with no membership cannot run an unqualified UPDATE on evaluation_reason_codes';
  end;
  begin
    insert into public.evaluation_reason_codes (tenant_id, evaluation_id, code, description)
    values ('10000000-0000-0000-0000-000000000003', v_evaluation_id, 'FORGED', 'Forged reason');
    raise exception 'ASSERTION FAILED: R forged insert by platform admin (no membership) must be denied';
  exception when insufficient_privilege then
    raise notice 'ok - R: platform admin with no membership cannot INSERT a forged reason code into a completed evaluation';
  end;
end;
$$;
reset role;

-- Proof, as superuser (no RLS/grant question), that nothing above actually
-- changed anything: the row count is exactly what the fixture created, and
-- no row carries the tamper marker.
select pg_temp.assert(
  (select count(*) from public.evaluation_reason_codes where description = 'TAMPERED') = 0,
  'R: no reason code anywhere was rewritten to TAMPERED'
);
do $$
declare v_evaluation_id uuid;
begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'c1000000-0000-0000-0000-000000000001';
  perform pg_temp.assert(
    (select count(*) from public.evaluation_reason_codes where evaluation_id = v_evaluation_id) = 7,
    'R: the completed evaluation still has exactly its original 7 reason codes, no forged addition'
  );
end;
$$;

-- AU: record_audit_event is not callable by any authenticated identity ----
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
do $$ begin
  perform public.record_audit_event('10000000-0000-0000-0000-000000000003', 'platform.fake', 'platform');
  raise exception 'ASSERTION FAILED: AU1 platform admin must not call record_audit_event directly';
exception when insufficient_privilege then raise notice 'ok - AU1: platform admin cannot call record_audit_event directly (42501)';
end $$;
reset role;

-- AU2: a risk_analyst forging a business-looking event in their own tenant.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.record_audit_event(
    '10000000-0000-0000-0000-000000000003', 'supplier.final_decision_recorded', 'supplier_final_decision',
    gen_random_uuid()::text, gen_random_uuid(), jsonb_build_object('decision', 'approve', 'forged', true)
  );
  raise exception 'ASSERTION FAILED: AU2 risk_analyst must not forge a business event in their own tenant';
exception when insufficient_privilege then raise notice 'ok - AU2: risk_analyst cannot forge a supplier.final_decision_recorded event (42501)';
end $$;
reset role;

-- Every business RPC still writes its audit event atomically -------------
-- (also exercises the legitimate flows: supplier creation, evidence,
-- evaluation, final decision, tenant bootstrap, membership invitation).
select pg_temp.assert(
  exists (select 1 from public.audit_events where action = 'supplier.created' and target_type = 'supplier'
    and target_id = (select id::text from public.suppliers where reference = 'SUP-INTEGRITY-001')),
  'legitimate flow: create_supplier still records its audit event'
);

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
do $$
declare v_supplier_id uuid; v_evidence public.supplier_evidence;
begin
  select id into v_supplier_id from public.suppliers where reference = 'SUP-INTEGRITY-001';
  v_evidence := public.create_supplier_evidence('10000000-0000-0000-0000-000000000003', v_supplier_id, 'ownership_declaration', 'Integrity ownership declaration', 'MT', '2026-01-15', 'reviewed', repeat('a', 64));
  perform pg_temp.assert(
    exists (select 1 from public.audit_events where action = 'supplier_evidence.created' and target_id = v_evidence.id::text),
    'legitimate flow: create_supplier_evidence still records its audit event'
  );
end;
$$;
reset role;

select pg_temp.assert(
  exists (
    select 1 from public.audit_events ae
    join public.evaluations e on e.id::text = ae.target_id
    where ae.action = 'evaluation.completed' and e.correlation_id = 'c1000000-0000-0000-0000-000000000001'
  ),
  'legitimate flow: run_supplier_evaluation still records its audit event'
);

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
declare v_evaluation_id uuid; v_decision public.supplier_final_decisions;
begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'c1000000-0000-0000-0000-000000000001';
  v_decision := public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003', v_evaluation_id, 'approve', null, gen_random_uuid());
  perform pg_temp.assert(
    exists (select 1 from public.audit_events where action = 'supplier.final_decision_recorded' and target_id = v_decision.id::text),
    'legitimate flow: record_supplier_final_decision still records its audit event'
  );
end;
$$;
reset role;

-- D6 (TASK-028) means the bootstrapping platform admin is not themselves a
-- member of the tenant they just created (the initial tenant_admin
-- membership goes to p_initial_admin_user_id, a different, specified
-- user), so they cannot read back its tenant-scoped audit_events row --
-- exactly the same D6 consequence already documented and fixed in
-- supabase/tests/030-auth-tenant-bootstrap.sql. The existence check runs
-- as the superuser connection, decoupled from that read-visibility
-- question, which is not what this assertion is testing.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
do $$
declare v_tenant public.tenants;
begin
  v_tenant := public.bootstrap_tenant('Evidence Integrity Co', 'evidence-integrity-co', '00000000-0000-0000-0000-000000000004');
  perform set_config('app.fixture_tenant_id', v_tenant.id::text, true);
end;
$$;
reset role;
select pg_temp.assert(
  exists (select 1 from public.audit_events where action = 'tenant.bootstrapped' and tenant_id = current_setting('app.fixture_tenant_id')::uuid),
  'legitimate flow: bootstrap_tenant (now security definer) still records its audit event'
);

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
declare v_membership public.memberships;
begin
  v_membership := public.invite_member('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', 'operator');
  perform pg_temp.assert(
    exists (select 1 from public.audit_events where action = 'membership.invited' and target_id = v_membership.id::text),
    'legitimate flow: invite_member (now security definer) still records its audit event'
  );
end;
$$;
reset role;

-- The invitee (operator) has no audit.view capability at all, so the read
-- below runs as superuser -- same pattern already established in
-- supabase/tests/030-auth-tenant-bootstrap.sql for this exact RPC.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000006';
do $$
declare v_pending_id uuid; v_membership public.memberships;
begin
  select id into v_pending_id from public.memberships
  where tenant_id = '10000000-0000-0000-0000-000000000003' and user_id = '00000000-0000-0000-0000-000000000006';
  v_membership := public.accept_invitation(v_pending_id);
  perform set_config('app.fixture_membership_id', v_membership.id::text, true);
end;
$$;
reset role;
select pg_temp.assert(
  exists (select 1 from public.audit_events where action = 'membership.activated' and target_id = current_setting('app.fixture_membership_id')),
  'legitimate flow: accept_invitation (now security definer) still records its audit event'
);

set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
declare v_target_id uuid; v_membership public.memberships;
begin
  select id into v_target_id from public.memberships
  where tenant_id = '10000000-0000-0000-0000-000000000003' and user_id = '00000000-0000-0000-0000-000000000006';
  v_membership := public.set_membership_status(v_target_id, 'suspended');
  perform pg_temp.assert(
    exists (select 1 from public.audit_events where action = 'membership.status_changed' and target_id = v_membership.id::text),
    'legitimate flow: set_membership_status (now security definer) still records its audit event'
  );
end;
$$;
reset role;

-- Regression: invite_member/set_membership_status still enforce
-- tenant.manage_members explicitly now (moved out of RLS into the
-- function body when they became security definer).
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000004';
do $$ begin
  perform public.invite_member('10000000-0000-0000-0000-000000000003', gen_random_uuid(), 'operator');
  raise exception 'ASSERTION FAILED: operator lacks tenant.manage_members and must not invite';
exception when sqlstate '42501' then raise notice 'ok - regression: invite_member still rejects a caller without tenant.manage_members';
end $$;
reset role;

-- Item 2 guard-trigger fixes fail closed ------------------------------------

-- forbid_reason_code_mutation_after_completion: a reason code whose parent
-- evaluation cannot be found at all fails closed with 23001 (never passes
-- silently the way it did for finding R). Exercised as superuser, the one
-- role that can still reach the write path directly, to isolate the
-- trigger's own behavior from the grant/RLS question already covered by R
-- and AU above.
do $$ begin
  insert into public.evaluation_reason_codes (tenant_id, evaluation_id, code, description)
  values ('10000000-0000-0000-0000-000000000003', gen_random_uuid(), 'GHOST', 'No such evaluation');
  raise exception 'ASSERTION FAILED: a reason code whose parent evaluation cannot be found must fail closed';
exception when sqlstate '23001' then raise notice 'ok - forbid_reason_code_mutation_after_completion fails closed (23001) when the parent evaluation cannot be found';
end $$;

do $$
declare v_evaluation_id uuid;
begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'c1000000-0000-0000-0000-000000000001';
  begin
    insert into public.evaluation_reason_codes (tenant_id, evaluation_id, code, description)
    values ('10000000-0000-0000-0000-000000000003', v_evaluation_id, 'GHOST2', 'Completed parent');
    raise exception 'ASSERTION FAILED: a reason code for a completed evaluation must still be rejected';
  exception when sqlstate '23001' then raise notice 'ok - forbid_reason_code_mutation_after_completion still fails closed (23001) for a real completed evaluation, now correctly seeing it as security definer';
  end;
end;
$$;

-- forbid_completed_evaluation_mutation: unaffected by the security-definer
-- change (self-row only), still blocks mutation of a completed evaluation
-- -- exercised as a legitimate tenant_admin (who does hold evaluation.run
-- and would otherwise pass RLS) to prove the trigger, not just RLS, is the
-- backstop.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
do $$
declare v_evaluation_id uuid;
begin
  select id into v_evaluation_id from public.evaluations where correlation_id = 'c1000000-0000-0000-0000-000000000001';
  update public.evaluations set score = 0 where id = v_evaluation_id;
  raise exception 'ASSERTION FAILED: a completed evaluation must remain immutable';
exception when sqlstate '23001' then raise notice 'ok - forbid_completed_evaluation_mutation (now security definer) still blocks mutation of a completed evaluation';
end $$;
reset role;

do $$
begin
  raise notice 'Evidence integrity verification completed successfully.';
end;
$$;

rollback;

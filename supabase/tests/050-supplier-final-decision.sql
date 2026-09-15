-- TASK-025 direct database verification for tenant-admin-only, immutable,
-- idempotent and atomically audited supplier final decisions.
\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.assert(p boolean, m text) returns void language plpgsql as $$ begin if not p then raise exception 'ASSERTION FAILED: %',m; end if; raise notice 'ok - %',m; end $$;

-- Build one fictional completed evaluation through the trusted TASK-023 paths.
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.create_supplier('10000000-0000-0000-0000-000000000003','SUP-DECISION-001','Decision Fixture Ltd.','MT','FICTIONAL-DECISION','industrial_components',array['MT'],'Fictional decision verification.',1000,'EUR','assisted',null);
select public.run_supplier_evaluation('10000000-0000-0000-0000-000000000003',(select id from public.suppliers where reference='SUP-DECISION-001'),'71000000-0000-0000-0000-000000000001');

do $$ declare e uuid; d public.supplier_final_decisions; r text; begin
 select id,decision_band into e,r from public.evaluations where correlation_id='71000000-0000-0000-0000-000000000001';
 d:=public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003',e,'reject','  Fictional commercial risk appetite.  ','72000000-0000-0000-0000-000000000001');
 perform pg_temp.assert(d.decided_by=auth.uid(),'actor is pinned to auth.uid()');
 perform pg_temp.assert(d.rationale='Fictional commercial risk appetite.','rationale is trimmed');
 perform pg_temp.assert((select decision_band from public.evaluations where id=e)=r,'engine recommendation remains unchanged');
 perform pg_temp.assert((select count(*) from public.audit_events where target_id=d.id::text and action='supplier.final_decision_recorded' and correlation_id=d.correlation_id)=1,'decision and audit event are created atomically');
 perform pg_temp.assert(not ((select metadata from public.audit_events where target_id=d.id::text) ? 'rationale'),'audit metadata excludes rationale');
end $$;

select pg_temp.assert(public.can_record_supplier_final_decision('10000000-0000-0000-0000-000000000003'),'active tenant admin is recognized by the database');

-- Identical replay returns the same row; conflicts never duplicate.
do $$ declare e uuid; a uuid; b uuid; begin select id into e from public.evaluations where correlation_id='71000000-0000-0000-0000-000000000001'; select id into a from public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003',e,'reject','Fictional commercial risk appetite.','72000000-0000-0000-0000-000000000001'); select id into b from public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003',e,'reject','Fictional commercial risk appetite.','72000000-0000-0000-0000-000000000001'); perform pg_temp.assert(a=b,'identical replay returns the existing decision'); perform pg_temp.assert((select count(*) from public.supplier_final_decisions where evaluation_id=e)=1,'replay creates no duplicate'); end $$;

savepoint invalid_value; do $$ declare e uuid; begin select id into e from public.evaluations where correlation_id='71000000-0000-0000-0000-000000000001'; perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003',e,'escalate',null,'72000000-0000-0000-0000-000000000002'); raise exception 'ASSERTION FAILED'; exception when sqlstate '22023' then raise notice 'ok - invalid decision is rejected with stable SQLSTATE'; end $$; rollback to invalid_value;
savepoint conflict; do $$ declare e uuid; begin select id into e from public.evaluations where correlation_id='71000000-0000-0000-0000-000000000001'; perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003',e,'approve',null,'72000000-0000-0000-0000-000000000001'); raise exception 'ASSERTION FAILED'; exception when unique_violation then raise notice 'ok - conflicting replay is rejected'; end $$; rollback to conflict;
savepoint second_decision; do $$ declare e uuid; begin select id into e from public.evaluations where correlation_id='71000000-0000-0000-0000-000000000001'; perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003',e,'reject',null,'72000000-0000-0000-0000-000000000003'); raise exception 'ASSERTION FAILED'; exception when unique_violation then raise notice 'ok - second decision for one evaluation is rejected'; end $$; rollback to second_decision;

-- Direct writes and mutation are impossible.
savepoint direct_insert; do $$ begin insert into public.supplier_final_decisions(id) values(gen_random_uuid()); raise exception 'ASSERTION FAILED'; exception when insufficient_privilege then raise notice 'ok - direct authenticated insert has no grant'; end $$; rollback to direct_insert;
savepoint immutable_update; reset role; do $$ begin update public.supplier_final_decisions set decision='approve'; raise exception 'ASSERTION FAILED'; exception when sqlstate '23001' then raise notice 'ok - final decision update is blocked by append-only trigger'; end $$; rollback to immutable_update;
reset role; savepoint immutable_delete; do $$ begin delete from public.supplier_final_decisions; raise exception 'ASSERTION FAILED'; exception when sqlstate '23001' then raise notice 'ok - final decision delete is blocked by append-only trigger'; end $$; rollback to immutable_delete;

-- Pending and missing identifiers collapse to the same not-found SQLSTATE.
insert into public.evaluations(id,tenant_id,policy_version_id,subject_reference,input_hash,normalized_input,status,correlation_id,actor_id,actor_type,supplier_id) select '73000000-0000-0000-0000-000000000001',tenant_id,'20000000-0000-0000-0000-000000000010','SUP-DECISION-001',repeat('b',64),'{}','pending','73000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','user',id from public.suppliers where reference='SUP-DECISION-001';
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
savepoint pending; do $$ begin perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003','73000000-0000-0000-0000-000000000001','approve',null,'73000000-0000-0000-0000-000000000003'); raise exception 'ASSERTION FAILED'; exception when sqlstate 'P0002' then raise notice 'ok - pending evaluation fails closed'; end $$; rollback to pending;
savepoint missing; do $$ begin perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003','ffffffff-ffff-ffff-ffff-ffffffffffff','approve',null,'73000000-0000-0000-0000-000000000004'); raise exception 'ASSERTION FAILED'; exception when sqlstate 'P0002' then raise notice 'ok - missing or cross-tenant evaluation fails without disclosure'; end $$; rollback to missing;

-- Every non-admin identity is denied before evaluation lookup.
reset role;
do $$ declare u uuid; label text; begin foreach u in array array['00000000-0000-0000-0000-000000000003'::uuid,'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006'] loop perform set_config('request.jwt.claim.sub',u::text,true); begin perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003','ffffffff-ffff-ffff-ffff-ffffffffffff','approve',null,gen_random_uuid()); raise exception 'ASSERTION FAILED'; exception when sqlstate '42501' then raise notice 'ok - unauthorized identity % denied at database boundary',u; end; end loop; end $$;

-- Inactive tenant_admin is denied.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
update public.memberships set status='suspended' where tenant_id='10000000-0000-0000-0000-000000000003' and user_id='00000000-0000-0000-0000-000000000002';
set role authenticated; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select pg_temp.assert(not public.can_record_supplier_final_decision('10000000-0000-0000-0000-000000000003'),'inactive tenant admin has no decision authority');
savepoint inactive; do $$ begin perform public.record_supplier_final_decision('10000000-0000-0000-0000-000000000003','ffffffff-ffff-ffff-ffff-ffffffffffff','approve',null,gen_random_uuid()); raise exception 'ASSERTION FAILED'; exception when sqlstate '42501' then raise notice 'ok - inactive tenant admin is denied'; end $$; rollback to inactive;
rollback;

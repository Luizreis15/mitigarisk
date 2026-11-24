-- Required-action completions and audit-pack generation events.
-- Fixtures from supabase/seed.sql: tenant D = 1000...0004, customers C1/C2;
-- U2 tenant admin, U4 operator in D; U6 outsider; U1 platform admin.

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

create or replace function pg_temp.sqlstate_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlstate;
end;
$$;

grant execute on function pg_temp.assert(boolean, text) to authenticated;
grant execute on function pg_temp.sqlstate_of(text) to authenticated;

create temp table t_ids (key text primary key, id uuid) on commit drop;
grant select, insert on t_ids to authenticated;

create temp table t_facts (facts jsonb) on commit drop;
grant select on t_facts to authenticated;
insert into t_facts values ('{"purpose":"ecommerce","employment_status":"employed","occupation_risk":"standard","adverse_media_non_material":"none","prior_str":"none","residence_country_risk":"standard","nationality_risk":"standard","sow_country_risk":"standard","payment_method":"bank_transfer","product_type":"closed_loop","channel":"face_to_face","affordability":"not_observed","behaviour_change":"not_observed","high_value_transactions":"not_observed","sanctions_match":"none","pep_status":"confirmed","adverse_media_material":"none","hnwi":false,"blacklisted_country_link":false}');

-- Operator creates an assessment and a transaction check for C1.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
insert into t_ids select 'assessment', (public.run_customer_assessment(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', (select facts from t_facts), gen_random_uuid())).id;
insert into t_ids select 'check', (public.run_transaction_check(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
  '{"lifetime_deposits":600,"lifetime_withdrawals":0,"deposits_180d":2500,"linked_deposits":0,"linked_withdrawals":0,"days_since_registration":20,"prior_sow_documents":false}',
  gen_random_uuid())).id;

select pg_temp.assert(
  (select result -> 'required_actions' ? 'OBTAIN_SOW_SOF_DOCUMENTS' from public.customer_assessments where id = (select id from t_ids where key = 'assessment')),
  'fixture: the PEP assessment requires SOW/SOF documents');

-- 1. Validation.
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_action_completion(%L, %L, %L, %L, %L, %L, gen_random_uuid())',
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'transaction_check',
  (select id from t_ids where key = 'check'), 'SOW_DOCUMENTS', 'Docs received')) = '22023',
  'an action the source did not require is rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_action_completion(%L, %L, %L, %L, %L, %L, gen_random_uuid())',
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'transaction_check',
  (select id from t_ids where key = 'check'), 'SOW_QUESTIONNAIRE', 'ok')) = '22023',
  'an evidence note under 5 characters is rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_action_completion(%L, %L, %L, %L, %L, %L, gen_random_uuid())',
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'transaction_check',
  (select id from t_ids where key = 'check'), 'SOW_QUESTIONNAIRE', 'Questionnaire answered')) = 'P0002',
  'a source of another customer is not found');
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_action_completion(%L, %L, %L, %L, %L, %L, gen_random_uuid())',
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'email',
  (select id from t_ids where key = 'check'), 'SOW_QUESTIONNAIRE', 'Questionnaire answered')) = '22023',
  'an unknown source type is rejected');

-- 2. Success, idempotency, duplicate.
insert into t_ids values ('corr', gen_random_uuid());
insert into t_ids select 'completion', (public.record_action_completion(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'transaction_check',
  (select id from t_ids where key = 'check'), 'SOW_QUESTIONNAIRE', '  SOW questionnaire answered on 23 Nov (ref Q-118).  ',
  (select id from t_ids where key = 'corr'))).id;
select pg_temp.assert(
  (select evidence_note = 'SOW questionnaire answered on 23 Nov (ref Q-118).' and completed_by = '00000000-0000-0000-0000-000000000004'
     from public.customer_action_completions where id = (select id from t_ids where key = 'completion')),
  'completion stored with trimmed note and the caller');
select pg_temp.assert(
  (public.record_action_completion(
    '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'transaction_check',
    (select id from t_ids where key = 'check'), 'SOW_QUESTIONNAIRE', 'SOW questionnaire answered on 23 Nov (ref Q-118).',
    (select id from t_ids where key = 'corr'))).id = (select id from t_ids where key = 'completion'),
  'identical replay returns the same completion');
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_action_completion(%L, %L, %L, %L, %L, %L, gen_random_uuid())',
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'transaction_check',
  (select id from t_ids where key = 'check'), 'SOW_QUESTIONNAIRE', 'Recorded a second time')) = '23505',
  'the same action cannot be completed twice');
select public.record_action_completion(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'assessment',
  (select id from t_ids where key = 'assessment'), 'OBTAIN_SOW_SOF_DOCUMENTS', 'Bank statements and payslips received.', gen_random_uuid());
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'update public.customer_action_completions set evidence_note = %L where id = %L', 'changed', (select id from t_ids where key = 'completion'))) <> 'OK',
  'a completion cannot be updated');
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'delete from public.customer_action_completions where id = %L', (select id from t_ids where key = 'completion'))) <> 'OK',
  'a completion cannot be deleted');

-- 3. Operator cannot generate an audit pack (no audit.view).
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_audit_pack_generated(%L, %L, %L)', '10000000-0000-0000-0000-000000000004',
  '30000000-0000-0000-0000-000000000001', repeat('a', 64))) = '42501',
  'operator cannot generate an audit pack');
reset role;

-- 4. Outsider: no completions visible, cannot complete.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert((select count(*) from public.customer_action_completions) = 0, 'outsider reads no completions');
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_action_completion(%L, %L, %L, %L, %L, %L, gen_random_uuid())',
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'transaction_check',
  (select id from t_ids where key = 'check'), 'FULL_KYC_AND_PURPOSE', 'KYC documents verified')) = '42501',
  'outsider cannot complete an action');
reset role;

-- 5. Tenant admin (audit.view) generates a pack; the event carries the digest.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(pg_temp.sqlstate_of(format(
  'select public.record_audit_pack_generated(%L, %L, %L)', '10000000-0000-0000-0000-000000000004',
  '30000000-0000-0000-0000-000000000001', 'not-a-digest')) = '22023',
  'a malformed digest is rejected');
select public.record_audit_pack_generated('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', repeat('f', 64));
select pg_temp.assert((select count(*) from public.customer_action_completions) = 2, 'tenant admin reads both completions');
reset role;

select pg_temp.assert(
  (select count(*) from public.audit_events where action = 'customer.audit_pack_generated'
     and metadata ->> 'sha256' = repeat('f', 64) and target_id = '30000000-0000-0000-0000-000000000001') = 1,
  'pack generation audited with its digest');
select pg_temp.assert(
  (select count(*) from public.audit_events where action = 'customer.action_completed') = 2,
  'one audit event per stored completion');

do $$ begin raise notice 'Action completion and audit pack verification completed successfully.'; end $$;

rollback;

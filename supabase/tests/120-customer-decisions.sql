-- Customer onboarding decisions (MLRO / board) on CRA results that require
-- review. Proves authorization, the decision chain, validation,
-- idempotency, immutability, audit and tenant isolation.
--
-- Fixtures from supabase/seed.sql: demo tenant D = 1000...0004 with a
-- published cra_v2 policy, tenant admin U2 and operator U4; customer
-- C2 = 3000...0002 in D. U6 is an admin of another tenant only; U1 is the
-- platform administrator.
--
-- Run in a single psql session after 000-local-auth-shim.sql, all
-- migrations and supabase/seed.sql. See supabase/tests/README.md.

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

create temp table t_facts (kind text primary key, facts jsonb) on commit drop;
grant select on t_facts to authenticated;
insert into t_facts values
  ('base', '{"purpose":"ecommerce","employment_status":"employed","occupation_risk":"standard","adverse_media_non_material":"none","prior_str":"none","residence_country_risk":"standard","nationality_risk":"standard","sow_country_risk":"standard","payment_method":"bank_transfer","product_type":"closed_loop","channel":"face_to_face","affordability":"not_observed","behaviour_change":"not_observed","high_value_transactions":"not_observed","sanctions_match":"none","pep_status":"none","adverse_media_material":"none","hnwi":false,"blacklisted_country_link":false}');
insert into t_facts select 'pep', facts || '{"pep_status":"confirmed"}' from t_facts where kind = 'base';

-- The operator assesses C2 (PEP -> REVIEW_REQUIRED), C3 (clean -> PROCEED)
-- and C1 (PEP, later superseded).
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
insert into t_ids select 'pep', (public.run_customer_assessment(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002',
  (select facts from t_facts where kind = 'pep'), gen_random_uuid())).id;
insert into t_ids select 'clean', (public.run_customer_assessment(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003',
  (select facts from t_facts where kind = 'base'), gen_random_uuid())).id;
insert into t_ids select 'stale_c1', (public.run_customer_assessment(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
  (select facts from t_facts where kind = 'pep'), gen_random_uuid())).id;

-- 1. The operator cannot decide (no case.decide).
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'approve', 'Operator tries to approve')) = '42501',
  'operator cannot record a decision');
reset role;

-- Within one test transaction every assessment shares now(); as the table
-- owner, add a copy of C1's assessment one minute later so the operator's
-- C1 assessment is superseded (in production each assessment is its own
-- transaction).
with copied as (
  insert into public.customer_assessments (
    tenant_id, customer_id, policy_version_id, facts, result, overall_score, band, dd_level, outcome,
    next_review_due, correlation_id, input_hash, assessed_by, assessed_at, created_at)
  select tenant_id, customer_id, policy_version_id, facts, result, overall_score, band, dd_level, outcome,
    next_review_due, gen_random_uuid(), input_hash, assessed_by, assessed_at + interval '1 minute', created_at + interval '1 minute'
  from public.customer_assessments where id = (select id from t_ids where key = 'stale_c1')
  returning id)
insert into t_ids select 'newest_c1', id from copied;

-- 2. An admin of another tenant and the platform admin cannot decide in D.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'approve', 'Outsider tries to approve')) = '42501',
  'admin of another tenant cannot decide');
select pg_temp.assert((select count(*) from public.customer_decisions) = 0, 'outsider sees no decisions of tenant D');
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'approve', 'Platform admin tries to approve')) = '42501',
  'platform admin cannot decide for a tenant');
reset role;

-- 3. Validation, as the tenant admin (MLRO).
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'maybe', 'Not a valid decision')) = '22023',
  'unknown decision value is rejected');
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'approve', '  short  ')) = '22023',
  'a rationale under 10 characters is rejected');
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'approve', repeat('x', 1001))) = '22001',
  'a rationale over 1000 characters is rejected');
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'clean'), 'approve', 'Approving a clean low-risk customer')) = '22023',
  'a PROCEED assessment cannot be decided');
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'stale_c1'), 'approve', 'Deciding on a superseded assessment')) = '55000',
  'a superseded assessment cannot be decided');
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000002', (select id from t_ids where key = 'pep'), 'approve', 'Wrong tenant for this assessment')) in ('42501', 'P0002'),
  'an assessment of another tenant is not found or not permitted');
select pg_temp.assert((select count(*) from public.customer_decisions) = 0, 'no decision stored by any rejected call');

-- 4. MLRO escalates; replay is idempotent; a conflicting replay fails.
insert into t_ids select 'corr_escalate', gen_random_uuid();
insert into t_ids select 'escalation', (public.record_customer_decision(
  '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'escalate',
  '  Confirmed PEP with material exposure; board sign-off required.  ', (select id from t_ids where key = 'corr_escalate'))).id;
select pg_temp.assert(
  (select level = 'mlro' and decision = 'escalate' and decided_by = '00000000-0000-0000-0000-000000000002'
          and rationale = 'Confirmed PEP with material exposure; board sign-off required.'
     from public.customer_decisions where id = (select id from t_ids where key = 'escalation')),
  'MLRO escalation stored with trimmed rationale and the caller as decider');
select pg_temp.assert(
  (public.record_customer_decision(
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'escalate',
    'Confirmed PEP with material exposure; board sign-off required.', (select id from t_ids where key = 'corr_escalate'))).id
  = (select id from t_ids where key = 'escalation'),
  'identical replay returns the same decision');
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, %L)',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'approve',
    'Different content, same correlation', (select id from t_ids where key = 'corr_escalate'))) = '23505',
  'conflicting replay on the same correlation id fails');

-- 5. Board level: cannot escalate again; approves; then everything is final.
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'escalate', 'Escalating a second time')) = '22023',
  'the board cannot escalate');
insert into t_ids select 'board', (public.record_customer_decision(
  '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'approve',
  'Board approves with enhanced ongoing monitoring.', gen_random_uuid())).id;
select pg_temp.assert(
  (select level = 'board' and decision = 'approve' from public.customer_decisions where id = (select id from t_ids where key = 'board')),
  'board approval stored at board level');
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'pep'), 'reject', 'Trying to reverse a final decision')) = '23505',
  'no decision after the board has decided');

-- 6. Immutability: no update or delete, even as the MLRO.
select pg_temp.assert(
  pg_temp.sqlstate_of(format('update public.customer_decisions set decision = %L where id = %L', 'reject',
    (select id from t_ids where key = 'board'))) <> 'OK',
  'a decision cannot be updated');
select pg_temp.assert(
  pg_temp.sqlstate_of(format('delete from public.customer_decisions where id = %L', (select id from t_ids where key = 'board'))) <> 'OK',
  'a decision cannot be deleted');
reset role;

select pg_temp.assert(
  pg_temp.sqlstate_of(format('delete from public.customer_decisions where id = %L', (select id from t_ids where key = 'board'))) <> 'OK',
  'a decision cannot be deleted even by the table owner');

-- 7. Audit: one event per stored decision (replays add nothing).
select pg_temp.assert(
  (select count(*) from public.audit_events
     where tenant_id = '10000000-0000-0000-0000-000000000004' and action = 'customer.decision_recorded') = 2,
  'exactly two decision audit events (escalation + board approval)');

-- 8. A fresh MLRO-level approve is final at once.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select pg_temp.assert((select count(*) from public.customer_decisions) = 2, 'operator can read the tenant decisions');
reset role;
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select public.record_customer_decision(
  '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'newest_c1'), 'reject',
  'Source of wealth could not be established.', gen_random_uuid());
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    'select public.record_customer_decision(%L, %L, %L, %L, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', (select id from t_ids where key = 'newest_c1'), 'escalate', 'Escalating after a final rejection')) = '23505',
  'an MLRO rejection is final');
reset role;

do $$ begin raise notice 'Customer decision verification completed successfully.'; end $$;

rollback;

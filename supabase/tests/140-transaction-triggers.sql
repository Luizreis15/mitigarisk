-- Transaction trigger evaluator (MITIGA gambling-industry default v1):
-- thresholds at their exact boundaries, the 90% net-deposit rule, input
-- validation, authorization, idempotency, immutability, audit and isolation.
--
-- Fixtures from supabase/seed.sql: tenant D = 1000...0004, customer
-- C1 = 3000...0001; U4 operator in D, U5 auditor (not in D), U6 outsider,
-- U2 tenant admin.

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

-- Base input: everything quiet.
create temp table t_in (k text primary key, j jsonb) on commit drop;
grant select on t_in to authenticated;
insert into t_in values ('base', '{"lifetime_deposits":0,"lifetime_withdrawals":0,"deposits_180d":0,"linked_deposits":0,"linked_withdrawals":0,"days_since_registration":10,"prior_sow_documents":false}');

create or replace function pg_temp.status(p_input jsonb, p_code text) returns text language sql as $$
  select x ->> 'status' from jsonb_array_elements(app.evaluate_transaction_triggers(p_input) -> 'results') x where x ->> 'code' = p_code;
$$;
create or replace function pg_temp.with_base(p jsonb) returns jsonb language sql as $$
  select (select j from t_in where k = 'base') || p;
$$;

-- 1. Quiet customer: nothing hits; optional rules are not evaluated.
select pg_temp.assert(jsonb_array_length(app.evaluate_transaction_triggers(pg_temp.with_base('{}')) -> 'hits') = 0, 'quiet customer has no hits');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{}'), 'TRG_AFFORDABILITY') = 'not_evaluated', 'affordability not evaluated without a limit');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{}'), 'TRG_30D_AFFORDABILITY') = 'not_evaluated', '30-day rule not evaluated without declared income');
select pg_temp.assert(app.evaluate_transaction_triggers(pg_temp.with_base('{}')) ->> 'version' = 'MITIGA-GAMBLING-DEFAULT-v1', 'ruleset version recorded');

-- 2. €500 derogation: deposits + withdrawals, >= 500.
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"lifetime_deposits":300,"lifetime_withdrawals":199.99}'), 'TRG_500_DEROGATION') = 'clear', '499.99 lifetime is clear');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"lifetime_deposits":300,"lifetime_withdrawals":200}'), 'TRG_500_DEROGATION') = 'hit', '500.00 lifetime (deposits + withdrawals) hits');

-- 3. €2,000 in 180 days: >= 2000.
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"deposits_180d":1999.99}'), 'TRG_2K_180D') = 'clear', '1,999.99 in 180 days is clear');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"deposits_180d":2000}'), 'TRG_2K_180D') = 'hit', '2,000 in 180 days hits');

-- 4. Affordability: net = deposits - 90% withdrawals since SOW, > limit (strict).
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"sow_deposits":4000,"sow_withdrawals":1000,"affordability_limit":3100}'), 'TRG_AFFORDABILITY') = 'clear', 'net 3,100 equal to the limit is clear');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"sow_deposits":4000,"sow_withdrawals":1000,"affordability_limit":3099.99}'), 'TRG_AFFORDABILITY') = 'hit', 'net 3,100 above a 3,099.99 limit hits');
select pg_temp.assert(
  (app.evaluate_transaction_triggers(pg_temp.with_base('{"sow_deposits":4000,"sow_withdrawals":1000,"affordability_limit":5000}')) -> 'net' ->> 'sow')::numeric = 3100,
  'net deposit uses the 90% withdrawal factor');

-- 5. €10,000 linked net in the first 180 days; covered by prior SOW documents.
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"linked_deposits":10899.99,"linked_withdrawals":1000}'), 'TRG_10K_180D_LINKED') = 'clear', 'linked net 9,999.99 is clear');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"linked_deposits":10900,"linked_withdrawals":1000}'), 'TRG_10K_180D_LINKED') = 'hit', 'linked net 10,000 hits');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"linked_deposits":10900,"linked_withdrawals":1000,"prior_sow_documents":true}'), 'TRG_10K_180D_LINKED') = 'covered', 'prior SOW documents cover the 10k trigger');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"linked_deposits":20000,"linked_withdrawals":0,"days_since_registration":180}'), 'TRG_10K_180D_LINKED') = 'hit', 'day 180 is still inside the window');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"linked_deposits":20000,"linked_withdrawals":0,"days_since_registration":181}'), 'TRG_10K_180D_LINKED') = 'not_evaluated', 'day 181 is outside the window (compliance decides)');

-- 6. 30-day affordability: deposits > declared income (strict).
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"deposits_30d":3000,"declared_monthly_income":3000}'), 'TRG_30D_AFFORDABILITY') = 'clear', 'deposits equal to income are clear');
select pg_temp.assert(pg_temp.status(pg_temp.with_base('{"deposits_30d":3000.01,"declared_monthly_income":3000}'), 'TRG_30D_AFFORDABILITY') = 'hit', 'deposits above income hit');

-- 7. Hits and actions are listed together.
select pg_temp.assert(
  app.evaluate_transaction_triggers(pg_temp.with_base('{"lifetime_deposits":600,"deposits_180d":2500}')) -> 'actions'
    = '["FULL_KYC_AND_PURPOSE","SOW_QUESTIONNAIRE"]'::jsonb,
  'actions follow the hits in rule order');

-- 8. Input validation.
select pg_temp.assert(pg_temp.sqlstate_of('select app.evaluate_transaction_triggers(''[]''::jsonb)') = '22023', 'non-object input rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format('select app.evaluate_transaction_triggers(%L::jsonb)', pg_temp.with_base('{"score":99}'))) = '22023', 'unknown key rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format('select app.evaluate_transaction_triggers(%L::jsonb)', pg_temp.with_base('{"deposits_180d":-1}'))) = '22023', 'negative amount rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format('select app.evaluate_transaction_triggers(%L::jsonb)', pg_temp.with_base('{"deposits_180d":"2000"}'))) = '22023', 'amount as a string rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format('select app.evaluate_transaction_triggers(%L::jsonb)', pg_temp.with_base('{"days_since_registration":10.5}'))) = '22023', 'fractional day count rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format('select app.evaluate_transaction_triggers(%L::jsonb)', pg_temp.with_base('{"prior_sow_documents":"yes"}'))) = '22023', 'non-boolean prior documents rejected');
select pg_temp.assert(pg_temp.sqlstate_of(format('select app.evaluate_transaction_triggers(%L::jsonb)', (select j from t_in where k = 'base') - 'deposits_180d')) = '22023', 'missing required input rejected');

-- 9. Write path: authorization, idempotency, audit, immutability, isolation.
create temp table t_ids (key text primary key, id uuid) on commit drop;
grant select, insert on t_ids to authenticated;
insert into t_ids values ('corr', gen_random_uuid());

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert(
  pg_temp.sqlstate_of(format('select public.run_transaction_check(%L, %L, %L::jsonb, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', pg_temp.with_base('{}'))) = '42501',
  'outsider cannot run a check in tenant D');
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
insert into t_ids select 'check', (public.run_transaction_check(
  '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
  pg_temp.with_base('{"lifetime_deposits":600,"deposits_180d":2500}'), (select id from t_ids where key = 'corr'))).id;
select pg_temp.assert(
  (select hit_count = 2 and ruleset_version = 'MITIGA-GAMBLING-DEFAULT-v1' and checked_by = '00000000-0000-0000-0000-000000000004'
     from public.customer_transaction_checks where id = (select id from t_ids where key = 'check')),
  'operator check stored with hit count, ruleset version and the caller');
select pg_temp.assert(
  (public.run_transaction_check('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
     pg_temp.with_base('{"lifetime_deposits":600,"deposits_180d":2500}'), (select id from t_ids where key = 'corr'))).id
   = (select id from t_ids where key = 'check'),
  'identical replay returns the same check');
select pg_temp.assert(
  pg_temp.sqlstate_of(format('select public.run_transaction_check(%L, %L, %L::jsonb, %L)',
    '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', pg_temp.with_base('{}'),
    (select id from t_ids where key = 'corr'))) = '23505',
  'conflicting replay rejected');
select pg_temp.assert(
  pg_temp.sqlstate_of(format('select public.run_transaction_check(%L, %L, %L::jsonb, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', pg_temp.with_base('{"deposits_180d":-5}'))) = '22023',
  'invalid input stores nothing');
select pg_temp.assert(
  pg_temp.sqlstate_of(format('select public.run_transaction_check(%L, %L, %L::jsonb, gen_random_uuid())',
    '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000dead', pg_temp.with_base('{}'))) = 'P0002',
  'unknown customer rejected');
select pg_temp.assert(
  pg_temp.sqlstate_of(format('update public.customer_transaction_checks set hit_count = 0 where id = %L', (select id from t_ids where key = 'check'))) <> 'OK',
  'a check cannot be updated');
select pg_temp.assert(
  pg_temp.sqlstate_of(format('delete from public.customer_transaction_checks where id = %L', (select id from t_ids where key = 'check'))) <> 'OK',
  'a check cannot be deleted');
reset role;

select pg_temp.assert(
  (select count(*) from public.customer_transaction_checks where tenant_id = '10000000-0000-0000-0000-000000000004') = 1,
  'exactly one check stored');
select pg_temp.assert(
  (select count(*) from public.audit_events where action = 'customer.transaction_check_run'
     and tenant_id = '10000000-0000-0000-0000-000000000004') = 1,
  'exactly one audit event');

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert((select count(*) from public.customer_transaction_checks) = 0, 'outsider reads no checks');
reset role;
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*) from public.customer_transaction_checks) = 0, 'platform admin reads no checks');
reset role;
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert((select count(*) from public.customer_transaction_checks) = 1, 'tenant admin reads the check');
reset role;

do $$ begin raise notice 'Transaction trigger verification completed successfully.'; end $$;

rollback;

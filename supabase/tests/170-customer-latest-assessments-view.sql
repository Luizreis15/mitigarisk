-- The latest-assessment view returns one row per customer (the newest) and
-- keeps the base table's RLS. Fixtures: tenant D = 1000...0004, C1/C2;
-- U4 operator in D; U6 outsider; U1 platform admin.

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
grant execute on function pg_temp.assert(boolean, text) to authenticated;

create temp table t_ids (key text primary key, id uuid) on commit drop;
grant select, insert on t_ids to authenticated;
create temp table t_facts (facts jsonb) on commit drop;
grant select on t_facts to authenticated;
insert into t_facts values ('{"purpose":"ecommerce","employment_status":"employed","occupation_risk":"standard","adverse_media_non_material":"none","prior_str":"none","residence_country_risk":"standard","nationality_risk":"standard","sow_country_risk":"standard","payment_method":"bank_transfer","product_type":"closed_loop","channel":"face_to_face","affordability":"not_observed","behaviour_change":"not_observed","high_value_transactions":"not_observed","sanctions_match":"none","pep_status":"none","adverse_media_material":"none","hnwi":false,"blacklisted_country_link":false}');

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
insert into t_ids select 'c1_old', (public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', (select facts from t_facts), gen_random_uuid())).id;
insert into t_ids select 'c2', (public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', (select facts from t_facts), gen_random_uuid())).id;
reset role;

-- A newer C1 assessment (one minute later; same-transaction rows share now()).
with copied as (
  insert into public.customer_assessments (tenant_id, customer_id, policy_version_id, facts, result, overall_score, band, dd_level, outcome,
    next_review_due, correlation_id, input_hash, assessed_by, assessed_at, created_at)
  select tenant_id, customer_id, policy_version_id, facts, result, overall_score, band, dd_level, outcome,
    next_review_due, gen_random_uuid(), input_hash, assessed_by, assessed_at + interval '1 minute', created_at + interval '1 minute'
  from public.customer_assessments where id = (select id from t_ids where key = 'c1_old')
  returning id)
insert into t_ids select 'c1_new', id from copied;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select pg_temp.assert(
  (select count(*) from public.customer_latest_assessments where tenant_id = '10000000-0000-0000-0000-000000000004') = 2,
  'one row per assessed customer');
select pg_temp.assert(
  (select id from public.customer_latest_assessments where customer_id = '30000000-0000-0000-0000-000000000001') = (select id from t_ids where key = 'c1_new'),
  'the newest assessment wins');
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert((select count(*) from public.customer_latest_assessments) = 0, 'outsider reads nothing through the view');
reset role;
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*) from public.customer_latest_assessments) = 0, 'platform admin reads nothing through the view');
reset role;

do $$ begin raise notice 'Latest assessment view verification completed successfully.'; end $$;

rollback;

-- public.import_customers(): bulk path over public.create_customer().
-- Fixtures: tenant D = 1000...0004 with CUST-DEMO-001..003; U4 operator in D
-- (customer.manage); U6 outsider; U1 platform admin.

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

create or replace function pg_temp.raises(p_sql text, p_sqlstate text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return sqlstate = p_sqlstate;
end;
$$;
grant execute on function pg_temp.raises(text, text) to authenticated;

create temp table t_result (key text primary key, result jsonb) on commit drop;
grant select, insert on t_result to authenticated;

-- 1. A mixed file as the operator: two new rows, one identical replay of a
--    seeded customer, one conflict with a seeded reference, one row the
--    table refuses (lower-case country) and one with an impossible date.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
insert into t_result select 'mixed', public.import_customers('10000000-0000-0000-0000-000000000004', '[
  {"line": 2, "external_reference": "IMP-001", "full_name": "Ada Fictional", "date_of_birth": "1990-01-15", "country_of_birth": "PT", "nationality": "PT", "residence_country": "MT", "onboarding_channel": "non_face_to_face"},
  {"line": 3, "external_reference": "IMP-002", "full_name": "Bo Fictional", "date_of_birth": "1985-06-30", "country_of_birth": "DE", "nationality": "DE", "residence_country": "DE", "onboarding_channel": "face_to_face"},
  {"line": 4, "external_reference": "CUST-DEMO-001", "full_name": "Elena Marchetti", "date_of_birth": "1988-04-12", "country_of_birth": "IT", "nationality": "IT", "residence_country": "MT", "onboarding_channel": "face_to_face"},
  {"line": 5, "external_reference": "CUST-DEMO-002", "full_name": "Someone Else", "date_of_birth": "1995-11-03", "country_of_birth": "GH", "nationality": "GH", "residence_country": "MT", "onboarding_channel": "non_face_to_face"},
  {"line": 6, "external_reference": "IMP-003", "full_name": "Cy Fictional", "date_of_birth": "1991-02-02", "country_of_birth": "pt", "nationality": "PT", "residence_country": "PT", "onboarding_channel": "face_to_face"},
  {"line": 7, "external_reference": "IMP-004", "full_name": "Di Fictional", "date_of_birth": "1991-02-31", "country_of_birth": "PT", "nationality": "PT", "residence_country": "PT", "onboarding_channel": "face_to_face"}
]'::jsonb);

select pg_temp.assert((select (result ->> 'created')::int from t_result where key = 'mixed') = 2, 'two new customers are created');
select pg_temp.assert((select (result ->> 'unchanged')::int from t_result where key = 'mixed') = 1, 'an identical existing customer is counted as unchanged');
select pg_temp.assert(
  (select result -> 'conflicts' from t_result where key = 'mixed') = '[{"line": 5, "external_reference": "CUST-DEMO-002"}]'::jsonb,
  'a reference that exists with different data is reported as a conflict');
select pg_temp.assert(
  (select result -> 'rejected' from t_result where key = 'mixed') = '[{"line": 6, "external_reference": "IMP-003"}, {"line": 7, "external_reference": "IMP-004"}]'::jsonb,
  'rows the table refuses are reported and do not stop the batch');
select pg_temp.assert(
  (select count(*) from public.customers where tenant_id = '10000000-0000-0000-0000-000000000004' and external_reference like 'IMP-%') = 2,
  'only the valid new rows are stored');
select pg_temp.assert(
  (select full_name from public.customers where tenant_id = '10000000-0000-0000-0000-000000000004' and external_reference = 'CUST-DEMO-002') = 'Rahim Osei',
  'a conflicting row never overwrites the existing customer');
select pg_temp.assert(
  (select created_by from public.customers where external_reference = 'IMP-001') = '00000000-0000-0000-0000-000000000004',
  'created_by is the caller');

-- 2. Re-sending the same new rows changes nothing.
insert into t_result select 'replay', public.import_customers('10000000-0000-0000-0000-000000000004', '[
  {"line": 2, "external_reference": "IMP-001", "full_name": "Ada Fictional", "date_of_birth": "1990-01-15", "country_of_birth": "PT", "nationality": "PT", "residence_country": "MT", "onboarding_channel": "non_face_to_face"},
  {"line": 3, "external_reference": "IMP-002", "full_name": "Bo Fictional", "date_of_birth": "1985-06-30", "country_of_birth": "DE", "nationality": "DE", "residence_country": "DE", "onboarding_channel": "face_to_face"}
]'::jsonb);
select pg_temp.assert(
  (select result from t_result where key = 'replay') = '{"created": 0, "unchanged": 2, "conflicts": [], "rejected": []}'::jsonb,
  'a replay creates nothing and reports the rows as unchanged');

-- 3. Shape limits fail closed.
select pg_temp.assert(pg_temp.raises($q$select public.import_customers('10000000-0000-0000-0000-000000000004', '[]'::jsonb)$q$, '22023'), 'an empty batch is refused');
select pg_temp.assert(pg_temp.raises($q$select public.import_customers('10000000-0000-0000-0000-000000000004', '{"a": 1}'::jsonb)$q$, '22023'), 'a non-array payload is refused');
select pg_temp.assert(
  pg_temp.raises($q$select public.import_customers('10000000-0000-0000-0000-000000000004', (select jsonb_agg(jsonb_build_object('line', g)) from generate_series(1, 501) g))$q$, '22023'),
  'more than 500 rows is refused');
reset role;

-- 4. Audit: one customer.created per new customer, one batch summary per call.
select pg_temp.assert(
  (select count(*) from public.audit_events e join public.customers c on c.id::text = e.target_id
    where e.action = 'customer.created' and c.external_reference in ('IMP-001', 'IMP-002')) = 2,
  'each imported customer has its own customer.created audit event');
select pg_temp.assert(
  (select count(*) from public.audit_events where action = 'customer.import_completed' and tenant_id = '10000000-0000-0000-0000-000000000004') = 2,
  'each import call records one summary audit event');
select pg_temp.assert(
  (select metadata from public.audit_events where action = 'customer.import_completed' order by created_at, id limit 1)
    @> '{"rows": 6, "created": 2, "unchanged": 1, "conflicts": 1, "rejected": 2}'::jsonb
  or (select count(*) from public.audit_events where action = 'customer.import_completed'
        and metadata @> '{"rows": 6, "created": 2, "unchanged": 1, "conflicts": 1, "rejected": 2}'::jsonb) = 1,
  'the summary event carries the counts');
select pg_temp.assert(
  not exists (select 1 from public.audit_events where action = 'customer.import_completed' and (metadata::text like '%Fictional%' or metadata ? 'full_name')),
  'the summary event carries no personal data');

-- 5. Authorization: outsider and platform admin are refused, nothing stored.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert(
  pg_temp.raises($q$select public.import_customers('10000000-0000-0000-0000-000000000004', '[{"line": 2, "external_reference": "IMP-900", "full_name": "No One", "date_of_birth": "1990-01-01", "country_of_birth": "PT", "nationality": "PT", "residence_country": "PT", "onboarding_channel": "face_to_face"}]'::jsonb)$q$, '42501'),
  'an outsider cannot import');
reset role;
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.raises($q$select public.import_customers('10000000-0000-0000-0000-000000000004', '[{"line": 2, "external_reference": "IMP-900", "full_name": "No One", "date_of_birth": "1990-01-01", "country_of_birth": "PT", "nationality": "PT", "residence_country": "PT", "onboarding_channel": "face_to_face"}]'::jsonb)$q$, '42501'),
  'a platform admin cannot import');
reset role;
select pg_temp.assert(not exists (select 1 from public.customers where external_reference = 'IMP-900'), 'a refused import stores nothing');

set role anon;
select pg_temp.assert(
  pg_temp.raises($q$select public.import_customers('10000000-0000-0000-0000-000000000004', '[]'::jsonb)$q$, '42501'),
  'anon cannot execute the import');
reset role;

do $$ begin raise notice 'Customer bulk import verification completed successfully.'; end $$;

rollback;

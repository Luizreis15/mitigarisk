-- Platform console RPCs: governance-only, audited, and still blind to
-- tenant-operational data.
--
-- Fixtures from supabase/seed.sql: U1 = platform administrator; U2 = tenant
-- admin (tenants 1, 3, 4); U6 = admin of tenant 2 only; tenant D =
-- 1000...0004 with customers.
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

-- 1. Tenant members cannot use any platform RPC.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(pg_temp.sqlstate_of('select * from public.platform_tenant_overview()') = '42501', 'tenant admin cannot read the platform overview');
select pg_temp.assert(pg_temp.sqlstate_of('select * from public.platform_tenant_members(''10000000-0000-0000-0000-000000000004'')') = '42501', 'tenant admin cannot list members through the platform RPC');
select pg_temp.assert(pg_temp.sqlstate_of('select public.platform_create_tenant(''X Co'', ''x-co'', ''dev-outsider@example.test'')') = '42501', 'tenant admin cannot create a tenant');
select pg_temp.assert(pg_temp.sqlstate_of('select public.platform_set_tenant_status(''10000000-0000-0000-0000-000000000002'', ''suspended'', ''Not my tenant to suspend'')') = '42501', 'tenant admin cannot suspend a tenant');
reset role;

-- 2. Platform admin reads the overview with emails, but still no customer data.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*) from public.platform_tenant_overview()) = (select count(*) from public.tenants), 'overview lists every tenant');
select pg_temp.assert(
  (select 'dev-tenant-admin@example.test' = any(admin_emails) from public.platform_tenant_overview() where tenant_id = '10000000-0000-0000-0000-000000000004'),
  'overview shows the tenant admin email');
select pg_temp.assert(
  (select count(*) from public.platform_tenant_members('10000000-0000-0000-0000-000000000004') where email like '%@example.test') >= 2,
  'platform admin lists tenant members with emails');
select pg_temp.assert((select count(*) from public.customers) = 0, 'platform admin still reads no customers');
select pg_temp.assert((select count(*) from public.customer_assessments) = 0, 'platform admin still reads no assessments');

-- 3. Create tenant: validation, then success with an audited platform event.
select pg_temp.assert(pg_temp.sqlstate_of('select public.platform_create_tenant(''A'', ''ok-slug'', ''dev-outsider@example.test'')') = '22023', 'too-short company name rejected');
select pg_temp.assert(pg_temp.sqlstate_of('select public.platform_create_tenant(''Bad Slug Co'', ''Bad Slug'', ''dev-outsider@example.test'')') = '22023', 'invalid slug rejected');
select pg_temp.assert(pg_temp.sqlstate_of('select public.platform_create_tenant(''Ghost Co'', ''ghost-co'', ''nobody@example.test'')') = 'P0002', 'unknown admin email rejected');
select pg_temp.assert(pg_temp.sqlstate_of('select public.platform_create_tenant(''Self Co'', ''self-co'', ''dev-platform-admin@example.test'')') = '22023', 'platform admin cannot be made a company admin');
insert into t_ids select 'new_tenant', (public.platform_create_tenant('  Nordic Play Ltd.  ', 'Nordic-Play', 'DEV-OUTSIDER@example.test')).id;
select pg_temp.assert(
  (select name = 'Nordic Play Ltd.' and slug = 'nordic-play' and status = 'active' from public.tenants where id = (select id from t_ids where key = 'new_tenant')),
  'tenant created with trimmed name and lower-case slug');
select pg_temp.assert(
  (select count(*) from public.platform_tenant_members((select id from t_ids where key = 'new_tenant'))
     where email = 'dev-outsider@example.test' and role_key = 'tenant_admin' and status = 'active') = 1,
  'first admin is an active tenant admin');
select pg_temp.assert(pg_temp.sqlstate_of('select public.platform_create_tenant(''Nordic Again'', ''nordic-play'', ''dev-outsider@example.test'')') = '23505', 'duplicate slug rejected');
select pg_temp.assert(
  (select count(*) from public.audit_events where tenant_id is null and action = 'platform.tenant_created') = 1,
  'platform admin sees the platform-level creation event');

-- 4. Suspend / reactivate a tenant.
select pg_temp.assert(pg_temp.sqlstate_of(format('select public.platform_set_tenant_status(%L, %L, %L)', (select id from t_ids where key = 'new_tenant'), 'suspended', 'short')) = '22023', 'tenant suspension needs a reason');
select pg_temp.assert(pg_temp.sqlstate_of(format('select public.platform_set_tenant_status(%L, %L, %L)', (select id from t_ids where key = 'new_tenant'), 'removed', 'Not a supported status')) = '22023', 'unsupported tenant status rejected');
select public.platform_set_tenant_status((select id from t_ids where key = 'new_tenant'), 'suspended', 'Contract on hold pending KYC of the operator.');
select pg_temp.assert((select status = 'suspended' from public.tenants where id = (select id from t_ids where key = 'new_tenant')), 'tenant suspended');
select public.platform_set_tenant_status((select id from t_ids where key = 'new_tenant'), 'suspended', 'Repeat call should change nothing.');
select pg_temp.assert(
  (select count(*) from public.audit_events where tenant_id is null and action = 'platform.tenant_status_changed') = 1,
  'a no-op status call writes no extra event');
reset role;

-- The suspended tenant's admin loses tenant capabilities.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert(
  not public.has_capability((select id from t_ids where key = 'new_tenant'), 'tenant.view'),
  'admin of a suspended tenant loses its capabilities');
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select public.platform_set_tenant_status((select id from t_ids where key = 'new_tenant'), 'active', 'Operator KYC completed, contract resumed.');
select pg_temp.assert((select status = 'active' from public.tenants where id = (select id from t_ids where key = 'new_tenant')), 'tenant reactivated');

-- 5. Suspend / reactivate a member.
insert into t_ids select 'operator_membership', membership_id
  from public.platform_tenant_members('10000000-0000-0000-0000-000000000004') where email = 'dev-operator@example.test';
select pg_temp.assert(pg_temp.sqlstate_of(format('select public.platform_set_membership_status(%L, %L, %L)', (select id from t_ids where key = 'operator_membership'), 'suspended', 'short')) = '22023', 'member suspension needs a reason');
select public.platform_set_membership_status((select id from t_ids where key = 'operator_membership'), 'suspended', 'Account shared outside the company.');
select pg_temp.assert(
  (select status = 'suspended' from public.platform_tenant_members('10000000-0000-0000-0000-000000000004') where email = 'dev-operator@example.test'),
  'member suspended');
select public.platform_set_membership_status((select id from t_ids where key = 'operator_membership'), 'active', 'Credentials rotated, access restored.');
select pg_temp.assert(
  (select count(*) from public.audit_events where tenant_id is null and action = 'platform.membership_status_changed') = 2,
  'two platform-level membership events');
reset role;

select pg_temp.assert(
  (select count(*) from public.audit_events
     where tenant_id = '10000000-0000-0000-0000-000000000004' and action = 'membership.status_changed') = 2,
  'the tenant keeps its own membership trail');
select pg_temp.assert(
  (select count(*) from public.audit_events
     where tenant_id = (select id from t_ids where key = 'new_tenant') and action = 'tenant.status_changed') = 2,
  'the tenant keeps its own status trail');

do $$ begin raise notice 'Platform console verification completed successfully.'; end $$;

rollback;

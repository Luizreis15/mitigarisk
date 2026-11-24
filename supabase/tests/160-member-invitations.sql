-- Member invitation helpers: lookup, pending invitations, member directory.
-- Fixtures from supabase/seed.sql: tenant D = 1000...0004 with U2 tenant
-- admin and U4 operator; U3 risk analyst and U5 auditor exist but are not
-- in D; U6 outsider (admin of tenant 2 only); U1 platform admin.

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

-- 1. Only someone who manages members can look an email up.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select pg_temp.assert(pg_temp.sqlstate_of(
  'select public.find_user_for_invitation(''10000000-0000-0000-0000-000000000004'', ''dev-auditor@example.test'')') = '42501',
  'operator cannot look up invitees');
select pg_temp.assert(pg_temp.sqlstate_of(
  'select * from public.tenant_member_directory(''10000000-0000-0000-0000-000000000004'')') = '42501',
  'operator (no tenant.view) cannot read the member directory');
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(pg_temp.sqlstate_of(
  'select public.find_user_for_invitation(''10000000-0000-0000-0000-000000000004'', ''dev-auditor@example.test'')') = '42501',
  'platform admin has no bypass on the tenant lookup');
reset role;

-- 2. The tenant admin looks up, invites, and reads the directory.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(
  public.find_user_for_invitation('10000000-0000-0000-0000-000000000004', '  DEV-Auditor@Example.test ') = '00000000-0000-0000-0000-000000000005',
  'lookup is case- and space-insensitive');
select pg_temp.assert(
  public.find_user_for_invitation('10000000-0000-0000-0000-000000000004', 'nobody@example.test') is null,
  'unknown email returns null');
select pg_temp.assert(pg_temp.sqlstate_of(
  'select public.find_user_for_invitation(''10000000-0000-0000-0000-000000000004'', ''not-an-email'')') = '22023',
  'malformed email rejected');
select public.invite_member('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'auditor');
select pg_temp.assert(
  (select status = 'invited' and email = 'dev-auditor@example.test'
     from public.tenant_member_directory('10000000-0000-0000-0000-000000000004') where user_id = '00000000-0000-0000-0000-000000000005'),
  'directory shows the invitee as invited, with email');
select pg_temp.assert(
  (select status from public.tenant_member_directory('10000000-0000-0000-0000-000000000004') limit 1) = 'invited',
  'directory lists invitations first');
select pg_temp.assert(pg_temp.sqlstate_of(
  'select public.invite_member(''10000000-0000-0000-0000-000000000004'', ''00000000-0000-0000-0000-000000000005'', ''auditor'')') = '23505',
  'the same person cannot be invited twice');
reset role;

-- 3. The invitee sees only their own pending invitation, with the company name, and accepts it.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
select pg_temp.assert(
  (select count(*) from public.my_pending_invitations() where tenant_id = '10000000-0000-0000-0000-000000000004' and role_key = 'auditor'
     and tenant_name = 'EU Payments Demo Ltd.') = 1,
  'invitee sees the pending invitation with the company name');
select public.accept_invitation((select membership_id from public.my_pending_invitations() where tenant_id = '10000000-0000-0000-0000-000000000004'));
select pg_temp.assert(
  (select count(*) from public.my_pending_invitations() where tenant_id = '10000000-0000-0000-0000-000000000004') = 0,
  'an accepted invitation is no longer pending');
select pg_temp.assert(public.has_capability('10000000-0000-0000-0000-000000000004', 'audit.view'), 'accepted auditor gains audit.view');
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert((select count(*) from public.my_pending_invitations()) = 0, 'someone else sees no invitations');
select pg_temp.assert(pg_temp.sqlstate_of(
  'select * from public.tenant_member_directory(''10000000-0000-0000-0000-000000000004'')') = '42501',
  'outsider cannot read the member directory');
reset role;

select pg_temp.assert(
  (select count(*) from public.audit_events where tenant_id = '10000000-0000-0000-0000-000000000004'
     and action in ('membership.invited', 'membership.activated')
     and metadata ->> 'user_id' = '00000000-0000-0000-0000-000000000005') >= 1,
  'invitation audited');

do $$ begin raise notice 'Member invitation verification completed successfully.'; end $$;

rollback;

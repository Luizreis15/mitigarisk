-- TASK-006 verification: platform-admin tenant bootstrap, tenant-admin
-- invitations, self-service invite acceptance, admin-driven status changes,
-- and suspension-aware authorization — all through the atomic RPCs added in
-- 20260913090000_auth_tenant_bootstrap.sql.

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

-- Fixture ids from supabase/seed.sql, plus a fresh tenant this suite creates.
--   platform admin       = 00000000-0000-0000-0000-000000000001
--   tenant_admin (A)     = 00000000-0000-0000-0000-000000000002
--   operator (A)         = 00000000-0000-0000-0000-000000000004
--   auditor (A)          = 00000000-0000-0000-0000-000000000005
--   tenant_admin (B)     = 00000000-0000-0000-0000-000000000006
--   tenant A             = 10000000-0000-0000-0000-000000000001

-- 1. Only a platform admin can bootstrap a tenant -----------------------------

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
begin
  perform public.bootstrap_tenant('Forged Co', 'forged-co', '00000000-0000-0000-0000-000000000002');
  raise exception 'ASSERTION FAILED: a non-platform-admin must not bootstrap a tenant';
exception
  when sqlstate '42501' then
    raise notice 'ok - bootstrap_tenant rejects a non-platform-admin caller';
end;
$$;

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

do $$
declare
  v_tenant public.tenants;
  v_membership public.memberships;
begin
  v_tenant := public.bootstrap_tenant('Bootstrap Co', 'bootstrap-co', '00000000-0000-0000-0000-000000000004');

  perform pg_temp.assert(v_tenant.status = 'active', 'bootstrap_tenant creates an active tenant');

  select * into v_membership
  from public.memberships
  where tenant_id = v_tenant.id and user_id = '00000000-0000-0000-0000-000000000004';

  perform pg_temp.assert(
    v_membership.role_key = 'tenant_admin' and v_membership.status = 'active' and v_membership.invited_by is null,
    'bootstrap_tenant creates the first membership as an active, unattributed tenant_admin'
  );

  perform pg_temp.assert(
    exists (
      select 1 from public.audit_events
      where tenant_id = v_tenant.id and action = 'tenant.bootstrapped'
    ),
    'bootstrap_tenant records an audit event'
  );
end;
$$;

reset role;

-- 2. Tenant-admin invitations: capability-checked, cannot grant platform role,
--    and always attribute invited_by to the caller ---------------------------

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

do $$
begin
  perform public.invite_member(
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'operator'
  );
  raise exception 'ASSERTION FAILED: operator lacks tenant.manage_members and must not invite';
exception
  when insufficient_privilege then
    raise notice 'ok - invite_member rejects a caller without tenant.manage_members';
end;
$$;

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
begin
  perform public.invite_member(
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'platform_super_admin'
  );
  raise exception 'ASSERTION FAILED: invite_member must not grant platform_super_admin';
exception
  when sqlstate '23001' then
    raise notice 'ok - invite_member rejects platform_super_admin as a tenant role';
end;
$$;

do $$
declare
  v_membership public.memberships;
begin
  v_membership := public.invite_member(
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'operator'
  );
  perform pg_temp.assert(
    v_membership.status = 'invited' and v_membership.invited_by = '00000000-0000-0000-0000-000000000002',
    'invite_member creates an invited membership attributed to the caller'
  );
  perform pg_temp.assert(
    exists (
      select 1 from public.audit_events
      where target_type = 'membership' and target_id = v_membership.id::text and action = 'membership.invited'
    ),
    'invite_member records an audit event'
  );
end;
$$;

reset role;

-- 3. Invite acceptance is self-service and cannot smuggle a role change -----

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';

do $$
declare
  v_pending_id uuid;
begin
  select id into v_pending_id from public.memberships
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000006';

  perform public.accept_invitation(v_pending_id);
  raise exception 'ASSERTION FAILED: only the invited user may accept their own invitation';
exception
  when sqlstate 'P0002' then
    raise notice 'ok - accept_invitation rejects a caller who is not the invitee';
end;
$$;

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

do $$
declare
  v_pending_id uuid;
begin
  select id into v_pending_id from public.memberships
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000006';

  update public.memberships set status = 'active', role_key = 'tenant_admin' where id = v_pending_id;
  raise exception 'ASSERTION FAILED: self-accept must not also change the role';
exception
  when sqlstate '23001' then
    raise notice 'ok - self-accept cannot smuggle a role change alongside activation';
end;
$$;

do $$
declare
  v_membership public.memberships;
  v_pending_id uuid;
begin
  select id into v_pending_id from public.memberships
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000006';

  v_membership := public.accept_invitation(v_pending_id);

  perform pg_temp.assert(v_membership.status = 'active', 'accept_invitation activates the caller''s own membership');
end;
$$;

-- The invitee (operator) has no audit.view capability, so the row above is
-- correctly invisible to them via RLS; check it exists as tenant_admin, who
-- does have audit.view.
reset role;
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select pg_temp.assert(
  exists (
    select 1 from public.audit_events ae
    join public.memberships m
      on m.tenant_id = ae.tenant_id and m.user_id = '00000000-0000-0000-0000-000000000006'
    where ae.target_type = 'membership' and ae.target_id = m.id::text and ae.action = 'membership.activated'
  ),
  'accept_invitation records an audit event (visible to tenant_admin via audit.view)'
);

reset role;
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

-- Now active: has_capability should reflect it immediately.
select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000001', 'evaluation.run') = true,
  'the newly activated operator now has evaluation.run in tenant A'
);

-- A self-service actor cannot suspend or remove themselves, or anyone else:
-- once status is no longer 'invited', the self-service USING clause no
-- longer matches the row at all, so RLS silently affects zero rows rather
-- than raising (the same "denied by omission" shape as any other RLS miss).
do $$
declare
  v_own_id uuid;
  v_row_count int;
begin
  select id into v_own_id from public.memberships
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000006';

  update public.memberships set status = 'suspended' where id = v_own_id;
  get diagnostics v_row_count = row_count;

  perform pg_temp.assert(
    v_row_count = 0,
    'an active member cannot change their own membership status (RLS matches zero rows)'
  );
  perform pg_temp.assert(
    (select status from public.memberships where id = v_own_id) = 'active',
    'the membership status is unchanged after the denied self-suspend attempt'
  );
end;
$$;

reset role;

-- 4. Admin-driven status changes (suspend) are suspension-aware immediately -

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
declare
  v_target_id uuid;
  v_membership public.memberships;
begin
  select id into v_target_id from public.memberships
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000006';

  v_membership := public.set_membership_status(v_target_id, 'suspended');
  perform pg_temp.assert(v_membership.status = 'suspended', 'set_membership_status suspends the target membership');
  perform pg_temp.assert(
    exists (
      select 1 from public.audit_events
      where target_type = 'membership' and target_id = v_membership.id::text and action = 'membership.status_changed'
    ),
    'set_membership_status records an audit event'
  );
end;
$$;

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000001', 'evaluation.run') = false,
  'a suspended membership loses its capability immediately, with no separate revocation step'
);

reset role;

do $$
begin
  raise notice 'Auth and tenant bootstrap verification completed successfully.';
end;
$$;

rollback;

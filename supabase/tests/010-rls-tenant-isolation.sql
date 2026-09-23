-- RLS verification: authorized access, unauthenticated denial, cross-tenant
-- denial, least-privilege, and published-policy immutability.
--
-- Run in a single psql session, in order, after:
--   1. supabase/tests/000-local-auth-shim.sql
--   2. all files in supabase/migrations/
--   3. supabase/seed.sql
-- See supabase/tests/README.md for how to run this against a disposable
-- local cluster (no hosted project, no credentials).

\set ON_ERROR_STOP on

-- Everything below runs in one transaction that is rolled back at the end,
-- so this file can be re-run repeatedly without permanently mutating the
-- seeded fixtures (test 5 publishes a policy version as part of verifying
-- immutability).
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
--   tenant A = 10000000-0000-0000-0000-000000000001 (Fictional Fintech)
--   tenant B = 10000000-0000-0000-0000-000000000002 (Sample Payments)
--   tenant_admin (A)  = 00000000-0000-0000-0000-000000000002
--   risk_analyst (A)  = 00000000-0000-0000-0000-000000000003
--   auditor (A)       = 00000000-0000-0000-0000-000000000005
--   tenant_admin (B, outsider to A) = 00000000-0000-0000-0000-000000000006

-- 1. Unauthenticated (anon) denial: RLS hides every tenant-owned row --------
set role anon;
select pg_temp.assert(
  (select count(*) from public.tenants) = 0,
  'anon sees zero tenants (no SELECT policy applies to anon)'
);
select pg_temp.assert(
  (select count(*) from public.policy_versions) = 0,
  'anon sees zero policy versions'
);
reset role;

-- 2. Authorized access: tenant admin sees their own tenant and policy ------
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select pg_temp.assert(
  (select count(*) from public.tenants where id = '10000000-0000-0000-0000-000000000001') = 1,
  'tenant_admin (A) sees their own tenant'
);
select pg_temp.assert(
  (select count(*) from public.policy_versions
     where tenant_id = '10000000-0000-0000-0000-000000000001') = 1,
  'tenant_admin (A) with policy.view sees the draft policy version'
);

reset role;

-- 3. Cross-tenant denial: tenant B's admin cannot see or write tenant A ----
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

select pg_temp.assert(
  (select count(*) from public.tenants where id = '10000000-0000-0000-0000-000000000001') = 0,
  'tenant_admin (B) cannot see tenant A'
);
select pg_temp.assert(
  (select count(*) from public.policy_versions
     where tenant_id = '10000000-0000-0000-0000-000000000001') = 0,
  'tenant_admin (B) cannot see tenant A policy versions'
);

savepoint before_cross_tenant_insert;
do $$
begin
  insert into public.cases (tenant_id, opened_by)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006');
  raise exception 'ASSERTION FAILED: cross-tenant case insert should have been rejected by RLS';
exception
  when insufficient_privilege then
    raise notice 'ok - cross-tenant case insert into tenant A rejected by RLS (tenant_admin B has no membership in A)';
end;
$$;
rollback to savepoint before_cross_tenant_insert;

reset role;

-- 3b. public.* PostgREST-facing wrappers behave like their app.* originals.
-- These are the only entry points apps/web/lib/supabase/authorization.ts and
-- the audit RPC can reach through supabase-js .rpc(), since the app schema
-- is not exposed to PostgREST.
select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000001', 'tenant.view') = false,
  'public.has_capability wrapper denies tenant B admin on tenant A'
);

savepoint sp_wrong_tenant_audit_event;
do $$
begin
  perform public.record_audit_event(
    '10000000-0000-0000-0000-000000000001', 'test.action', 'test.target'
  );
  raise exception 'ASSERTION FAILED: record_audit_event should reject a non-member tenant_id';
exception
  when sqlstate '42501' then
    raise notice 'ok - public.record_audit_event rejects a tenant the caller does not belong to';
end;
$$;
rollback to savepoint sp_wrong_tenant_audit_event;

reset role;

-- 4. Least privilege: auditor (read-only) cannot manage members ------------
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';

select pg_temp.assert(
  (select count(*) from public.tenants where id = '10000000-0000-0000-0000-000000000001') = 1,
  'auditor (A) can still read their own tenant (tenant.view)'
);

select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000001', 'audit.view') = true,
  'public.has_capability wrapper grants auditor (A) audit.view on their own tenant'
);

-- TASK-029 D7: public.record_audit_event's EXECUTE grant to authenticated
-- is revoked (20260923100000_evidence_integrity_hardening.sql) -- audit
-- events are now written only from inside the security-definer business
-- RPCs, never by a direct client call, closing the TASK-028 review's
-- finding AU. This assertion's own target is the actor-stamping behavior
-- of record_audit_event itself (it always sets actor_id = auth.uid(),
-- never a caller-supplied value), which is unrelated to who may call it;
-- exercised here as the superuser connection the harness runs as (the same
-- role a hosted project's service_role plays), the one caller still able
-- to invoke it directly, so the assertion keeps testing what it always
-- tested. D7's actual "authenticated cannot call this at all" behavior is
-- covered directly in supabase/tests/080-evidence-integrity.sql.
reset role;
do $$
declare
  v_event_id uuid;
begin
  v_event_id := public.record_audit_event(
    '10000000-0000-0000-0000-000000000001', 'test.action', 'test.target', null, null, '{}'::jsonb
  );
  -- request.jwt.claim.sub is a session-local GUC, untouched by `reset
  -- role`, so auth.uid() here still resolves to the auditor's own id set
  -- above -- record_audit_event is itself security definer, which changes
  -- the effective role for privilege checks, not this GUC.
  perform pg_temp.assert(
    (select actor_id from public.audit_events where id = v_event_id) = auth.uid(),
    'public.record_audit_event stamps actor_id = auth.uid(), not a caller-supplied value'
  );
end;
$$;
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';

savepoint sp_auditor_membership_insert;
do $$
begin
  insert into public.memberships (tenant_id, user_id, role_key, status)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'operator', 'active');
  raise exception 'ASSERTION FAILED: auditor should not be able to add a member (lacks tenant.manage_members)';
exception
  when insufficient_privilege then
    raise notice 'ok - auditor cannot add a member (lacks tenant.manage_members)';
end;
$$;
rollback to savepoint sp_auditor_membership_insert;

reset role;

-- 5. Immutability: a published policy version cannot be mutated ------------
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

update public.policy_versions
set status = 'published', published_at = now(), published_by = auth.uid()
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select status from public.policy_versions where id = '20000000-0000-0000-0000-000000000001') = 'published',
  'tenant_admin (A) with policy.publish can publish the draft version'
);

savepoint before_publish_mutation;
do $$
begin
  update public.policy_versions set version_number = 99
  where id = '20000000-0000-0000-0000-000000000001';
  raise exception 'ASSERTION FAILED: a published policy version should be immutable';
exception
  when sqlstate '23001' then
    raise notice 'ok - published policy version rejects mutation (%)', sqlerrm;
end;
$$;
rollback to savepoint before_publish_mutation;

savepoint before_factor_mutation;
do $$
begin
  update public.policy_factors set weight = 0.99
  where policy_version_id = '20000000-0000-0000-0000-000000000001';
  raise exception 'ASSERTION FAILED: factors of a published version should be immutable';
exception
  when sqlstate '23001' then
    raise notice 'ok - published policy factors reject mutation (%)', sqlerrm;
end;
$$;
rollback to savepoint before_factor_mutation;

reset role;

do $$
begin
  raise notice 'RLS and immutability verification completed successfully.';
end;
$$;

rollback;

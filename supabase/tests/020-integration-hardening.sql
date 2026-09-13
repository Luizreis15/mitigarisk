-- Integration review regressions: English-first defaults, suspended-tenant
-- denial, cross-tenant reference integrity, immutable evidence, actor
-- provenance, and retained delivery history.

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

-- 1. English-first database defaults and market-neutral seed data ------------

select pg_temp.assert(
  (
    select position('en-US' in column_default) > 0
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_templates'
      and column_name = 'locale'
  ),
  'notification template locale defaults to en-US'
);

select pg_temp.assert(
  (
    select position('en-US' in column_default) > 0
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_requests'
      and column_name = 'locale'
  ),
  'notification request locale defaults to en-US'
);

select pg_temp.assert(
  (select name from public.tenants where id = '10000000-0000-0000-0000-000000000001') = 'Helix Commerce Ltd.',
  'development tenant data is market-neutral'
);

-- 2. A suspended tenant loses all tenant capabilities ------------------------

savepoint sp_tenant_suspension;
update public.tenants
set status = 'suspended'
where id = '10000000-0000-0000-0000-000000000001';

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select pg_temp.assert(
  public.has_capability('10000000-0000-0000-0000-000000000001', 'tenant.view') = false,
  'suspended tenant grants no tenant capability'
);

select pg_temp.assert(
  (select count(*) from public.tenants where id = '10000000-0000-0000-0000-000000000001') = 0,
  'suspended tenant is unavailable through tenant-member RLS'
);

reset role;
rollback to savepoint sp_tenant_suspension;

-- 3. Platform audit events cannot be forged by an ordinary tenant member ----

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';

do $$
begin
  perform public.record_audit_event(null, 'platform.fake', 'platform');
  raise exception 'ASSERTION FAILED: tenant member must not create a platform audit event';
exception
  when sqlstate '42501' then
    raise notice 'ok - tenant member cannot create a platform audit event';
end;
$$;

reset role;

-- 4. Published-policy linkage, evidence identity, and actor provenance --------

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
begin
  insert into public.evaluations (
    id, tenant_id, policy_version_id, subject_reference, input_hash,
    normalized_input, correlation_id, actor_id, actor_type
  ) values (
    '30000000-0000-0000-0000-000000000099',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'draft-policy-attempt', 'hash-draft', '{}'::jsonb,
    '40000000-0000-0000-0000-000000000099',
    auth.uid(), 'user'
  );
  raise exception 'ASSERTION FAILED: evaluation against a draft policy must fail';
exception
  when sqlstate '23001' then
    raise notice 'ok - evaluation against a draft policy is rejected';
end;
$$;

update public.policy_versions
set status = 'published', published_at = now(), published_by = auth.uid()
where id = '20000000-0000-0000-0000-000000000001';

insert into public.policy_versions (
  id, tenant_id, version_number, status, created_by
) values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  2, 'draft', auth.uid()
);

do $$
begin
  update public.policy_factors
  set policy_version_id = '20000000-0000-0000-0000-000000000003'
  where policy_version_id = '20000000-0000-0000-0000-000000000001';
  raise exception 'ASSERTION FAILED: published factor must not be moved to a draft policy';
exception
  when sqlstate '23001' then
    raise notice 'ok - published factor cannot be reparented to bypass immutability';
end;
$$;

insert into public.evaluations (
  id, tenant_id, policy_version_id, subject_reference, input_hash,
  normalized_input, correlation_id, actor_id, actor_type
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'subject-a', 'hash-a', '{"source":"test"}'::jsonb,
    '40000000-0000-0000-0000-000000000001',
    auth.uid(), 'user'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'subject-b', 'hash-b', '{"source":"test"}'::jsonb,
    '40000000-0000-0000-0000-000000000002',
    auth.uid(), 'user'
  );

insert into public.evaluation_reason_codes (
  id, tenant_id, evaluation_id, code, description
) values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'DOC_MISMATCH', 'Document mismatch'
);

update public.evaluations
set status = 'completed', score = 81, decision_band = 'review', completed_at = now()
where id = '30000000-0000-0000-0000-000000000001';

do $$
begin
  update public.evaluation_reason_codes
  set evaluation_id = '30000000-0000-0000-0000-000000000002'
  where id = '50000000-0000-0000-0000-000000000001';
  raise exception 'ASSERTION FAILED: terminal evaluation reason code must not be reparented';
exception
  when sqlstate '23001' then
    raise notice 'ok - terminal evaluation reason code cannot be reparented';
end;
$$;

do $$
begin
  update public.evaluations
  set normalized_input = '{"source":"rewritten"}'::jsonb
  where id = '30000000-0000-0000-0000-000000000002';
  raise exception 'ASSERTION FAILED: pending evaluation input evidence must not be rewritten';
exception
  when sqlstate '23001' then
    raise notice 'ok - pending evaluation input evidence cannot be rewritten';
end;
$$;

do $$
begin
  insert into public.evaluations (
    tenant_id, policy_version_id, subject_reference, input_hash,
    normalized_input, correlation_id, actor_id, actor_type
  ) values (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'forged-actor', 'hash-forged', '{}'::jsonb,
    '40000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000006', 'user'
  );
  raise exception 'ASSERTION FAILED: authenticated actor provenance must not be forged';
exception
  when insufficient_privilege then
    raise notice 'ok - evaluation actor provenance is enforced by RLS';
end;
$$;

reset role;

-- Build a valid tenant-B policy, then prove tenant A cannot reference it.
set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

insert into public.policy_versions (
  id, tenant_id, version_number, status, created_by
) values (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  1, 'draft', auth.uid()
);

update public.policy_versions
set status = 'published', published_at = now(), published_by = auth.uid()
where id = '20000000-0000-0000-0000-000000000002';

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

do $$
begin
  insert into public.evaluations (
    tenant_id, policy_version_id, subject_reference, input_hash,
    normalized_input, correlation_id, actor_id, actor_type
  ) values (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'cross-tenant-policy', 'hash-cross', '{}'::jsonb,
    '40000000-0000-0000-0000-000000000004',
    auth.uid(), 'user'
  );
  raise exception 'ASSERTION FAILED: cross-tenant policy reference must fail';
exception
  when sqlstate '23001' then
    raise notice 'ok - evaluation cannot reference another tenant policy';
end;
$$;

insert into public.cases (
  id, tenant_id, evaluation_id, status, opened_by
) values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'waiting_evidence', auth.uid()
);

select pg_temp.assert(
  (select status from public.cases where id = '60000000-0000-0000-0000-000000000001') = 'waiting_evidence',
  'backend case status supports the English-first operator workflow'
);

reset role;

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';

do $$
begin
  insert into public.cases (
    tenant_id, evaluation_id, status, opened_by
  ) values (
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'open', auth.uid()
  );
  raise exception 'ASSERTION FAILED: cross-tenant evaluation reference must fail';
exception
  when foreign_key_violation then
    raise notice 'ok - case cannot reference another tenant evaluation';
end;
$$;

reset role;

-- 5. No client-side deletion or delivery-history rewriting -------------------

set role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

insert into public.api_clients (
  id, tenant_id, name, key_id, key_hash, created_by
) values (
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Integration test client', 'key_test_1', 'hash-only', auth.uid()
);

insert into public.webhook_endpoints (
  id, tenant_id, url, secret_hash, created_by
) values (
  '71000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'https://example.test/webhook', 'hash-only', auth.uid()
);

insert into public.webhook_deliveries (
  id, tenant_id, endpoint_id, event_type, payload, idempotency_key
) values (
  '72000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  'evaluation.completed', '{}'::jsonb, 'delivery-test-1'
);

insert into public.notification_templates (
  id, tenant_id, key, subject, body, created_by
) values (
  '73000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'case.assigned', 'Case assigned', 'A case was assigned.', auth.uid()
);

insert into public.notification_requests (
  id, tenant_id, template_key, recipient, correlation_id, idempotency_key
) values (
  '74000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'case.assigned', 'person@example.test',
  '40000000-0000-0000-0000-000000000005', 'notification-test-1'
);

delete from public.api_clients
where id = '70000000-0000-0000-0000-000000000001';
delete from public.webhook_endpoints
where id = '71000000-0000-0000-0000-000000000001';
delete from public.notification_templates
where id = '73000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select count(*) from public.api_clients where id = '70000000-0000-0000-0000-000000000001') = 1,
  'API client cannot be deleted by an authenticated manager'
);
select pg_temp.assert(
  (select count(*) from public.webhook_endpoints where id = '71000000-0000-0000-0000-000000000001') = 1,
  'webhook endpoint and delivery history cannot be deleted by an authenticated manager'
);
select pg_temp.assert(
  (select count(*) from public.notification_templates where id = '73000000-0000-0000-0000-000000000001') = 1,
  'notification template cannot be deleted by an authenticated manager'
);

update public.webhook_deliveries
set payload = '{"rewritten":true}'::jsonb, status = 'delivered'
where id = '72000000-0000-0000-0000-000000000001';

update public.notification_requests
set recipient = 'rewritten@example.test', status = 'sent'
where id = '74000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select status from public.webhook_deliveries where id = '72000000-0000-0000-0000-000000000001') = 'pending',
  'authenticated manager cannot rewrite webhook delivery state or payload'
);
select pg_temp.assert(
  (
    select status = 'pending' and recipient = 'person@example.test'
    from public.notification_requests
    where id = '74000000-0000-0000-0000-000000000001'
  ),
  'authenticated manager cannot rewrite notification delivery evidence'
);
select pg_temp.assert(
  (
    select locale = 'en-US'
    from public.notification_requests
    where id = '74000000-0000-0000-0000-000000000001'
  ),
  'new notification request inherits the en-US default'
);

do $$
begin
  insert into public.memberships (tenant_id, user_id, role_key, status)
  values (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000006',
    'platform_super_admin', 'active'
  );
  raise exception 'ASSERTION FAILED: platform role must not be assigned as tenant membership';
exception
  when check_violation then
    raise notice 'ok - platform admin role cannot be forged through tenant membership';
end;
$$;

reset role;

do $$
begin
  raise notice 'Integration hardening verification completed successfully.';
end;
$$;

rollback;

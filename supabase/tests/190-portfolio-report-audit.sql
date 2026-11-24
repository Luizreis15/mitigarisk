-- public.record_portfolio_report_generated(): audit.view only, digest and
-- count only. Fixtures: tenant D = 1000...0004; U2 tenant_admin (audit.view);
-- U4 operator (no audit.view); U6 outsider; U1 platform admin.

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
grant execute on function pg_temp.raises(text, text) to authenticated, anon;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('a', 64), 3);
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', 'not-a-digest', 3)$q$, '22023'), 'a malformed digest is refused');
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('A', 64), 3)$q$, '22023'), 'an upper-case digest is refused');
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('a', 64), -1)$q$, '22023'), 'a negative count is refused');
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('a', 64), null)$q$, '22023'), 'a missing count is refused');
reset role;

select pg_temp.assert(
  (select count(*) from public.audit_events
    where action = 'portfolio.report_generated' and tenant_id = '10000000-0000-0000-0000-000000000004'
      and actor_id = '00000000-0000-0000-0000-000000000002' and target_type = 'tenant'
      and metadata = jsonb_build_object('sha256', repeat('a', 64), 'customers', 3)) = 1,
  'the MLRO generation is recorded once, with digest and count only');

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('b', 64), 3)$q$, '42501'), 'an operator (no audit.view) cannot record a report');
reset role;
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('b', 64), 3)$q$, '42501'), 'an outsider cannot record a report');
reset role;
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('b', 64), 3)$q$, '42501'), 'a platform admin cannot record a report');
reset role;
set role anon;
select pg_temp.assert(pg_temp.raises($q$select public.record_portfolio_report_generated('10000000-0000-0000-0000-000000000004', repeat('b', 64), 3)$q$, '42501'), 'anon cannot execute it');
reset role;

select pg_temp.assert(
  (select count(*) from public.audit_events where action = 'portfolio.report_generated') = 1,
  'refused calls record nothing');

do $$ begin raise notice 'Portfolio report audit verification completed successfully.'; end $$;

rollback;

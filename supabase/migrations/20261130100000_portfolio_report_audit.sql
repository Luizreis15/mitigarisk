-- Portfolio report: records that a consolidated report of the tenant's
-- customers was generated, with the SHA-256 of its JSON content, so an
-- exported file can be checked against the audit trail later.
--
-- Mirrors public.record_audit_pack_generated()
-- (20261126100000_action_completions_and_audit_pack.sql): audit.view as an
-- active member (auditor, analyst, MLRO; no platform-admin bypass). The
-- event carries the digest and the row count only, never customer data.

create or replace function public.record_portfolio_report_generated(
  p_tenant_id uuid,
  p_sha256 text,
  p_customer_count integer
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'audit.view') then
    raise exception 'Missing audit.view capability for tenant %', p_tenant_id using errcode = '42501';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 hex digest is required' using errcode = '22023';
  end if;
  if p_customer_count is null or p_customer_count < 0 then
    raise exception 'A non-negative customer count is required' using errcode = '22023';
  end if;

  return public.record_audit_event(
    p_tenant_id, 'portfolio.report_generated', 'tenant', p_tenant_id::text, null,
    jsonb_build_object('sha256', p_sha256, 'customers', p_customer_count)
  );
end;
$$;

comment on function public.record_portfolio_report_generated(uuid, text, integer) is
  'Records the generation of a portfolio report (audit.view, active member): SHA-256 of the JSON content and the customer count only.';

revoke all on function public.record_portfolio_report_generated(uuid, text, integer) from public;
grant execute on function public.record_portfolio_report_generated(uuid, text, integer) to authenticated;

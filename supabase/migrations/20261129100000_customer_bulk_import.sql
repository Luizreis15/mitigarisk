-- Bulk customer import: one round trip for a whole file.
--
-- public.import_customers() is a thin loop over public.create_customer(),
-- so every rule of the single-customer path still applies to every row:
-- customer.manage checked as an active member (no platform-admin bypass),
-- created_by pinned to auth.uid(), one 'customer.created' audit event per
-- new customer, idempotent on (tenant_id, external_reference).
--
-- Each row is isolated in its own sub-transaction. A row that conflicts
-- with an existing reference, or that a table constraint refuses, is
-- reported back and never stops the rows around it. Re-sending the same
-- file is safe: rows already registered with the same data are counted as
-- unchanged.
--
-- Input: a JSON array (1-500 items) of objects with the keys
--   line, external_reference, full_name, date_of_birth (YYYY-MM-DD),
--   country_of_birth, nationality, residence_country, onboarding_channel.
-- Output: {"created": n, "unchanged": n,
--          "conflicts": [{"line", "external_reference"}],
--          "rejected":  [{"line", "external_reference"}]}

create or replace function public.import_customers(
  p_tenant_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_reference text;
  v_line integer;
  v_existed boolean;
  v_created integer := 0;
  v_unchanged integer := 0;
  v_conflicts jsonb := '[]'::jsonb;
  v_rejected jsonb := '[]'::jsonb;
  v_count integer;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'customer.manage') then
    raise exception 'Missing customer.manage capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Customer import rows must be a JSON array' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 500 then
    raise exception 'A customer import must carry between 1 and 500 rows' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_reference := left(coalesce(v_row ->> 'external_reference', ''), 100);
    v_line := case when (v_row ->> 'line') ~ '^[0-9]{1,6}$' then (v_row ->> 'line')::integer else null end;
    begin
      select exists (
        select 1 from public.customers
        where tenant_id = p_tenant_id and external_reference = v_row ->> 'external_reference'
      ) into v_existed;

      perform public.create_customer(
        p_tenant_id,
        v_row ->> 'external_reference',
        v_row ->> 'full_name',
        (v_row ->> 'date_of_birth')::date,
        v_row ->> 'country_of_birth',
        v_row ->> 'nationality',
        v_row ->> 'residence_country',
        v_row ->> 'onboarding_channel'
      );

      if v_existed then
        v_unchanged := v_unchanged + 1;
      else
        v_created := v_created + 1;
      end if;
    exception
      when unique_violation then
        v_conflicts := v_conflicts || jsonb_build_object('line', v_line, 'external_reference', v_reference);
      when check_violation or not_null_violation or data_exception then
        v_rejected := v_rejected || jsonb_build_object('line', v_line, 'external_reference', v_reference);
    end;
  end loop;

  perform public.record_audit_event(
    p_tenant_id, 'customer.import_completed', 'tenant', p_tenant_id::text, null,
    jsonb_build_object(
      'rows', v_count,
      'created', v_created,
      'unchanged', v_unchanged,
      'conflicts', jsonb_array_length(v_conflicts),
      'rejected', jsonb_array_length(v_rejected)
    )
  );

  return jsonb_build_object(
    'created', v_created,
    'unchanged', v_unchanged,
    'conflicts', v_conflicts,
    'rejected', v_rejected
  );
end;
$$;

comment on function public.import_customers(uuid, jsonb) is
  'Bulk customer import (1-500 rows): loops public.create_customer() with one sub-transaction per row, so capability, provenance, per-customer audit and idempotency are unchanged; reports conflicts and rejected rows instead of failing the batch, and records one customer.import_completed audit event.';

revoke all on function public.import_customers(uuid, jsonb) from public;
grant execute on function public.import_customers(uuid, jsonb) to authenticated;

-- 1. Required-action completions: the operator records that a required
--    action (from a CRA assessment or a transaction check) was done, with an
--    evidence note. Immutable; one completion per action per source.
-- 2. Audit pack generation is itself audited (who generated which pack,
--    with the SHA-256 of its content).

create table public.customer_action_completions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  source_type text not null check (source_type in ('assessment', 'transaction_check')),
  source_id uuid not null,
  action_code text not null check (action_code ~ '^[A-Z0-9_]{3,64}$'),
  evidence_note text not null check (evidence_note = btrim(evidence_note) and char_length(evidence_note) between 5 and 500),
  correlation_id uuid not null,
  completed_by uuid not null references auth.users (id),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (customer_id, tenant_id) references public.customers (id, tenant_id),
  unique (tenant_id, source_type, source_id, action_code),
  unique (tenant_id, correlation_id)
);

create index idx_customer_action_completions_customer on public.customer_action_completions (tenant_id, customer_id);

create trigger trg_customer_action_completions_append_only
  before update or delete on public.customer_action_completions
  for each row execute function app.forbid_mutation();

alter table public.customer_action_completions enable row level security;

create policy customer_action_completions_select on public.customer_action_completions
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'customer.view')
  );

revoke insert, update, delete on public.customer_action_completions from authenticated, anon;
grant select on public.customer_action_completions to authenticated;

create or replace function public.record_action_completion(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_action_code text,
  p_evidence_note text,
  p_correlation_id uuid
) returns public.customer_action_completions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note text := btrim(coalesce(p_evidence_note, ''));
  v_actions jsonb;
  v_existing public.customer_action_completions;
  v_row public.customer_action_completions;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'customer.manage') then
    raise exception 'Missing customer.manage capability for tenant %', p_tenant_id using errcode = '42501';
  end if;
  if p_correlation_id is null then
    raise exception 'A correlation identifier is required' using errcode = '22023';
  end if;
  if char_length(v_note) not between 5 and 500 then
    raise exception 'An evidence note of 5 to 500 characters is required' using errcode = '22023';
  end if;

  if p_source_type = 'assessment' then
    select result -> 'required_actions' into v_actions
    from public.customer_assessments
    where id = p_source_id and tenant_id = p_tenant_id and customer_id = p_customer_id;
  elsif p_source_type = 'transaction_check' then
    select result -> 'actions' into v_actions
    from public.customer_transaction_checks
    where id = p_source_id and tenant_id = p_tenant_id and customer_id = p_customer_id;
  else
    raise exception 'Unknown source type' using errcode = '22023';
  end if;
  if v_actions is null then
    raise exception 'Source not found for this customer' using errcode = 'P0002';
  end if;
  if not (v_actions ? p_action_code) then
    raise exception 'This action is not required by the source' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_source_id::text || ':' || p_action_code, 0));

  select * into v_existing from public.customer_action_completions
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;
  if found then
    if v_existing.source_id = p_source_id and v_existing.action_code = p_action_code and v_existing.evidence_note = v_note then
      return v_existing;
    end if;
    raise exception 'Correlation identifier conflicts with an existing completion' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.customer_action_completions
    where tenant_id = p_tenant_id and source_type = p_source_type and source_id = p_source_id and action_code = p_action_code
  ) then
    raise exception 'This action is already recorded as done' using errcode = '23505';
  end if;

  insert into public.customer_action_completions (
    tenant_id, customer_id, source_type, source_id, action_code, evidence_note, correlation_id, completed_by
  ) values (
    p_tenant_id, p_customer_id, p_source_type, p_source_id, p_action_code, v_note, p_correlation_id, auth.uid()
  ) returning * into v_row;

  perform public.record_audit_event(
    p_tenant_id, 'customer.action_completed', 'customer_action_completion', v_row.id::text, p_correlation_id,
    jsonb_build_object('customer_id', p_customer_id, 'source_type', p_source_type, 'source_id', p_source_id,
                       'action_code', p_action_code)
  );

  return v_row;
end;
$$;

revoke all on function public.record_action_completion(uuid, uuid, text, uuid, text, text, uuid) from public;
grant execute on function public.record_action_completion(uuid, uuid, text, uuid, text, text, uuid) to authenticated;

-- 2. Audit pack generation event ---------------------------------------------

create or replace function public.record_audit_pack_generated(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_sha256 text
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
  if not exists (select 1 from public.customers where id = p_customer_id and tenant_id = p_tenant_id) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  return public.record_audit_event(
    p_tenant_id, 'customer.audit_pack_generated', 'customer', p_customer_id::text, null,
    jsonb_build_object('customer_id', p_customer_id, 'sha256', p_sha256)
  );
end;
$$;

revoke all on function public.record_audit_pack_generated(uuid, uuid, text) from public;
grant execute on function public.record_audit_pack_generated(uuid, uuid, text) to authenticated;

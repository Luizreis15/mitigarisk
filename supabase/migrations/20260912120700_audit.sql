-- TASK-002: audit bounded context.
-- Audit events are append-only and cannot be inserted directly by client
-- roles: the only path in is public.record_audit_event(), a security-definer
-- function that stamps actor_id = auth.uid() itself (so a caller cannot
-- forge another actor) and checks tenant membership before writing.
-- Server-side services (running as service_role, which bypasses RLS) may
-- still insert directly for actor_type = 'service'/'system' events.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id),
  actor_id uuid references auth.users (id),
  actor_type text not null default 'user' check (actor_type in ('user', 'service', 'system')),
  action text not null,
  target_type text not null,
  target_id text,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_tenant_id on public.audit_events (tenant_id);
create index if not exists idx_audit_events_correlation_id on public.audit_events (correlation_id);
create index if not exists idx_audit_events_occurred_at on public.audit_events (occurred_at);

create trigger trg_audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function app.forbid_mutation();

create or replace function public.record_audit_event(
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_correlation_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_tenant_id is not null
     and not app.is_platform_admin()
     and not exists (
       select 1 from public.memberships m
       where m.tenant_id = p_tenant_id and m.user_id = auth.uid() and m.status = 'active'
     )
  then
    raise exception 'Not an active member of tenant %', p_tenant_id using errcode = '42501';
  end if;

  insert into public.audit_events (
    tenant_id, actor_id, actor_type, action, target_type, target_id, correlation_id, metadata
  ) values (
    p_tenant_id, auth.uid(), 'user', p_action, p_target_type, p_target_id, p_correlation_id, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_audit_event(uuid, text, text, text, uuid, jsonb) is
  'Only client-facing path to write an audit event. Stamps actor_id = auth.uid() itself so callers cannot forge attribution.';

revoke all on function public.record_audit_event(uuid, text, text, text, uuid, jsonb) from public;
grant execute on function public.record_audit_event(uuid, text, text, text, uuid, jsonb) to authenticated;

-- Row level security ----------------------------------------------------------

alter table public.audit_events enable row level security;

create policy audit_events_select on public.audit_events
  for select to authenticated using (
    app.is_platform_admin() or (tenant_id is not null and app.has_capability(tenant_id, 'audit.view'))
  );

-- Intentionally no insert/update/delete policy for authenticated/anon: all
-- client writes go through public.record_audit_event(); direct table writes are
-- reserved for service_role (which bypasses RLS) for service/system events.

-- Rollback: drop function public.record_audit_event(uuid, text, text, text, uuid,
-- jsonb); drop the policy and table above. No data migration is required
-- because this migration only ever creates objects.

-- Integration hardening for TASK-002 after English-first and security review.
-- This migration is intentionally forward-only. It tightens tenant linkage,
-- provenance, retention, and lifecycle rules without touching a hosted project.

-- English-first defaults ------------------------------------------------------

alter table public.notification_templates
  alter column locale set default 'en-US';

alter table public.notification_requests
  alter column locale set default 'en-US';

-- A regular UNIQUE constraint treats NULL tenant_id values as distinct.
-- Separate indexes guarantee one platform template and one tenant template
-- for each (key, locale) pair.
create unique index if not exists uq_notification_templates_platform_key_locale
  on public.notification_templates (key, locale)
  where tenant_id is null;

create unique index if not exists uq_notification_templates_tenant_key_locale
  on public.notification_templates (tenant_id, key, locale)
  where tenant_id is not null;

-- Tenant state and role scope -------------------------------------------------

alter table public.memberships
  add constraint memberships_role_is_tenant_scoped
  check (role_key <> 'platform_super_admin');

create or replace function app.current_tenant_ids()
returns setof uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select m.tenant_id
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and t.status = 'active';
$$;

create or replace function app.has_capability(p_tenant_id uuid, p_capability text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    app.is_platform_admin()
    or exists (
      select 1
      from public.memberships m
      join public.tenants t on t.id = m.tenant_id
      join public.role_capabilities rc on rc.role_key = m.role_key
      where m.tenant_id = p_tenant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and t.status = 'active'
        and rc.capability_key = p_capability
    );
$$;

-- Cross-tenant references and lifecycle integrity ----------------------------

alter table public.evaluations
  drop constraint evaluations_policy_version_id_fkey,
  add constraint evaluations_policy_version_tenant_fkey
    foreign key (policy_version_id, tenant_id)
    references public.policy_versions (id, tenant_id);

alter table public.cases
  drop constraint cases_evaluation_id_fkey,
  add constraint cases_evaluation_tenant_fkey
    foreign key (evaluation_id, tenant_id)
    references public.evaluations (id, tenant_id);

alter table public.cases
  drop constraint cases_status_check,
  add constraint cases_status_check
    check (status in ('open', 'in_review', 'waiting_evidence', 'escalated', 'closed'));

alter table public.policy_versions
  add constraint policy_versions_publication_provenance
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or
    (status in ('published', 'archived') and published_at is not null and published_by is not null)
  );

create or replace function app.forbid_children_when_not_draft()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  if tg_op <> 'INSERT' then
    select status into v_status
    from public.policy_versions
    where id = old.policy_version_id and tenant_id = old.tenant_id;

    if v_status is distinct from 'draft' then
      raise exception 'Cannot modify % once the original policy version is not draft', tg_table_name
        using errcode = '23001';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    select status into v_status
    from public.policy_versions
    where id = new.policy_version_id and tenant_id = new.tenant_id;

    if v_status is distinct from 'draft' then
      raise exception 'Cannot attach % to a policy version that is not draft', tg_table_name
        using errcode = '23001';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function app.enforce_evaluation_policy_and_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy_status text;
begin
  select status into v_policy_status
  from public.policy_versions
  where id = new.policy_version_id and tenant_id = new.tenant_id;

  if tg_op = 'INSERT' and v_policy_status is distinct from 'published' then
    raise exception 'Evaluation policy must be published for the same tenant'
      using errcode = '23001';
  end if;

  if tg_op = 'UPDATE' and v_policy_status not in ('published', 'archived') then
    raise exception 'Evaluation policy must remain published or archived'
      using errcode = '23001';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.tenant_id is distinct from old.tenant_id
    or new.policy_version_id is distinct from old.policy_version_id
    or new.subject_reference is distinct from old.subject_reference
    or new.input_hash is distinct from old.input_hash
    or new.normalized_input is distinct from old.normalized_input
    or new.correlation_id is distinct from old.correlation_id
    or new.actor_id is distinct from old.actor_id
    or new.actor_type is distinct from old.actor_type
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Evaluation identity and input evidence cannot be changed'
      using errcode = '23001';
  end if;

  return new;
end;
$$;

create trigger trg_evaluations_policy_and_identity
  before insert or update on public.evaluations
  for each row execute function app.enforce_evaluation_policy_and_identity();

create or replace function app.forbid_completed_evaluation_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Evaluation % is append-only', old.id using errcode = '23001';
  end if;

  if old.status in ('completed', 'failed') then
    raise exception 'Evaluation % is immutable once %', old.id, old.status using errcode = '23001';
  end if;

  return new;
end;
$$;

create or replace function app.forbid_reason_code_mutation_after_completion()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.tenant_id is distinct from old.tenant_id
    or new.evaluation_id is distinct from old.evaluation_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Reason-code identity cannot be changed'
      using errcode = '23001';
  end if;

  if tg_op <> 'INSERT' then
    select status into v_status
    from public.evaluations
    where id = old.evaluation_id and tenant_id = old.tenant_id;

    if v_status in ('completed', 'failed') then
      raise exception 'Cannot modify reason codes once evaluation % is %', old.evaluation_id, v_status
        using errcode = '23001';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    select status into v_status
    from public.evaluations
    where id = new.evaluation_id and tenant_id = new.tenant_id;

    if v_status in ('completed', 'failed') then
      raise exception 'Cannot attach reason codes once evaluation % is %', new.evaluation_id, v_status
        using errcode = '23001';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function app.guard_case_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.evaluation_id is distinct from old.evaluation_id
     or new.opened_by is distinct from old.opened_by
     or new.opened_at is distinct from old.opened_at
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Case identity and provenance cannot be changed'
      using errcode = '23001';
  end if;
  return new;
end;
$$;

create trigger trg_cases_identity_guard
  before update on public.cases
  for each row execute function app.guard_case_identity();

-- Actor provenance for authenticated writes ----------------------------------

drop policy evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
    and actor_type = 'user'
    and actor_id = auth.uid()
  );

drop policy evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
  with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
    and actor_type = 'user'
    and actor_id = auth.uid()
  );

drop policy cases_insert on public.cases;
create policy cases_insert on public.cases
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'case.manage'))
    and opened_by = auth.uid()
  );

drop policy case_evidence_insert on public.case_evidence;
create policy case_evidence_insert on public.case_evidence
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'case.manage'))
    and uploaded_by = auth.uid()
  );

drop policy case_decisions_insert on public.case_decisions;
create policy case_decisions_insert on public.case_decisions
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'case.decide'))
    and decided_by = auth.uid()
  );

-- Retention and worker-only delivery state -----------------------------------

drop policy api_clients_write on public.api_clients;
create policy api_clients_insert on public.api_clients
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'))
    and created_by = auth.uid()
  );
create policy api_clients_update on public.api_clients
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'));

drop policy webhook_endpoints_write on public.webhook_endpoints;
create policy webhook_endpoints_insert on public.webhook_endpoints
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'))
    and created_by = auth.uid()
  );
create policy webhook_endpoints_update on public.webhook_endpoints
  for update to authenticated
  using (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'))
  with check (app.is_platform_admin() or app.has_capability(tenant_id, 'integration.manage'));

drop policy webhook_deliveries_update on public.webhook_deliveries;

drop policy notification_templates_write on public.notification_templates;
create policy notification_templates_insert on public.notification_templates
  for insert to authenticated with check (
    (
      (tenant_id is null and app.is_platform_admin())
      or (tenant_id is not null and app.has_capability(tenant_id, 'notification.manage'))
    )
    and created_by = auth.uid()
  );
create policy notification_templates_update on public.notification_templates
  for update to authenticated
  using (
    (tenant_id is null and app.is_platform_admin())
    or (tenant_id is not null and app.has_capability(tenant_id, 'notification.manage'))
  )
  with check (
    (tenant_id is null and app.is_platform_admin())
    or (tenant_id is not null and app.has_capability(tenant_id, 'notification.manage'))
  );

drop policy notification_requests_insert on public.notification_requests;
create policy notification_requests_insert on public.notification_requests
  for insert to authenticated with check (
    app.is_platform_admin() or app.has_capability(tenant_id, 'notification.manage')
  );

drop policy notification_requests_update on public.notification_requests;

create or replace function app.guard_webhook_delivery_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Webhook delivery history is append-only' using errcode = '23001';
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.endpoint_id is distinct from old.endpoint_id
     or new.event_type is distinct from old.event_type
     or new.payload is distinct from old.payload
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Webhook delivery evidence cannot be rewritten'
      using errcode = '23001';
  end if;
  return new;
end;
$$;

create trigger trg_webhook_deliveries_history_guard
  before update or delete on public.webhook_deliveries
  for each row execute function app.guard_webhook_delivery_history();

create or replace function app.guard_notification_request_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Notification request history is append-only' using errcode = '23001';
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.template_key is distinct from old.template_key
     or new.locale is distinct from old.locale
     or new.recipient is distinct from old.recipient
     or new.payload is distinct from old.payload
     or new.correlation_id is distinct from old.correlation_id
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Notification request evidence cannot be rewritten'
      using errcode = '23001';
  end if;
  return new;
end;
$$;

create trigger trg_notification_requests_history_guard
  before update or delete on public.notification_requests
  for each row execute function app.guard_notification_request_history();

-- Platform audit events require platform authority ---------------------------

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
  if p_tenant_id is null and not app.is_platform_admin() then
    raise exception 'Platform audit events require platform administrator access'
      using errcode = '42501';
  end if;

  if p_tenant_id is not null
     and not app.is_platform_admin()
     and not exists (
       select 1
       from public.memberships m
       join public.tenants t on t.id = m.tenant_id
       where m.tenant_id = p_tenant_id
         and m.user_id = auth.uid()
         and m.status = 'active'
         and t.status = 'active'
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

-- Rollback: restore the policies/functions from migrations 20150-20700,
-- remove the added constraints/indexes/triggers, and restore the prior locale
-- defaults. This migration has not been applied to a hosted environment.

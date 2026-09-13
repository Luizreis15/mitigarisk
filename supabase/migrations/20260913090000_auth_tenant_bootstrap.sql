-- TASK-006: authentication and tenant bootstrap foundation.
--
-- Closes a real gap in the existing membership model: app.has_capability()
-- requires an *active* membership, so an invited user has no capability at
-- all and could never accept their own invitation under the RLS policies
-- from 20260912120160. This migration adds a narrow self-accept path plus
-- provenance/transition guards, and wraps the multi-step bootstrap/invite/
-- accept/status-change flows in atomic, capability-checked, audited RPCs so
-- application code (apps/web/lib/supabase/**) never has to choreograph
-- multiple client calls to get one auditable outcome.

-- Membership write provenance ------------------------------------------------
-- invited_by must be either null (a platform admin bootstrapping a tenant's
-- first membership directly) or the caller's own id — never a claim about
-- who else supposedly did the inviting.

drop policy memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated with check (
    (app.is_platform_admin() or app.has_capability(tenant_id, 'tenant.manage_members'))
    and (invited_by is null or invited_by = auth.uid())
  );

-- Membership update: admins keep full control; additionally, the invited
-- user themself may attempt an update while status = 'invited' (the only
-- capability-free path a real invitee has). The trigger below is what
-- actually decides *which* transition that attempt is allowed to make.
drop policy memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update to authenticated
  using (
    app.is_platform_admin()
    or app.has_capability(tenant_id, 'tenant.manage_members')
    or (user_id = auth.uid() and status = 'invited')
  )
  with check (
    app.is_platform_admin()
    or app.has_capability(tenant_id, 'tenant.manage_members')
    or (user_id = auth.uid())
  );

-- Membership transition guard: RLS above decides *who* may attempt an
-- update; this trigger decides *what shape* of change that attempt may
-- make, regardless of role. Identity/provenance columns are always frozen;
-- role changes require tenant.manage_members; a self-service update may
-- only ever be the single transition invited -> active, with no other
-- column touched.
-- security definer: a trigger function defaults to running as the role that
-- issued the UPDATE, and that role (authenticated) does not have USAGE on
-- schema app, so it could not otherwise name-resolve app.is_platform_admin()/
-- app.has_capability() below — same reasoning as public.has_capability() in
-- 20260912120150_authorization_helpers.sql.
create or replace function app.guard_membership_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_admin boolean;
  v_is_self boolean;
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.user_id is distinct from old.user_id
     or new.invited_by is distinct from old.invited_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Membership identity and invitation provenance cannot be changed'
      using errcode = '23001';
  end if;

  v_is_admin := app.is_platform_admin() or app.has_capability(old.tenant_id, 'tenant.manage_members');
  v_is_self := auth.uid() = old.user_id;

  if new.role_key is distinct from old.role_key and not v_is_admin then
    raise exception 'Only tenant.manage_members can change a membership role'
      using errcode = '23001';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'invited' and new.status = 'active' then
      if not (v_is_admin or v_is_self) then
        raise exception 'Only the invited user or tenant.manage_members can activate this membership'
          using errcode = '23001';
      end if;
      if v_is_self and new.role_key is distinct from old.role_key then
        raise exception 'Accepting an invitation cannot also change its role'
          using errcode = '23001';
      end if;
    else
      if not v_is_admin then
        raise exception 'Only tenant.manage_members can change membership status from % to %', old.status, new.status
          using errcode = '23001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_memberships_transition_guard
  before update on public.memberships
  for each row execute function app.guard_membership_transition();

-- public.is_platform_admin(): same reasoning as public.has_capability()
-- (20260912120150_authorization_helpers.sql) — the app schema is not
-- PostgREST-exposed, and a security-invoker PostgREST function cannot even
-- name-resolve app.is_platform_admin() itself, since that requires USAGE on
-- schema app, which authenticated does not have. This wrapper must be
-- security definer for the same reason app.is_platform_admin() itself is.
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select app.is_platform_admin();
$$;

comment on function public.is_platform_admin() is
  'PostgREST-callable wrapper around app.is_platform_admin(), for client-side identity resolution and the RPCs below.';

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Atomic, capability-checked, audited RPCs -----------------------------------
-- Each wraps a multi-step write (insert(s) + audit event) in one PostgREST
-- call so a partial client-side failure can never leave a bootstrap step
-- unaudited. All run `security invoker`: they still go through the RLS
-- policies above as the calling user: the explicit checks here exist for a
-- clean early error, not as the real enforcement boundary. They call
-- public.is_platform_admin()/public.has_capability() rather than the app.*
-- originals for the same schema-usage reason.

create or replace function public.bootstrap_tenant(
  p_name text,
  p_slug text,
  p_initial_admin_user_id uuid
) returns public.tenants
language plpgsql
security invoker
as $$
declare
  v_tenant public.tenants;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator can bootstrap a tenant' using errcode = '42501';
  end if;

  insert into public.tenants (name, slug) values (p_name, p_slug)
  returning * into v_tenant;

  insert into public.memberships (tenant_id, user_id, role_key, status)
  values (v_tenant.id, p_initial_admin_user_id, 'tenant_admin', 'active');

  perform public.record_audit_event(
    v_tenant.id, 'tenant.bootstrapped', 'tenant', v_tenant.id::text, null,
    jsonb_build_object('initial_admin_user_id', p_initial_admin_user_id)
  );

  return v_tenant;
end;
$$;

comment on function public.bootstrap_tenant(text, text, uuid) is
  'Platform-admin-only: create a tenant, its first active tenant_admin membership, and an audit event, atomically.';

create or replace function public.invite_member(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role_key text
) returns public.memberships
language plpgsql
security invoker
as $$
declare
  v_membership public.memberships;
begin
  if p_role_key = 'platform_super_admin' then
    raise exception 'platform_super_admin cannot be granted through a tenant invitation'
      using errcode = '23001';
  end if;

  insert into public.memberships (tenant_id, user_id, role_key, status, invited_by)
  values (p_tenant_id, p_user_id, p_role_key, 'invited', auth.uid())
  returning * into v_membership;

  perform public.record_audit_event(
    p_tenant_id, 'membership.invited', 'membership', v_membership.id::text, null,
    jsonb_build_object('user_id', p_user_id, 'role_key', p_role_key)
  );

  return v_membership;
end;
$$;

comment on function public.invite_member(uuid, uuid, text) is
  'Capability-checked (tenant.manage_members): invite an existing user into a tenant and audit it, atomically.';

create or replace function public.accept_invitation(p_membership_id uuid)
returns public.memberships
language plpgsql
security invoker
as $$
declare
  v_membership public.memberships;
begin
  update public.memberships
  set status = 'active'
  where id = p_membership_id
    and user_id = auth.uid()
    and status = 'invited'
  returning * into v_membership;

  if v_membership.id is null then
    raise exception 'Invitation not found or already handled' using errcode = 'P0002';
  end if;

  perform public.record_audit_event(
    v_membership.tenant_id, 'membership.activated', 'membership', v_membership.id::text, null, '{}'::jsonb
  );

  return v_membership;
end;
$$;

comment on function public.accept_invitation(uuid) is
  'Self-service: the invited user activates their own membership and audits it, atomically.';

create or replace function public.set_membership_status(
  p_membership_id uuid,
  p_status text
) returns public.memberships
language plpgsql
security invoker
as $$
declare
  v_membership public.memberships;
begin
  if p_status not in ('active', 'suspended', 'removed') then
    raise exception 'Unsupported membership status %', p_status using errcode = '22023';
  end if;

  update public.memberships
  set status = p_status
  where id = p_membership_id
  returning * into v_membership;

  if v_membership.id is null then
    raise exception 'Membership not found or not permitted' using errcode = 'P0002';
  end if;

  perform public.record_audit_event(
    v_membership.tenant_id, 'membership.status_changed', 'membership', v_membership.id::text, null,
    jsonb_build_object('status', p_status)
  );

  return v_membership;
end;
$$;

comment on function public.set_membership_status(uuid, text) is
  'Admin-driven membership status change (suspend/reactivate/remove) and audit event, atomically. Relies entirely on the memberships RLS policies and app.guard_membership_transition() to decide whether the caller may act on the target row.';

revoke all on function public.bootstrap_tenant(text, text, uuid) from public;
revoke all on function public.invite_member(uuid, uuid, text) from public;
revoke all on function public.accept_invitation(uuid) from public;
revoke all on function public.set_membership_status(uuid, text) from public;
grant execute on function public.bootstrap_tenant(text, text, uuid) to authenticated;
grant execute on function public.invite_member(uuid, uuid, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.set_membership_status(uuid, text) to authenticated;

-- Rollback: drop the five functions above (including public.is_platform_admin), drop trigger
-- trg_memberships_transition_guard and function
-- app.guard_membership_transition(), then restore the prior
-- memberships_insert/memberships_update policies from
-- 20260912120160_identity_and_tenancy_rls.sql. This migration has not been
-- applied to a hosted environment.

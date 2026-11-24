-- Platform console: read and governance RPCs for MITIGA staff (platform
-- administrators). They stay on the governance side of the boundary set in
-- 20260922140000_platform_admin_operational_boundary.sql: tenants,
-- memberships and account identity only — never customers, assessments,
-- decisions, policies or any other tenant-operational data.
--
-- Every write is audited twice: a platform-level event (tenant_id null, the
-- only audit rows a platform admin can read) and a tenant-level event the
-- tenant's own admins can see.

create or replace function app.assert_platform_governance_actor()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_platform_governance_actor() then
    raise exception 'Platform administrator required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.assert_platform_governance_actor() from public;

-- 1. Tenant overview ----------------------------------------------------------

create or replace function public.platform_tenant_overview()
returns table (
  tenant_id uuid,
  name text,
  slug text,
  status text,
  created_at timestamptz,
  active_members bigint,
  invited_members bigint,
  suspended_members bigint,
  admin_emails text[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.assert_platform_governance_actor();
  return query
  select
    t.id, t.name, t.slug, t.status, t.created_at,
    count(*) filter (where m.status = 'active'),
    count(*) filter (where m.status = 'invited'),
    count(*) filter (where m.status = 'suspended'),
    coalesce(
      array_agg(u.email::text order by u.email) filter (where m.status = 'active' and m.role_key = 'tenant_admin'),
      '{}'::text[]
    )
  from public.tenants t
  left join public.memberships m on m.tenant_id = t.id
  left join auth.users u on u.id = m.user_id
  group by t.id
  order by t.created_at;
end;
$$;

revoke all on function public.platform_tenant_overview() from public;
grant execute on function public.platform_tenant_overview() to authenticated;

-- 2. Members of one tenant -----------------------------------------------------

create or replace function public.platform_tenant_members(p_tenant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  role_key text,
  status text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.assert_platform_governance_actor();
  return query
  select m.id, m.user_id, u.email::text, m.role_key, m.status, m.created_at, u.last_sign_in_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant_id
  order by
    case m.role_key when 'tenant_admin' then 0 when 'risk_analyst' then 1 when 'operator' then 2 else 3 end,
    u.email;
end;
$$;

revoke all on function public.platform_tenant_members(uuid) from public;
grant execute on function public.platform_tenant_members(uuid) to authenticated;

-- 3. Create a tenant with its first admin (existing account) ---------------

create or replace function public.platform_create_tenant(
  p_name text,
  p_slug text,
  p_admin_email text
) returns public.tenants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_email text := lower(btrim(coalesce(p_admin_email, '')));
  v_admin uuid;
  v_tenant public.tenants;
begin
  perform app.assert_platform_governance_actor();

  if char_length(v_name) not between 2 and 120 then
    raise exception 'Company name must be 2 to 120 characters' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then
    raise exception 'Slug must be 3 to 50 lowercase letters, digits or hyphens' using errcode = '22023';
  end if;
  if exists (select 1 from public.tenants where slug = v_slug) then
    raise exception 'A company with this slug already exists' using errcode = '23505';
  end if;

  select id into v_admin from auth.users where lower(email) = v_email and deleted_at is null;
  if v_admin is null then
    raise exception 'No MITIGA account exists for this email' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.platform_admins where user_id = v_admin) then
    raise exception 'A platform administrator cannot be a company admin' using errcode = '22023';
  end if;

  v_tenant := public.bootstrap_tenant(v_name, v_slug, v_admin);

  perform public.record_audit_event(
    null, 'platform.tenant_created', 'tenant', v_tenant.id::text, null,
    jsonb_build_object('tenant_name', v_tenant.name, 'slug', v_tenant.slug, 'initial_admin_user_id', v_admin)
  );

  return v_tenant;
end;
$$;

revoke all on function public.platform_create_tenant(text, text, text) from public;
grant execute on function public.platform_create_tenant(text, text, text) to authenticated;

-- 4. Suspend / reactivate a tenant -------------------------------------------

create or replace function public.platform_set_tenant_status(
  p_tenant_id uuid,
  p_status text,
  p_reason text
) returns public.tenants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before public.tenants;
  v_after public.tenants;
begin
  perform app.assert_platform_governance_actor();

  if p_status is null or p_status not in ('active', 'suspended') then
    raise exception 'Status must be active or suspended' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 10 and 500 then
    raise exception 'A reason of 10 to 500 characters is required' using errcode = '22023';
  end if;

  select * into v_before from public.tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'Company not found' using errcode = 'P0002';
  end if;
  if v_before.status = p_status then
    return v_before;
  end if;

  update public.tenants set status = p_status, updated_at = now()
  where id = p_tenant_id
  returning * into v_after;

  perform public.record_audit_event(
    null, 'platform.tenant_status_changed', 'tenant', p_tenant_id::text, null,
    jsonb_build_object('tenant_name', v_after.name, 'from', v_before.status, 'to', p_status, 'reason', v_reason)
  );
  perform public.record_audit_event(
    p_tenant_id, 'tenant.status_changed', 'tenant', p_tenant_id::text, null,
    jsonb_build_object('from', v_before.status, 'to', p_status, 'reason', v_reason, 'by', 'platform')
  );

  return v_after;
end;
$$;

revoke all on function public.platform_set_tenant_status(uuid, text, text) from public;
grant execute on function public.platform_set_tenant_status(uuid, text, text) to authenticated;

-- 5. Suspend / reactivate a member, with a platform-level trail ------------

create or replace function public.platform_set_membership_status(
  p_membership_id uuid,
  p_status text,
  p_reason text
) returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before public.memberships;
  v_after public.memberships;
begin
  perform app.assert_platform_governance_actor();

  if p_status is null or p_status not in ('active', 'suspended') then
    raise exception 'Status must be active or suspended' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 10 and 500 then
    raise exception 'A reason of 10 to 500 characters is required' using errcode = '22023';
  end if;

  select * into v_before from public.memberships where id = p_membership_id;
  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;
  if v_before.status = 'invited' then
    raise exception 'An invitation cannot be suspended or reactivated here' using errcode = '22023';
  end if;
  if v_before.status = p_status then
    return v_before;
  end if;

  -- Reuses the governance path (and its tenant-level audit event).
  v_after := public.set_membership_status(p_membership_id, p_status);

  perform public.record_audit_event(
    null, 'platform.membership_status_changed', 'membership', p_membership_id::text, null,
    jsonb_build_object('tenant_id', v_after.tenant_id, 'user_id', v_after.user_id, 'role_key', v_after.role_key,
                       'from', v_before.status, 'to', p_status, 'reason', v_reason)
  );

  return v_after;
end;
$$;

revoke all on function public.platform_set_membership_status(uuid, text, text) from public;
grant execute on function public.platform_set_membership_status(uuid, text, text) to authenticated;

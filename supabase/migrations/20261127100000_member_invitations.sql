-- Member invitations from the company workspace.
--
-- The company admin (tenant.manage_members) invites by email. The web
-- server creates the account through the Supabase admin API when none
-- exists (which also sends the invite email), then calls the existing
-- public.invite_member() as the admin, so authorization and audit stay in
-- the database. The invitee accepts with the existing
-- public.accept_invitation().
--
-- These helpers are all security definer, member-only (no platform-admin
-- bypass), and expose emails only to people who already manage or view
-- that company's members.

-- 1. Resolve an invitee email to an existing account (or null).
create or replace function public.find_user_for_invitation(p_tenant_id uuid, p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'tenant.manage_members') then
    raise exception 'Missing tenant.manage_members capability for tenant %', p_tenant_id using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;
  return (select id from auth.users where lower(email) = v_email and deleted_at is null limit 1);
end;
$$;

revoke all on function public.find_user_for_invitation(uuid, text) from public;
grant execute on function public.find_user_for_invitation(uuid, text) to authenticated;

-- 2. The caller's own pending invitations, with the company name.
create or replace function public.my_pending_invitations()
returns table (membership_id uuid, tenant_id uuid, tenant_name text, role_key text, invited_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, t.id, t.name, m.role_key, m.created_at
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid() and m.status = 'invited' and t.status = 'active'
  order by m.created_at;
$$;

revoke all on function public.my_pending_invitations() from public;
grant execute on function public.my_pending_invitations() to authenticated;

-- 3. The company's member directory with emails, for people who can view
--    the company's members (tenant.view).
create or replace function public.tenant_member_directory(p_tenant_id uuid)
returns table (membership_id uuid, user_id uuid, email text, role_key text, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'tenant.view') then
    raise exception 'Missing tenant.view capability for tenant %', p_tenant_id using errcode = '42501';
  end if;
  return query
  select m.id, m.user_id, u.email::text, m.role_key, m.status, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant_id
  order by
    case m.status when 'invited' then 0 when 'active' then 1 when 'suspended' then 2 else 3 end,
    u.email;
end;
$$;

revoke all on function public.tenant_member_directory(uuid) from public;
grant execute on function public.tenant_member_directory(uuid) to authenticated;

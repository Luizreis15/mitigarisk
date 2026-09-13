-- Local, credential-free verification shim.
--
-- Every real MITIGA environment is Supabase, which already provisions the
-- `auth` schema, the `anon`/`authenticated`/`service_role` Postgres roles,
-- and `auth.uid()`/`auth.role()`. Migrations under supabase/migrations/ rely
-- on those and must never create them.
--
-- This file recreates the minimum subset needed to apply the migrations and
-- exercise RLS against a disposable, local-only Postgres cluster with no
-- network access and no Supabase project of any kind. It is test-only:
-- never run it against a real Supabase database. `auth.uid()`/`auth.role()`
-- below are byte-for-byte the functions Supabase itself ships, so behavior
-- under test matches production.

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Matches Supabase's shipped definition: reads the PostgREST JWT claim GUCs
-- that are set per-request in production and per-session by tests here.
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase provisions every hosted project with default privileges so that
-- tables created by later migrations are automatically reachable by
-- anon/authenticated/service_role, with RLS doing the real access control.
-- Reproduce that here so the migrations under supabase/migrations/ do not
-- need to (and must not) carry their own GRANT statements.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- Function execute grants stay fully explicit per-function in the
-- migrations themselves (see app.has_capability and friends), so no default
-- privilege is set for functions here.

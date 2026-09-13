-- TASK-002: extensions and shared helper functions.
-- Defense-in-depth building blocks used by every later migration:
--   * app.* holds internal helpers and is never exposed through PostgREST.
--   * Security-definer lookups avoid recursive RLS evaluation on membership tables.
--   * auth.uid()/auth.role() are provided by the Supabase platform in every real
--     environment; they are NOT created here. Local, credential-free verification
--     uses the shim in supabase/tests/000-local-auth-shim.sql instead.

create extension if not exists "pgcrypto";

create schema if not exists app;

comment on schema app is
  'MITIGA internal helpers and authorization primitives. Not exposed via PostgREST.';

-- Generic updated_at maintenance, attached per-table where needed.
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Generic append-only guard: blocks UPDATE and DELETE outright.
create or replace function app.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Rows in % are append-only and cannot be modified (%: %)', tg_table_name, tg_op, coalesce(old.id, null)
    using errcode = '23001';
end;
$$;

-- Tenant and authorization helpers that query public.memberships /
-- public.platform_admins / public.role_capabilities live in
-- 20260912120150_authorization_helpers.sql, once those tables exist:
-- SQL-language function bodies are parsed against real objects at creation
-- time, unlike plpgsql, so they cannot be defined before their tables.

-- Rollback: drop function app.forbid_mutation(); drop function
-- app.set_updated_at(); drop schema app; -- (after later migrations are
-- also rolled back)

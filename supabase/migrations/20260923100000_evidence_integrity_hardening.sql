-- TASK-029: make completed evaluation evidence and audit evidence
-- impossible to forge or alter through the database, for every identity.
-- Closes findings R (critical) and AU (high) from the TASK-028 independent
-- review (docs/orquestracao/REVIEW-TASK-028.md):
--   R: a platform admin with no membership ran
--      `update public.evaluation_reason_codes set description='TAMPERED'`
--      with no WHERE and rewrote every reason code in every tenant,
--      including completed evaluations; a forged insert into a completed
--      evaluation's reason codes also succeeded.
--   AU: public.record_audit_event is executable by authenticated and
--       accepts a free-form action/metadata, so a platform admin can write
--       an event into any tenant, and any tenant member can forge a
--       business-looking event in their own tenant.
-- docs/tasks/TASK-029-claude-evidence-integrity-hardening.md has the full
-- trigger inventory and the record_audit_event grep this migration is
-- based on.
--
-- Human decisions approved 2026-09-23 (Edu):
--   D7 - revoke EXECUTE on public.record_audit_event from authenticated
--        and anon. Verified by grep (recorded in the TASK-029 handoff):
--        no apps/web code calls this RPC directly; only a code comment and
--        an unrelated TypeScript type name (RecordAuditEventInput)
--        reference it by name.
--
--        D7's own text assumes every business RPC that calls
--        record_audit_event is security definer. That is true for four of
--        them (create_supplier, create_supplier_evidence,
--        run_supplier_evaluation, record_supplier_final_decision) but
--        false for the other four
--        (20260913090000_auth_tenant_bootstrap.sql's bootstrap_tenant,
--        invite_member, accept_invitation, set_membership_status are all
--        security INVOKER) -- discovered when this migration's first draft
--        broke supabase/tests/030-auth-tenant-bootstrap.sql with
--        "permission denied for function record_audit_event", since an
--        invoker function's internal call to record_audit_event executes
--        as the ORIGINAL calling (authenticated) role, not an elevated
--        one. Reported to, and resolved with, the human owner: the fix
--        approved is to make these four RPCs security definer too (item 0
--        below), moving each one's authorization out of the RLS policies
--        it relied on (as an invoker function, subject to RLS as the
--        calling role) into an explicit, equivalent in-body check -- the
--        same "explicit check is the real boundary once RLS no longer
--        applies" pattern this codebase already uses for every other
--        security-definer write RPC (e.g. public.create_supplier()).
--   D8 - revoke INSERT and UPDATE on evaluation_reason_codes from
--        authenticated and anon, and drop the
--        evaluation_reason_codes_insert/update policies. Reason codes are
--        then written only by public.run_supplier_evaluation(), itself
--        security definer.

-- 0. Prerequisite for D7: make every business RPC that calls
-- record_audit_event security definer, not just the four that already
-- were. Each function's authorization is unchanged in effect -- only
-- where it is checked moves from an implicit RLS policy (evaluated against
-- the calling role, invoker-style) to an explicit check in the function
-- body (evaluated once, up front, exactly mirroring the RLS condition it
-- replaces) -- since a security-definer function's own writes bypass RLS
-- entirely, and no other RLS protection is being removed for anyone else.

-- bootstrap_tenant: its one explicit check (`if not
-- public.is_platform_admin()`) already gates the entire function and
-- already exactly matches D5's tenants_insert/memberships_insert bypass
-- (a platform administrator's own governance action); nothing else to add.
create or replace function public.bootstrap_tenant(
  p_name text,
  p_slug text,
  p_initial_admin_user_id uuid
) returns public.tenants
language plpgsql
security definer
set search_path = public, pg_temp
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

-- invite_member: previously relied entirely on memberships_insert's RLS
-- (app.is_platform_governance_actor() or app.has_capability(tenant_id,
-- 'tenant.manage_members')) -- that exact condition is now an explicit
-- check, evaluated before the insert. invited_by is still pinned to
-- auth.uid() in the insert itself (unchanged), so the RLS with-check's
-- "invited_by is null or invited_by = auth.uid()" half of the old
-- condition is preserved by construction, not by a separate check.
create or replace function public.invite_member(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role_key text
) returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.memberships;
begin
  if p_role_key = 'platform_super_admin' then
    raise exception 'platform_super_admin cannot be granted through a tenant invitation'
      using errcode = '23001';
  end if;

  if not (app.is_platform_governance_actor() or app.has_capability(p_tenant_id, 'tenant.manage_members')) then
    raise exception 'Missing tenant.manage_members capability for tenant %', p_tenant_id using errcode = '42501';
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

-- accept_invitation: its own WHERE clause (id = p_membership_id and
-- user_id = auth.uid() and status = 'invited') is already the entire
-- authorization boundary -- self-scoped by construction, not by RLS -- so
-- bypassing RLS changes nothing reachable. app.guard_membership_transition()
-- (already security definer, TASK-028) still fires regardless and remains
-- the independent backstop on what shape of change is allowed.
create or replace function public.accept_invitation(p_membership_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
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

-- set_membership_status: previously relied entirely on memberships_update's
-- RLS to filter which row(s) were even visible to the UPDATE (admin, or
-- self with status still 'invited' -- but this RPC is for admin-driven
-- suspend/reactivate/remove, not self-accept, which is
-- accept_invitation's own job). The target row's tenant_id is not known
-- until it is looked up, so the lookup happens first (failing closed with
-- P0002 if missing, exactly as before), then the same
-- is_platform_governance_actor()/tenant.manage_members condition RLS used
-- to apply is checked explicitly before the write.
create or replace function public.set_membership_status(
  p_membership_id uuid,
  p_status text
) returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.memberships;
  v_tenant_id uuid;
begin
  if p_status not in ('active', 'suspended', 'removed') then
    raise exception 'Unsupported membership status %', p_status using errcode = '22023';
  end if;

  select tenant_id into v_tenant_id from public.memberships where id = p_membership_id;
  if v_tenant_id is null then
    raise exception 'Membership not found or not permitted' using errcode = 'P0002';
  end if;

  if not (app.is_platform_governance_actor() or app.has_capability(v_tenant_id, 'tenant.manage_members')) then
    raise exception 'Missing tenant.manage_members capability for tenant %', v_tenant_id using errcode = '42501';
  end if;

  update public.memberships
  set status = p_status
  where id = p_membership_id
  returning * into v_membership;

  perform public.record_audit_event(
    v_membership.tenant_id, 'membership.status_changed', 'membership', v_membership.id::text, null,
    jsonb_build_object('status', p_status)
  );

  return v_membership;
end;
$$;

-- 1. D7: audit writes are server-internal only -------------------------------
-- Note what this does NOT change: public.record_audit_event() keeps its
-- own internal is_platform_admin()/membership check (defense in depth,
-- now unreachable from a direct authenticated call but still guarding the
-- function itself), and every business RPC that calls it internally is
-- unaffected -- now that all eight (item 0 above, plus the four that
-- already were security definer) run as their own elevated role, each
-- internal `perform public.record_audit_event(...)` call executes as that
-- role, which still holds EXECUTE, because this REVOKE only removes it
-- from authenticated/anon, not from the functions' owner.

revoke execute on function public.record_audit_event(uuid, text, text, text, uuid, jsonb) from authenticated, anon;

-- 2. D8: reason codes are written only by run_supplier_evaluation() --------
-- Direct INSERT/UPDATE has both a table-level grant (from the local
-- harness's `alter default privileges ... grant ... insert, update ... to
-- authenticated` -- see supabase/tests/000-local-auth-shim.sql -- mirrored
-- by the hosted project's own default grants) and, until now, a
-- policy that admitted it. Both are closed: the grant is revoked outright
-- (mirroring public.suppliers's "revoke insert, update, delete ... from
-- authenticated, anon" in 20260914120100_suppliers.sql) so a raw write
-- fails on the grant itself, not only on RLS, and the two write policies
-- are dropped rather than narrowed, since there is no longer any
-- authenticated actor -- tenant member or platform admin -- who should
-- write this table directly at all.

revoke insert, update on public.evaluation_reason_codes from authenticated, anon;
drop policy evaluation_reason_codes_insert on public.evaluation_reason_codes;
drop policy evaluation_reason_codes_update on public.evaluation_reason_codes;

-- 3. Guard-trigger sweep (item 2) --------------------------------------------
-- Inventory method: pg_proc joined to pg_trigger in a live, fully migrated
-- and seeded local instance (not a text grep), then pg_get_functiondef() on
-- every trigger function in the app schema to read its actual body. Full
-- inventory and before/after table in the TASK-029 handoff. Summary:
--
-- Of the 14 trigger functions in schema app, exactly ONE both (a) reads a
-- table other than the row it fires on and (b) was security invoker:
-- app.forbid_reason_code_mutation_after_completion() (reads
-- public.evaluations) -- this is finding R itself, fixed below.
--
-- app.enforce_evaluation_policy_and_identity() also reads another table
-- (public.policy_versions) but was already security definer
-- (20260912120800_security_and_english_first_hardening.sql) and was
-- already verified fail-closed on a missing/non-published parent row (a
-- null policy status is "distinct from 'published'", so INSERT already
-- raises 23001) -- no change needed.
--
-- The contract's own "Examples" list under item 2 (guard_case_identity,
-- guard_webhook_delivery_history, guard_notification_request_history,
-- guard_supplier_identity, guard_supplier_evidence_identity) turned out,
-- on reading each one's actual body, to be an over-approximation: every
-- one of those five is a pure NEW-vs-OLD identity/append-only guard on the
-- SAME row the trigger fires on -- none contains a SELECT from any other
-- table. PostgreSQL never applies RLS to NEW/OLD inside a row-level
-- trigger (RLS only gates whether a row is selected for the UPDATE/DELETE
-- in the first place; once a trigger fires for a row, its OLD/NEW values
-- are always fully available regardless of the firing role's own SELECT
-- visibility), so none of these five has the R-class failure mode, and
-- item 2's own stated rule ("every trigger function ... that reads a table
-- other than NEW/OLD") does not select them. None is changed here.
--
-- app.forbid_completed_evaluation_mutation() is also self-row-only (reads
-- only OLD.status of the evaluations row the trigger already fires on) and
-- so has no R-class bug either, but item 1 explicitly names it for the
-- same security-definer redefinition as forbid_reason_code_mutation_after_completion
-- -- implemented below for defense in depth and consistency with that
-- function, exactly as instructed, even though the live inventory shows it
-- was not itself vulnerable.

create or replace function app.forbid_reason_code_mutation_after_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

    -- Fail closed: a parent evaluation that cannot be found is treated
    -- exactly like one that is completed/failed, never like one that is
    -- still open to mutation. This is the fix for finding R: before this
    -- migration, a caller who could not see the parent row (any caller
    -- once this trigger becomes security definer would see it regardless,
    -- but a genuinely nonexistent evaluation_id has no row for anyone) got
    -- a null v_status, and `null in ('completed','failed')` is null, not
    -- true, so the guard silently allowed the mutation.
    if not found or v_status in ('completed', 'failed') then
      raise exception 'Cannot modify reason codes: evaluation % is % (or cannot be found)',
        old.evaluation_id, coalesce(v_status, 'missing')
        using errcode = '23001';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    select status into v_status
    from public.evaluations
    where id = new.evaluation_id and tenant_id = new.tenant_id;

    if not found or v_status in ('completed', 'failed') then
      raise exception 'Cannot attach reason codes: evaluation % is % (or cannot be found)',
        new.evaluation_id, coalesce(v_status, 'missing')
        using errcode = '23001';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function app.forbid_completed_evaluation_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

-- Rollback: this migration only revokes two grants, drops two policies,
-- and redefines two existing trigger functions (CREATE OR REPLACE
-- FUNCTION); no table, column, or data is added, removed, or migrated.
-- Restoring the prior behavior means: re-granting EXECUTE on
-- public.record_audit_event(uuid, text, text, text, uuid, jsonb) to
-- authenticated; re-granting INSERT, UPDATE on public.evaluation_reason_codes
-- to authenticated, anon and re-creating evaluation_reason_codes_insert/
-- update from 20260912120300_evaluation.sql; and re-applying the prior
-- (security invoker) bodies of app.forbid_reason_code_mutation_after_completion()
-- and app.forbid_completed_evaluation_mutation() from the same migration.

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
--        reference it by name. Every audit event is already written from
--        inside a security-definer business RPC
--        (create_supplier/create_supplier_evidence/run_supplier_evaluation/
--        record_supplier_final_decision/bootstrap_tenant/invite_member/
--        accept_invitation/set_membership_status), which will keep working
--        because those RPCs call public.record_audit_event() as their own
--        (definer) role, unaffected by a revoke against authenticated/anon.
--   D8 - revoke INSERT and UPDATE on evaluation_reason_codes from
--        authenticated and anon, and drop the
--        evaluation_reason_codes_insert/update policies. Reason codes are
--        then written only by public.run_supplier_evaluation(), itself
--        security definer.

-- 1. D7: audit writes are server-internal only -------------------------------
-- Note what this does NOT change: public.record_audit_event() keeps its
-- own internal is_platform_admin()/membership check (defense in depth,
-- now unreachable from a direct authenticated call but still guarding the
-- function itself), and every business RPC that calls it internally is
-- unaffected -- a security-definer function's internal `perform
-- public.record_audit_event(...)` call resolves and executes as that
-- RPC's own (elevated) role, which still holds EXECUTE because this
-- REVOKE only removes it from authenticated/anon, not from the function's
-- owner.

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

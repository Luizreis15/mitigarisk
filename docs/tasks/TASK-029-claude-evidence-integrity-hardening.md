# TASK-029 — Evidence integrity: reason codes, audit write path, and guard triggers

Owner: Claude Code (implementation) · Reviewer: independent (orchestrator) · Status: **Approved — D7, D8 approved by human owner on 2026-09-23**

Branch: `fix/authz-evidence-integrity`, created from `integration/audit-and-task-019`. The expected base is the TASK-028 head, `f2492e9`, once TASK-028 is integrated.

## Objective

Make completed evaluation evidence and audit evidence impossible to forge or alter through the database, for every identity: a tenant member, a platform administrator, or a dual-role user.

## Findings addressed (REVIEW-TASK-028)

- **R (critical).** A platform admin with no membership ran `update public.evaluation_reason_codes set description='TAMPERED'` with no `WHERE`, and it rewrote every reason code in every tenant, including reason codes of *completed* evaluations. Inserting a forged reason code into a completed evaluation also succeeded. Root cause:
  - `app.forbid_reason_code_mutation_after_completion()` is `security invoker`. After TASK-026 it can no longer see the parent evaluation, so the status it reads is null and the guard passes;
  - the `evaluation_reason_codes_insert/update` policies still grant `app.is_platform_admin()`.
- **AU (high).** `public.record_audit_event` is executable by `authenticated` and accepts a free-form `action` and `metadata`:
  - a platform admin can write events into any tenant;
  - any tenant member can write a fake `supplier.final_decision_recorded` event.
- **S (systemic).** Other `security invoker` guard triggers that read another table under RLS have the same failure mode as R.

## Human decisions required before start (recommended defaults)

- **D7 — Audit writes are server-internal only.** Revoke `EXECUTE` on `public.record_audit_event` from `authenticated` and `anon`. Audit events are written only by the business RPCs, which are `security definer` and run with the owner's privilege. Recommended: **yes**. No application code calls the RPC directly; verify this with grep and report it.
- **D8 — Reason codes are written only by trusted paths.** Revoke `INSERT` and `UPDATE` on `evaluation_reason_codes` from `authenticated`, and drop the `evaluation_reason_codes_insert/update` policies. Reason codes are then written only by `run_supplier_evaluation`, which is `security definer`. Recommended: **yes**. The direct legacy insert in `020-integration-hardening.sql` is test scaffolding. Move it to superuser setup and document the move per test.

## In scope

1. Add a forward migration, timestamped after `20260922140000`, that:
   - implements D7 and D8;
   - redefines `app.forbid_reason_code_mutation_after_completion()` and `app.forbid_completed_evaluation_mutation()` as `security definer` with `set search_path = public, pg_temp`. A parent row that cannot be found must **fail closed**: raise `23001`, never pass.
2. **Guard-trigger sweep.** Inventory every trigger function in `supabase/migrations/` that reads a table other than `NEW`/`OLD`, and record for each whether it is `security invoker` or `definer`. Every guard or immutability trigger that reads another table must become `security definer` and fail closed when the looked-up row is missing. Examples:
   - `guard_case_identity`
   - `guard_webhook_delivery_history`
   - `guard_notification_request_history`
   - `guard_supplier_identity`
   - `guard_supplier_evidence_identity`
   - `enforce_evaluation_policy_and_identity`

   If a trigger cannot safely become definer, stop and report it.
3. Add `supabase/tests/080-evidence-integrity.sql` covering:
   - R: an update with no `WHERE` and an insert into a completed evaluation, run as each of: platform admin with no membership, dual-role user, tenant_admin, risk_analyst. Every run must affect zero rows or raise, and a row count taken as superuser must prove the rows are unchanged;
   - AU: `record_audit_event` returns `42501` for authenticated callers, while the business RPCs still produce their audit events atomically;
   - the legitimate flows still pass: supplier creation, evidence, evaluation (reason codes present), final decision, tenant bootstrap and membership invitation, each with its audit event;
   - for every trigger changed in item 2, one test showing a fail-closed denial for an outsider.

## Out of scope

- UI, seed data, and the role matrix.
- Dependencies and the lockfile.
- Hosted services.
- Merge and push.

## Files allowed

- The new migration.
- `supabase/tests/080-evidence-integrity.sql`.
- `supabase/tests/020-integration-hardening.sql`: only the scaffolding move required by D8, justified per test.
- `docs/tasks/TASK-029-claude-evidence-integrity-hardening.md`.

## Acceptance criteria

1. After the migration, a platform admin, a dual-role user, or any tenant member cannot alter or add reason codes of any evaluation, and cannot write an audit event directly.
2. Every business RPC still writes its audit event in the same transaction.
3. The trigger inventory is in the handoff. No remaining guard trigger both reads another table and is `security invoker`, unless the handoff justifies the exception.
4. Suites 010–070 pass, and every modified test is justified.
5. Full verification passes with exit codes preserved.

## Required verification

The same gates as TASK-028: SQL harness, `npm ci`, `npm test`, `tsc`, lint, build, `build:vercel`/`verify:vercel`, `check-secrets` and `git diff --check`.

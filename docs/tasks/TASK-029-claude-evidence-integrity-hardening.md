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

## Trigger inventory (item 2, done before implementation)

Method: not a text grep. Spun up the disposable local harness (`initdb` + every file in `supabase/migrations/` + `supabase/seed.sql`), then queried the **live** database:

```sql
select n.nspname, p.proname, p.prosecdef as is_definer,
       string_agg(distinct c.relname, ', ') as attached_to_tables
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_trigger t on t.tgfoid = p.oid
join pg_class c on c.oid = t.tgrelid
where n.nspname = 'app'
group by n.nspname, p.proname, p.prosecdef
order by p.proname;
```

Then `select pg_get_functiondef('app.<name>'::regproc);` on every `security invoker` (`is_definer = f`) row, to read its actual body rather than guess from the name.

| Function | `security` (live, before) | Reads another table? | Verdict |
|---|---|---|---|
| `enforce_evaluation_policy_and_identity` | definer | yes — `public.policy_versions` | Already correct: already definer, already fails closed on a missing/non-published parent (`null is distinct from 'published'` is true, so a missing row already raises 23001 on INSERT). No change. |
| `enforce_policy_publication_integrity` | invoker | no (self-row: `new`/`old` of `policy_versions` only) | Not in scope of the sweep's rule; no change. |
| `forbid_children_when_not_draft` | **definer** (already fixed by TASK-028) | yes — `public.policy_versions` | Already correct (TASK-028). No change. |
| `forbid_completed_evaluation_mutation` | invoker | no (self-row: `old.status` of `evaluations` only) | Item 1 of this contract names it explicitly for the same redefinition as the next row. Made `security definer` here anyway, for defense in depth and consistency, even though the live inventory shows it had no R-class exposure (RLS never gates `NEW`/`OLD` inside a trigger; only whether a row is selected for the `UPDATE`/`DELETE` in the first place). |
| `forbid_mutation` | invoker | no (raises unconditionally, touches nothing) | No change. |
| `forbid_published_policy_version_mutation` | invoker | no (self-row: `old`/`new` of `policy_versions` only) | No change. |
| `forbid_reason_code_mutation_after_completion` | **invoker** | **yes — `public.evaluations`** | **This is finding R.** Made `security definer`, with `set search_path = public, pg_temp`, and an explicit `if not found or v_status in ('completed','failed')` fail-closed check (previously a missing/invisible parent row left `v_status` null, and `null in (...)` is null, not true, so the guard silently passed). |
| `guard_case_identity` | invoker | no (self-row: `cases` only) | Named in the contract's "Examples" list under item 2, but its body has no cross-table `SELECT` at all — pure `NEW`-vs-`OLD` identity comparison on the same row. Not selected by item 2's own stated rule. No change; documented as a correction to the contract's illustrative list, the same way the TASK-028 inventory corrected itself mid-task. |
| `guard_membership_transition` | definer (already, TASK-026/028) | yes — `public.tenants` (via `app.has_tenant_capability_as_member`, and its own D5 helper calls) | Already correct. No change. |
| `guard_notification_request_history` | invoker | no (self-row: `notification_requests` only) | Same as `guard_case_identity`: named in the "Examples" list, no cross-table read on inspection. No change. |
| `guard_supplier_evidence_identity` | invoker | no (self-row: `supplier_evidence` only) | Same. No change. |
| `guard_supplier_identity` | invoker | no (self-row: `suppliers` only) | Same. No change. |
| `guard_webhook_delivery_history` | invoker | no (self-row: `webhook_deliveries` only) | Same. No change. |
| `set_updated_at` | invoker | no (self-row: sets `new.updated_at` only) | No change. |

**Correction to the contract's item 2 "Examples" list:** five of its six named examples (`guard_case_identity`, `guard_webhook_delivery_history`, `guard_notification_request_history`, `guard_supplier_identity`, `guard_supplier_evidence_identity`) do not read another table at all — each is a pure identity/append-only guard comparing `NEW` and `OLD` of the same row the trigger fires on, and PostgreSQL never applies RLS to `NEW`/`OLD` inside a row-level trigger body (RLS only gates whether a row is selected for the `UPDATE`/`DELETE` that fires the trigger in the first place). None of them can exhibit finding R's failure mode. Only `enforce_evaluation_policy_and_identity` (already definer) and `forbid_reason_code_mutation_after_completion` (fixed here) actually read another table among the six named examples plus the fourteen-function live inventory as a whole. This was verified by reading every `security invoker` function's real body via `pg_get_functiondef`, not assumed from its name.

No trigger could not safely become `security definer` — the sweep's outcome is "one function needed the fix and got it; one function is changed anyway per explicit instruction; the rest genuinely don't apply." Nothing is stopped/reported under item 2's "if a trigger cannot safely become definer" clause because no such case exists.

## `record_audit_event` grep (D7)

```
$ grep -rni "record_audit_event\|recordAuditEvent" apps/web/ --include="*.ts" --include="*.tsx"
apps/web/lib/domain/audit.ts:5:// the app.record_audit_event() RPC, which stamps actor_id itself.
apps/web/lib/domain/audit.ts:23:export interface RecordAuditEventInput {
```

Two hits, neither a call: line 5 is a code comment, line 23 is an unrelated TypeScript interface name (`RecordAuditEventInput`, a domain type for the audit event shape, not an RPC invocation). No `.rpc("record_audit_event"...)` or equivalent call exists anywhere in `apps/web`. Every audit event apps/web ever causes to be written goes through a business Server Action calling a security-definer RPC (`create_supplier`, `create_supplier_evidence`, `run_supplier_evaluation`, `record_supplier_final_decision`, `bootstrap_tenant`, `invite_member`, `accept_invitation`, `set_membership_status`), each of which calls `public.record_audit_event()` internally as its own (elevated) role — unaffected by revoking `EXECUTE` from `authenticated`/`anon`.

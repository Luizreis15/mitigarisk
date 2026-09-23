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

## D7 premise correction, found during implementation

D7's own text states audit events are "written only by the business RPCs, which are `security definer`." Verified false for four of the eight: `bootstrap_tenant`, `invite_member`, `accept_invitation`, and `set_membership_status` (all in `20260913090000_auth_tenant_bootstrap.sql`) are `security invoker`. Applying the revoke as specified broke `supabase/tests/030-auth-tenant-bootstrap.sql` (`permission denied for function record_audit_event`) — an invoker function's internal call to `record_audit_event` executes as the *original calling role*, which no longer has `EXECUTE` once D7 applies.

Reported to, and resolved with, the human owner (mid-task): make all four `security definer` too, moving each one's authorization out of the RLS policy it implicitly relied on (as an invoker function, subject to RLS as the calling role) into an explicit, equivalent check in the function body — the same pattern this codebase already uses for every other write RPC. No RLS protection is silently bypassed for anyone: each explicit check reproduces exactly the condition the RLS policy it replaces would have evaluated.

| Function | Before | After | Authorization now lives in |
|---|---|---|---|
| `public.bootstrap_tenant` | `security invoker`; single explicit `if not public.is_platform_admin()` check already gated the whole function | `security definer` | Unchanged — the existing check already matched D5's `tenants_insert`/`memberships_insert` bypass exactly |
| `public.invite_member` | `security invoker`; relied entirely on `memberships_insert`'s RLS (`is_platform_governance_actor() or has_capability(tenant_id,'tenant.manage_members')`) | `security definer` | New explicit `if not (app.is_platform_governance_actor() or app.has_capability(p_tenant_id,'tenant.manage_members'))` check before the insert |
| `public.accept_invitation` | `security invoker`; relied on `memberships_update`'s self-accept RLS branch | `security definer` | Unchanged — its own `where id = p_membership_id and user_id = auth.uid() and status = 'invited'` is already the entire boundary, self-scoped by construction; `app.guard_membership_transition()` (already definer) remains an independent backstop |
| `public.set_membership_status` | `security invoker`; relied entirely on `memberships_update`'s admin RLS branch | `security definer` | New: looks up the target's `tenant_id` first (fails closed with `P0002` if missing, unchanged), then an explicit `if not (app.is_platform_governance_actor() or app.has_capability(v_tenant_id,'tenant.manage_members'))` check before the update |

Regression for the new explicit checks is in `080-evidence-integrity.sql` (`invite_member` still rejects a caller without `tenant.manage_members`) and exercised positively by the legitimate-flow tests for all four RPCs.

## Handoff

**Outcome:** Implemented. Finding R (evaluation-reason-code forgery) and finding AU (forgeable audit writes) are both closed for every identity. D7's own premise was found to be wrong for four RPCs during implementation; fixed with the human owner's approval (see above) so D7 works as intended rather than breaking tenant bootstrap and membership management. During implementation, D7 was also found to break two existing tests outside the contract's file-allowance (`010-rls-tenant-isolation.sql`, and `070-platform-admin-operational-boundary.sql` from TASK-028); extending the same superuser-scaffolding treatment already approved for `020` to those two was confirmed with the human owner before making the change. All required verification passed.

**Branch and commits:** `fix/authz-evidence-integrity`, created from `integration/audit-and-task-019` at `f2492e9`.

```text
c077ad7 docs(task): approve TASK-029 evidence integrity hardening
de72835 docs(task): record TASK-029 trigger inventory and record_audit_event grep
931d987 fix(authz): close evaluation-reason-code forgery and lock audit writes
0d9f668 fix(authz): make invoker membership/bootstrap RPCs security definer
e34c2c4 test(authz): move D7/D8-blocked scaffolding to the superuser connection
d0e1239 test(authz): move 070's D6 audit fixture to the superuser connection
e8636bd test(authz): add permanent evidence-integrity SQL suite
```

**Files changed:**
- `supabase/migrations/20260923100000_evidence_integrity_hardening.sql` (new)
- `supabase/tests/080-evidence-integrity.sql` (new)
- `supabase/tests/020-integration-hardening.sql` (D8 scaffolding move, justified per test in its own commit)
- `supabase/tests/010-rls-tenant-isolation.sql` (D7 scaffolding move, extended by explicit approval — see above)
- `supabase/tests/070-platform-admin-operational-boundary.sql` (D7 scaffolding move, same extension)
- `docs/tasks/TASK-029-claude-evidence-integrity-hardening.md` (new; this file)

No UI, seed, dependency, or lockfile file was touched.

### R and AU results, by identity

| Scenario | Identity | Result |
|---|---|---|
| R: unqualified `UPDATE evaluation_reason_codes SET description='TAMPERED'` | dual-role platform admin | DENIED — `insufficient_privilege` (42501, grant revoked) |
| R: same | tenant_admin | DENIED — 42501 |
| R: same | risk_analyst | DENIED — 42501 |
| R: same | platform admin, no membership | DENIED — 42501 |
| R: forged `INSERT` into a completed evaluation's reason codes | dual-role platform admin | DENIED — 42501 |
| R: same | tenant_admin | DENIED — 42501 |
| R: same | risk_analyst | DENIED — 42501 |
| R: same | platform admin, no membership | DENIED — 42501 |
| R: superuser row-count proof | — | 0 rows carry `description='TAMPERED'`; the attacked evaluation still has exactly its original 7 reason codes |
| AU1: `record_audit_event` called directly | platform admin | DENIED — 42501 |
| AU2: `record_audit_event` called directly to forge `supplier.final_decision_recorded` | risk_analyst, own tenant | DENIED — 42501 |
| AU: business RPCs still write audit events atomically | `create_supplier`, `create_supplier_evidence`, `run_supplier_evaluation`, `record_supplier_final_decision`, `bootstrap_tenant`, `invite_member`, `accept_invitation`, `set_membership_status` | ALLOWED — each produces its audit_events row in the same call |
| Guard-trigger fail-closed: reason code with a nonexistent parent evaluation | superuser (the one role that can still reach the write path) | DENIED — `23001` |
| Guard-trigger fail-closed: reason code for a real, completed evaluation | superuser | DENIED — `23001` |
| Guard-trigger fail-closed: mutate a completed evaluation's score | tenant_admin (holds `evaluation.run`, would otherwise pass RLS) | DENIED — `23001` |
| Regression: `invite_member` without `tenant.manage_members` | operator | DENIED — 42501 (now the explicit in-body check, not RLS) |

### Suites 010–070: two justified scaffolding moves, otherwise unmodified

`030-auth-tenant-bootstrap.sql`, `040-supplier-evaluation.sql`, `050-supplier-final-decision.sql`, `060-uniform-authorization.sql` are byte-for-byte unchanged and pass with their exact prior counts.

- `020-integration-hardening.sql` (contract-authorized): D8 revokes `INSERT`/`UPDATE` on `evaluation_reason_codes` from `authenticated` outright. Two direct writes in this file — a legacy-evaluation reason-code fixture insert, and an update meant to exercise the append-only trigger's own reparenting guard — moved to the superuser connection the harness runs as. Both still exercise exactly what they did before (the trigger fires for any role); only the write path changed, from `authenticated` to the one role D8 leaves able to write this table directly.
- `010-rls-tenant-isolation.sql` and `070-platform-admin-operational-boundary.sql` (extension confirmed with the human owner mid-task, since the contract's files-allowed list named only `020`): each calls `public.record_audit_event(...)` directly — `010` to prove actor-stamping, `070` as a D6 read-side fixture. D7 revokes `EXECUTE` from `authenticated` entirely, so both now fail on the grant itself regardless of caller. Both assertions' actual targets (actor stamping; D6 read visibility) are independent of *who* writes the row, so both moved to the superuser connection; `auth.uid()` there still resolves correctly because `request.jwt.claim.sub` is a session-local GUC, untouched by `reset role`.

### Checks run and exact results

SQL harness (`./supabase/tests/run-local-verification.sh`, `set -o pipefail`): **SQL=0**, `==> all checks passed`.

| Suite | `ok -` assertions | Failures |
|---|---|---|
| 010-rls-tenant-isolation.sql | 16 | 0 |
| 020-integration-hardening.sql | 21 | 0 |
| 030-auth-tenant-bootstrap.sql | 18 | 0 |
| 040-supplier-evaluation.sql | 43 | 0 |
| 050-supplier-final-decision.sql | 26 | 0 |
| 060-uniform-authorization.sql | 28 | 0 |
| 070-platform-admin-operational-boundary.sql | 40 | 0 |
| 080-evidence-integrity.sql | 26 | 0 |
| **Total** | **218** | **0** |

Application checks (`apps/web`):

| Check | Command | Result |
|---|---|---|
| Install | `npm ci` | exit 0 — 0 vulnerabilities |
| Tests | `npm test` | **TEST=0** — 223 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo |
| Type check | `npx tsc --noEmit -p tsconfig.json` | **TSC=0** — no diagnostics |
| Lint | `npm run lint -- --ignore-pattern 'components/ui/**' --ignore-pattern 'hooks/use-mobile.ts'` | **LINT=0** |
| Build | `npm run build` | **BUILD=0** |
| Vercel build | `npm run build:vercel` | exit 0 |
| Vercel verify | `npm run verify:vercel` | **VERCEL=0** — genuine Vercel Build Output API v3 |
| Secrets | `./scripts/check-secrets.sh` | **SECRETS=0** — "Secret check passed." |
| Diff whitespace | `git diff --check` | **DIFF=0** |

Test counts unchanged from the pre-TASK-029 baseline (223/223) — no `apps/web` file was touched.

### Security/tenant/audit impact

Closes finding R completely: no identity — tenant member, platform admin, or dual-role — can alter or forge evaluation reason codes, for any evaluation, in any status, through the database. Closes finding AU completely: no identity can write an audit event directly; every audit event is now produced only as a side effect of an authorized business action, atomically, by a security-definer RPC. The systemic pattern (finding S) was swept exhaustively via live `pg_proc`/`pg_trigger` introspection, not assumed: exactly one additional trigger (`forbid_reason_code_mutation_after_completion`) had the vulnerable shape, and it is fixed. No data was deleted. No secret, credential, or hosted service was touched.

### Migration and rollback notes

The migration (`20260923100000_evidence_integrity_hardening.sql`) is forward-only and touches no table, column, or data: it revokes two grants (`record_audit_event` EXECUTE; `evaluation_reason_codes` INSERT/UPDATE), drops two policies, and redefines six existing functions (`CREATE OR REPLACE FUNCTION`: the two guard triggers, plus the four newly-definer RPCs). Rollback is documented in the migration's own trailing comment: re-grant both revoked privileges, re-create the two dropped policies from `20260912120300_evaluation.sql`, and re-apply the six functions' prior bodies from `20260912120300_evaluation.sql`/`20260912120800_security_and_english_first_hardening.sql` and `20260913090000_auth_tenant_bootstrap.sql`.

### Known limitations

- No browser or Server Action walkthrough was run; this task's scope is the database boundary only, and no `apps/web` file was changed.
- The D7 premise correction and the 010/070 scope extension were both real, unplanned discoveries made mid-implementation; both were surfaced to and resolved with the human owner before proceeding, rather than decided unilaterally.
- Hosted Supabase and Vercel were not accessed; all verification ran against the disposable local Postgres cluster and local build output only.

**Recommended reviewer:** Codex (orchestrator), for independent review per `docs/governance/MULTI-AGENT-DEVELOPMENT.md` — author and reviewer must differ for this security-sensitive change.

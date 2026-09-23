# TASK-026 — Uniform database authorization and evaluation hardening

Owner: Claude Code (implementation) · Reviewer: independent (orchestrator) · Status: **Approved — D1, D2, D3 approved by human owner on 2026-09-22**

Branch: `fix/authz-uniform-tenant-boundary`, created from `feat/claude-supplier-final-decision` at `73bcc09` (or from the integration line once TASK-025 is integrated).

## Objective

Make the database the single, uniform authorization boundary for every real supplier-workflow surface. Close the gaps found in the TASK-025 independent review, and make `run_supplier_evaluation` fail safely on invalid policies.

## Business context

MITIGA's principle is "the system recommends; the company decides." That only holds if no identity can read or write operational tenant data outside its active, legitimate membership. The TASK-025 review ran direct probes against the database, bypassing the Server Actions, and confirmed the following:

- A1/A3/A4/A5: a platform administrator who also holds an active `tenant_admin` membership can call `create_supplier` and `run_supplier_evaluation`, and can read suppliers and supplier evaluations. `record_supplier_final_decision` correctly denies the same identity.
- B1: in a suspended tenant, supplier rows remain readable through RLS. Writes in a suspended tenant are denied only incidentally, through `record_audit_event`, and not by authorization.
- F1/F2: a platform administrator with no membership can insert a legacy evaluation (`supplier_id is null`) with an arbitrary score into any tenant, and can read legacy evaluations in any tenant.
- D1: a published policy with a factor where `min = max` makes `run_supplier_evaluation` raise `division_by_zero` (22012).
- E: seeded policy factors share one `created_at`, so the reason-code order is not deterministic.

## Human decisions required before start (recommended defaults)

- **D1 — Dual role:** any `platform_admins` identity is denied on every tenant-operational surface, even when it holds a membership. Recommended: **yes**, consistent with TASK-025.
- **D2 — Suspended tenant:** operational reads and writes are denied when `tenants.status <> 'active'`. Recommended: **yes**.
- **D3 — Legacy evaluations:** remove the platform-admin bypass from `evaluations_insert/update/select` and from `evaluation_reason_codes_select` for `supplier_id is null`. Recommended: **yes**.
- Not decided here, and out of scope: whether `operator` keeps `evaluation.run`.

## In scope

1. Add a forward migration that redefines `app.has_tenant_capability_as_member` and `app.is_active_tenant_admin`. Each must require all three of:
   - an active membership;
   - an active tenant (`tenants.status = 'active'`);
   - that `auth.uid()` is not in `platform_admins`.

   Keep the signatures unchanged, so every existing caller inherits the fix. The explicit checks from TASK-025 can remain as defense in depth.
2. Rewrite the legacy evaluation policies according to D3, using the member-only helpers.
3. Add a policy validation guard inside `run_supplier_evaluation`, before any computation. Each check fails with a stable SQLSTATE `22023` and no partial write:
   - every factor has numeric `min < max`;
   - every factor has a known `direction`;
   - every weight is `> 0`;
   - the thresholds cover `[0, 100]` with no gap or overlap.
4. Make the factor iteration order deterministic with `order by created_at, key`. Document that this is the ordering contract.
5. Add `pg_advisory_xact_lock` on `(tenant_id, correlation_id)` in `run_supplier_evaluation`, so concurrent retries resolve idempotently.
6. Add `supabase/tests/060-uniform-authorization.sql` with permanent assertions for:
   - every probe scenario, A through F;
   - evidence creation by a dual-role identity;
   - a **real** cross-tenant evaluation id in `record_supplier_final_decision`, not a nonexistent one;
   - a regression check that each legitimate role still works: tenant_admin, risk_analyst, operator, and auditor read.
7. Update the stale comments that point to `supplier-evaluation-adapter.ts` and `complete_supplier_evaluation`. Fix the wrong script path in the TASK-025 contract.

## Out of scope

- UI changes.
- Seed and role-matrix changes.
- Policy publishing UI.
- Changes to the TypeScript engine.
- Dependency upgrades.
- The lockfile fix, which is a separate chore.
- Hosted Supabase and Vercel.
- Merge and push.

## Files or bounded contexts allowed

- `supabase/migrations/<new timestamp>_uniform_tenant_authorization.sql`
- `supabase/tests/060-uniform-authorization.sql`
- Comment-only edits in `supabase/migrations/*` are **not** allowed. Applied migrations are immutable; fix stale comments in the new migration's header or in docs.
- `docs/tasks/TASK-026-*.md` (handoff)
- `docs/tasks/TASK-025-*.md` (script path fix only)

## Acceptance criteria

1. Each of the following returns 42501 or zero rows at the database boundary:
   - probes A1–A5, including evidence creation;
   - B1–B5;
   - F1–F2.
2. Existing suites 010–050 pass unchanged. Any test that relied on a removed bypass is updated only with a written justification.
3. An invalid published policy causes a 22023 failure with no evaluation row and no audit row.
4. Two identical calls with the same correlation id return the same evaluation row.
5. `npm test`, `tsc`, lint, build, `verify:vercel` and the SQL harness all pass, with exit codes preserved (`set -o pipefail`).

## Security, tenant and audit requirements

- The migration is forward-only. Its rollback is documented as the prior function and policy definitions.
- No data is deleted.
- Audit remains atomic.
- No secrets and no real data.

## Required verification

`./supabase/tests/run-local-verification.sh`. Then, in `apps/web`, run `npm test`, `npx tsc --noEmit -p tsconfig.json`, lint with the project's exclusions, `npm run build` and `npm run verify:vercel`. Finally, run `git diff --check`.

## Expected handoff

Use the standard handoff template in `docs/governance/MULTI-AGENT-DEVELOPMENT.md`. Report the exact test counts and list every policy or function whose behavior changed.

## Handoff

**Outcome:** Implemented. The database is now the uniform authorization boundary for D1 (dual-role platform admin), D2 (suspended tenant), and D3 (legacy evaluation bypass). A policy-validation guard, a deterministic factor order, and an advisory lock were added to `run_supplier_evaluation`. All required verification passed.

**Branch and commit:** `fix/authz-uniform-tenant-boundary`, created from `integration/audit-and-task-019` at `73bcc09`. Final implementation commit (migration + test suite): `71ba3fe35d83451d89c587e31442122dac123f95` (`71ba3fe`). This handoff itself is recorded in the commit that follows it, `9831ff8557b2687eb950a45d20d8c2784e2fe3d6` (`9831ff8`), which is the branch tip at delivery.

```text
66f8b5c docs(task): approve TASK-026 uniform database authorization
a83eca9 docs(task): fix wrong verification script path in TASK-025
31863d8 fix(authz): make the database a uniform tenant authorization boundary
71ba3fe test(authz): add permanent uniform-authorization SQL suite
9831ff8 docs(task): record TASK-026 handoff
```

**Files changed:**

- `supabase/migrations/20260922130000_uniform_tenant_authorization.sql` (new)
- `supabase/tests/060-uniform-authorization.sql` (new)
- `docs/tasks/TASK-026-claude-uniform-database-authorization.md` (new; this file)
- `docs/tasks/TASK-025-claude-supplier-final-decision.md` (one-line script-path fix only)

No file outside this list was touched. No UI, seed, dependency, or lockfile change.

### Functions and policies whose behavior changed

| Object | Before | After |
|---|---|---|
| `app.has_tenant_capability_as_member(uuid, text)` | True for an active membership with a role granting the capability, **regardless** of the identity also being a platform administrator, and regardless of the tenant's own status. | Additionally requires `not app.is_platform_admin()` and the tenant's `status = 'active'` (D1, D2). Same signature; every existing caller inherits the fix with no code change of its own. |
| `app.is_active_tenant_admin(uuid)` | True for an active `tenant_admin` membership, regardless of a platform-admin dual role or tenant status. | Same D1/D2 additions as above. |
| `evaluations_insert` (RLS, `public.evaluations`, legacy `supplier_id is null` rows) | `with check ((app.is_platform_admin() or app.has_capability(tenant_id,'evaluation.run')) and ...)`. | `with check (app.has_tenant_capability_as_member(tenant_id,'evaluation.run') and ...)` — platform-admin bypass removed (D3). |
| `evaluations_update` (same table, same rows) | Same platform-admin-bypass shape as insert. | Same member-only rewrite as insert (D3). |
| `evaluations_select` | `CASE`: supplier rows used `has_tenant_capability_as_member`; legacy rows used `app.is_platform_admin() or app.has_capability(...)`. | Both branches now identical, so the policy is one unconditional `app.has_tenant_capability_as_member(tenant_id,'evaluation.view')` (D3). |
| `evaluation_reason_codes_select` | Mirrored the same `CASE` as `evaluations_select`. | Same collapse to one unconditional `app.has_tenant_capability_as_member(e.tenant_id,'evaluation.view')` (D3). |
| `public.run_supplier_evaluation(uuid, uuid, uuid)` | No structural policy validation (a factor with `min = max` raised an undocumented `division_by_zero`, 22012, mid-computation); factor iteration `order by created_at` only (nondeterministic when factors share a timestamp); no advisory lock (concurrent identical calls could race past the replay check). | Validates every factor (`min < max`, known `direction`, `weight > 0`) and every threshold (contiguous `[0, 100]` coverage) before any computation, raising `22023` with no partial write on failure; iterates `order by created_at, key` (deterministic); takes `pg_advisory_xact_lock` on `(tenant_id, correlation_id)` (namespaced with second argument `1`, distinct from `record_supplier_final_decision`'s `0`) before the replay/conflict check. |

**Not redefined, but behavior changes transitively** (no code of their own touched): `public.create_supplier`, `public.create_supplier_evidence`, `suppliers_select`, `supplier_evidence_select`, `public.record_supplier_final_decision`, `public.can_record_supplier_final_decision`, `supplier_final_decisions_select` — all call `app.has_tenant_capability_as_member` or `app.is_active_tenant_admin` and inherit D1/D2 automatically. `record_supplier_final_decision`'s own explicit `app.is_platform_admin()` check (TASK-025) is unchanged text; it is now redundant defense in depth rather than the sole guard.

**Out of scope, confirmed unchanged:** `app.has_capability()` / `app.is_platform_admin()` keep their deliberate, documented platform-admin bypass everywhere else (e.g. `app.has_capability`-gated `policy_versions`/`policy_factors`/`policy_thresholds` policies, and non-supplier evaluation reads for `supplier_id is null` rows are now member-only per D3 — the platform-admin bypass that remains is on other tables entirely, not `evaluations`). Probe B6 (`app.has_capability` on a suspended tenant) is intentionally not asserted in `060-uniform-authorization.sql`: it is outside the acceptance criteria (which lists only B1–B5) and outside the two redefined functions.

### Scenario A–F results (`supabase/tests/060-uniform-authorization.sql`)

| Scenario | Probe | Result |
|---|---|---|
| A1 | Dual-role platform admin `create_supplier` | DENIED — `42501` |
| A2 | Dual-role platform admin `create_supplier_evidence` | DENIED — `42501` |
| A3 | Dual-role platform admin `run_supplier_evaluation` | DENIED — `42501` |
| A4 | Dual-role platform admin reads suppliers | DENIED — 0 rows |
| A5 | Dual-role platform admin reads supplier evaluations | DENIED — 0 rows |
| A' | Real (not fabricated) cross-tenant evaluation id in `record_supplier_final_decision`, called by a legitimate admin of a *different* tenant | DENIED — `P0002`, not found (no existence disclosure) |
| B1 | Suspended-tenant active admin reads suppliers | DENIED — 0 rows |
| B2 | Suspended-tenant active admin `create_supplier` | DENIED — `42501` |
| B3 | Suspended-tenant active admin `run_supplier_evaluation` | DENIED — `42501` |
| B4 | Suspended-tenant active admin `record_supplier_final_decision` | DENIED — `42501` |
| B5 | Suspended-tenant active admin reads final decisions | DENIED — 0 rows |
| B6 | (legacy `app.has_capability` view on a suspended tenant) | Not asserted — out of scope (see above) |
| C1 | Operator `run_supplier_evaluation` (regression) | ALLOWED — completes |
| D | Degenerate published policy (`min = max`) `run_supplier_evaluation` | DENIED — `22023`, before any computation; 0 evaluation rows, 0 audit rows for that correlation id |
| E | Factor iteration order | Confirmed: 6 seeded factors share one `created_at`; `order by created_at, key` yields a fixed alphabetical key order; the persisted `evaluation_reason_codes` for a real run match that exact order |
| F1 | Platform admin, no membership, direct legacy evaluation insert | DENIED — `insufficient_privilege` (`42501`) |
| F2 | Platform admin, no membership, reads legacy evaluations | DENIED — 0 rows |
| Idempotency | Two identical `run_supplier_evaluation` calls, same correlation id | Same evaluation row returned both times; 1 row total |

Regression (legitimate roles unaffected): `tenant_admin` still creates the supplier and runs the fixture evaluation; `risk_analyst` still calls `create_supplier_evidence`; `operator` still runs an evaluation (C1); `auditor` still reads suppliers, supplier evaluations, and evaluation reason codes; a legitimate `tenant_admin` still writes a legacy (`supplier_id is null`) evaluation directly (D3 narrows only the platform-admin bypass, not the member-only path a real admin already used).

### Suites 010–050: pass unchanged, no test modified

`010-rls-tenant-isolation.sql`, `020-integration-hardening.sql`, `030-auth-tenant-bootstrap.sql`, `040-supplier-evaluation.sql`, and `050-supplier-final-decision.sql` were not edited. Justification, test by test: every existing assertion that exercises the platform administrator (`00000000-0000-0000-0000-000000000001`) against a denial path — `040-supplier-evaluation.sql` section 3 and section 7's `sp_platform_admin_evaluate`, and `050-supplier-final-decision.sql`'s dual-role and unauthorized-identity loop — does so either (a) with the platform admin holding **no** membership in the target tenant at all, where `app.has_tenant_capability_as_member`'s pre-existing membership `EXISTS` check already returned `false` regardless of the new `not app.is_platform_admin()`/tenant-active conditions, or (b) through `record_supplier_final_decision`'s own explicit `app.is_platform_admin()` check (TASK-025), which already denied before this migration. No assertion in 010–050 relies on a platform-admin or suspended-tenant *bypass succeeding*, so none needed a change. This was verified empirically, not just by inspection: all five suites passed with their full assertion counts and zero failures in the run below.

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
| **Total** | **152** | **0** |

Application checks (`apps/web`):

| Check | Command | Result |
|---|---|---|
| npm ci | `npm ci` | exit 0 — 585 packages added, 0 vulnerabilities |
| Tests | `npm test` | **TEST=0** — 223 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo |
| Type check | `npx tsc --noEmit -p tsconfig.json` | **TSC=0** — no diagnostics |
| Lint | `npm run lint -- --ignore-pattern 'components/ui/**' --ignore-pattern 'hooks/use-mobile.ts'` | **LINT=0** |
| Build | `npm run build` | **BUILD=0** |
| Vercel build | `npm run build:vercel` | **BUILD_VERCEL=0** |
| Vercel verify | `npm run verify:vercel` | **VERCEL=0** — genuine Vercel Build Output API v3 |
| Secrets | `./scripts/check-secrets.sh` | **SECRETS=0** — "Secret check passed." |
| Diff whitespace | `git diff --check` | **DIFF=0** |

Test counts are unchanged from the pre-TASK-026 baseline (223/223) because no `apps/web` file was touched — this task's scope is the database boundary only.

### Security/tenant/audit impact

Closes three confirmed tenant-isolation gaps: a platform administrator with a dual membership could read/write real tenant data (A); a suspended tenant's data remained readable and only incidentally write-protected (B); a platform administrator with no membership at all could forge a legacy evaluation into any tenant (F). Audit integrity is strengthened: a structurally invalid published policy can no longer leave a partial evaluation or a missing/mismatched audit event, and concurrent identical retries can no longer race past the correlation-id replay check. No data was deleted. No secret, credential, or real customer data was read, touched, or written; `./scripts/check-secrets.sh` and the "no `.env`" constraint were both honored throughout.

### Migration and rollback notes

The migration (`20260922130000_uniform_tenant_authorization.sql`) is forward-only and touches no table, column, or data — it only redefines two functions (`CREATE OR REPLACE FUNCTION`, unchanged signatures), rewrites four RLS policies (`DROP POLICY` + `CREATE POLICY` on unchanged tables), and fully replaces one RPC (`CREATE OR REPLACE FUNCTION public.run_supplier_evaluation`). Rollback is to re-apply the exact prior function and policy bodies from `20260914120050_no_bypass_authorization_helpers.sql` and `20260914120200_supplier_evaluation.sql`, as documented in this migration's own trailing rollback comment. No data migration is required in either direction.

### Known limitations

- No browser or Server Action walkthrough was run; this task's scope and allowed-files list are the database boundary only, and no `apps/web` file was changed.
- Probe B6 (the legacy, still-bypassing `app.has_capability()` view on a suspended tenant) is intentionally not asserted as denied: it is outside this task's acceptance criteria (B1–B5 only) and outside the two functions this task was scoped to redefine.
- `operator`'s `evaluation.run` grant and the role/capability seed matrix are untouched, as explicitly out of scope.
- Hosted Supabase and Vercel were not accessed; all verification ran against the disposable local Postgres cluster and local build output only.

**Recommended reviewer:** Codex (orchestrator), for independent review per `docs/governance/MULTI-AGENT-DEVELOPMENT.md` — author and reviewer must differ for this security-sensitive change.

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

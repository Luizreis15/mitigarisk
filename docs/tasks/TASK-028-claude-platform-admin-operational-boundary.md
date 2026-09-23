# TASK-028 — Platform-admin operational boundary on policy, case, integration and notification surfaces

Owner: Claude Code (implementation) · Reviewer: independent (orchestrator) · Status: **Approved — D4, D5, D6 approved by human owner on 2026-09-22**

Branch: `fix/authz-platform-admin-operational-surfaces`, created from `integration/audit-and-task-019` at `d392486`. If the lockfile chore has already been integrated, branch from that newer head instead.

## Objective

Extend the TASK-026 rules to every remaining tenant-operational surface. D1 denies platform admins and D2 denies suspended tenants. The platform-admin bypass that remains must be explicit and limited to platform governance.

## Business context

The TASK-026 independent review found probe **G**. A platform administrator with no tenant membership created a draft policy in tenant 3, added a factor, added a single 0–100 `approve` band, and published it. The tenant's next supplier evaluation then used that policy and returned `approve`. The platform operator can therefore change any customer's risk recommendation indirectly. The cause is RLS of the form `app.is_platform_admin() or app.has_capability(...)`, which still exists outside the supplier slice.

## Human decisions required before start (recommended defaults)

- **D4 — Operational surfaces become member-only.** Recommended: **yes**. The following tables move to `app.has_tenant_capability_as_member(...)` (D1 + D2), with no platform bypass:
  - `policy_versions`, `policy_factors`, `policy_thresholds`;
  - `cases`, `case_evidence`, and the `case_decisions` select;
  - `api_clients`, `webhook_endpoints`, `webhook_deliveries`;
  - `notification_templates`, `notification_requests`.
- **D5 — Platform governance keeps an explicit, named bypass.** Recommended: **yes**. Platform administrators keep what they need to operate the platform:
  - `tenants` (read and status changes);
  - `memberships` (read and status changes through the existing RPCs);
  - the `roles`, `capabilities` and `role_capabilities` catalogs;
  - `platform_admins`.

  The bypass is expressed through a new helper, `app.is_platform_governance_actor()`, which is a thin wrapper around `app.is_platform_admin()`. Its purpose is that every remaining bypass can be found with grep.
- **D6 — `audit_events` select.** Recommended: platform admins read only events with `tenant_id is null`. That covers platform-level events and never exposes tenant operational metadata. Tenant members keep `audit.view` through the member-only helper.

## In scope

1. **Inventory first.** List every RLS policy and every `security definer` function in `supabase/migrations/` that references `app.is_platform_admin()` or `app.has_capability(`. Classify each one as D4, D5 or D6 in the handoff. If a surface does not fit the table, **stop and report it without implementing it**.
2. Add one forward migration that rewrites the D4 policies to the member-only helper and creates `app.is_platform_governance_actor()`. The D5 policies must call the new helper explicitly. The D6 policy is rewritten as described above.
3. Publication integrity. When `policy_versions.status` becomes `published`, a trigger enforces `published_at = now()` and `published_by = auth.uid()`. A future-dated `published_at` must no longer make a policy the current one. The trigger must not break the seed: the seed publishes as superuser with an explicit `published_by`, so the trigger forces `published_by` only when `auth.uid()` is not null.
4. Make SQLSTATEs consistent in the `run_supplier_evaluation` guard. A non-numeric `min` or `max` must fail with 22023, not 22P02. Test the value with a regex before casting. This requires redefining the function in the same new migration.
5. Record in `docs/tasks/TASK-028-*.md` that the TASK-026 migration header incorrectly names `apps/web/lib/domain/supplier-evaluation-adapter.ts`, which no longer exists. This is a documentation erratum only: applied migrations are immutable.
6. Add `supabase/tests/070-platform-admin-operational-boundary.sql`, covering:
   - probe G, end to end. A platform admin with no membership, and a dual-role platform admin, both fail on insert, update and publish of `policy_versions`, `policy_factors` and `policy_thresholds`, and on insert and update of cases. The tenant evaluation keeps using the legitimate policy;
   - a future-dated `published_at` is overwritten with `now()`;
   - suspended tenant: reads and writes on D4 surfaces are denied;
   - D5 still works for platform admins: listing tenants, suspending a tenant and listing memberships, through the existing paths;
   - D6: a platform admin sees platform events and does not see tenant events;
   - regression: `tenant_admin`, `risk_analyst`, `operator` and `auditor` keep their current capabilities on each D4 surface.

## Out of scope

- UI and prototype screens under `lib/demo`.
- Seed data and the role matrix, including `operator` and `evaluation.run`.
- A policy-publishing UI.
- Dependencies and the lockfile.
- Hosted Supabase and Vercel.
- Merge and push.

## Files allowed

- `supabase/migrations/<timestamp after 20260922130000>_platform_admin_operational_boundary.sql`
- `supabase/tests/070-platform-admin-operational-boundary.sql`
- `docs/tasks/TASK-028-claude-platform-admin-operational-boundary.md` (contract and handoff)

## Acceptance criteria

1. Probe G fails at every step with 42501, and the tenant's evaluation keeps using the tenant's own policy.
2. After the migration, every reference to `app.is_platform_admin()` in RLS is inside `app.is_platform_governance_actor()` or inside an explicit D5 or D6 policy. The handoff includes the resulting grep.
3. Suites 010–060 pass. Any modified test is justified in writing, test by test.
4. Publication with a future `published_at` is overwritten, which is covered by a test.
5. Full verification passes with exit codes preserved.

## Security, tenant and audit requirements

- The migration is forward-only, with no deletion of data.
- Rollback is documented as the prior policy bodies.
- Audit writes remain atomic.
- No real data and no secrets.

## Required verification

`./supabase/tests/run-local-verification.sh`. Then, in `apps/web`: `npm ci`, `npm test`, `npx tsc --noEmit -p tsconfig.json`, lint with the project exclusions, `npm run build`, and `npm run build:vercel && npm run verify:vercel`. Finally: `./scripts/check-secrets.sh` and `git diff --check`.

## Expected handoff

Use the standard template. It must include:
- the surface inventory and classification (D4, D5, D6);
- a before and after of each policy;
- the per-suite counts;
- the SHA.

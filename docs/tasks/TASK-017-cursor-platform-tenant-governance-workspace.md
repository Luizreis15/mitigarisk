# TASK-017 — Cursor platform tenant governance workspace

## Objective

Build the English-first Platform Super Admin workspace for governing MITIGA
tenants: tenant directory, lifecycle, administrative membership health, policy
version posture, and audit visibility. It is a frontend prototype contract and
must not imply cross-tenant customer-data access or real platform mutations.

## Context

MITIGA has three distinct operating contexts: Platform Super Admin, Company,
and Operator/Auditor. Company administration is covered by TASK-014; this task
makes the platform-level tenant-governance boundary clear for owner review.

## In scope

- Work only in `apps/web/app/**`, `apps/web/components/**`,
  `apps/web/lib/demo/**`, `apps/web/lib/i18n/**`, and this task.
- Add a Platform Super Admin tenant directory and a tenant-governance detail
  route. Use only fictional, market-neutral tenants, including Northstar.
- Distinguish tenant lifecycle (draft/active/suspended), platform visibility,
  company memberships, policy posture, configuration readiness, and audit
  signals. Do not present a risk score as tenant health or as a decision.
- Clearly communicate the boundary: Platform Super Admin may govern the
  platform and tenant access, but does not browse a tenant's case/evaluation
  operational records through this view.
- Include local-only, confirmation-based states for provision, suspend,
  reactivate, and support access. The UI must clearly say no change is saved,
  no email is sent, and no support access is actually granted.
- Include search/filter URL state, responsive layouts, keyboard-accessible
  controls, and empty/loading/error/denied states.
- Link from the existing Super Admin workspace and back without breaking
  Company, Operator, cases, entities, policies, evaluations, or the approved
  brand mark.

## Out of scope

- Supabase/auth imports or calls, hosted settings, actual tenant provisioning,
  membership changes, support impersonation, real user/customer data, email,
  billing, persistence, API, migrations/RLS, logging changes, integrations,
  Vercel configuration, or changes to the evaluation engine.

## Guardrails

- All product copy remains English-first and goes through the typed message
  catalog. Do not add real identities, emails, UUIDs, credentials, or customer
  details to fixtures.
- Treat platform access, tenant authorization, and support access as backend
  enforced in a real system; UI visibility is never authorization.
- Keep audit signal, data-quality/configuration status, policy version, risk
  recommendation, and human customer decision as distinct concepts.
- Do not alter `mitiga-symbol.png` or recreate/recolour the approved mark.

## Acceptance criteria

1. The Super Admin can see a coherent, tenant-safe governance overview without
   receiving individual entity, evaluation, case, or evidence contents.
2. Tenant lifecycle and membership/status controls never claim persistence or
   notification in the prototype.
3. The three product contexts are visibly navigable and their boundaries are
   explained.
4. Existing product routes continue to work on desktop and mobile.
5. `./scripts/check-secrets.sh`, `./scripts/verify-web.sh`, and
   `npm run verify:vercel` pass.

## Required handoff

Create `feat/cursor-platform-tenant-governance-workspace` from
`origin/preview/vercel-adapter`. Use Conventional Commits. Do not merge or
deploy. Include outcome, commits, changed files, checks, security/tenant/audit
impact, migration/rollback notes, limitations, screenshots if available, and a
recommended reviewer.

## Handoff notes (Cursor)

Outcome:
English-first Platform Super Admin tenant-governance workspace: a directory
and detail route for fictional tenants (including Northstar) covering
lifecycle, platform visibility, membership counts, policy posture,
configuration readiness, and audit signals. The UI does not show entity,
evaluation, case, or evidence contents, and local confirmations never claim a
saved change, email, or support grant.

Branch and commit:
`feat/cursor-platform-tenant-governance-workspace` from
`origin/preview/vercel-adapter` (`077922c`). Commits: `c815090` feat(web);
this commit docs(task).

Files changed:
- `apps/web/app/super-admin/tenants/page.tsx`
- `apps/web/app/super-admin/tenants/[id]/page.tsx`
- `apps/web/app/super-admin/page.tsx`
- `apps/web/components/prototype/app-shell.tsx`
- `apps/web/components/prototype/platform-boundary-notice.tsx`
- `apps/web/components/prototype/platform-governance-state.tsx`
- `apps/web/lib/demo/platform-governance.ts`
- `apps/web/lib/demo/session.ts`
- `apps/web/lib/demo/types.ts`
- `apps/web/lib/i18n/messages.ts`
- `docs/tasks/TASK-017-cursor-platform-tenant-governance-workspace.md`

Decisions and assumptions:
- Governance lives at `/super-admin/tenants` and `/super-admin/tenants/:id`,
  linked from the existing Super Admin workspace. Search and lifecycle filters
  are URL state.
- Tenant lifecycle (draft/active/suspended) is distinct from telemetry health
  and from risk score. Membership health is counts only.
- Provision, suspend, reactivate, and support-access are confirmation + toast
  only; fixtures are not mutated. Support copy states no impersonation session
  is created.
- Platform / Company / Operator boundaries are explained on the directory and
  detail screens. UI hiding is not authorization (`platform.admin`).
- Canonical brand mark was not changed.

Checks run and exact results:
- `./scripts/check-secrets.sh` — Secret check passed.
- `./scripts/verify-web.sh` — oxlint clean; `vinext build` succeeded; Web
  verification passed. Routes include `/super-admin/tenants` and
  `/super-admin/tenants/:id`.
- `npm run verify:vercel` (`apps/web`) — Vercel Build Output API v3
  verification passed.

Security/tenant/audit impact:
- No Supabase, API, persistence, email, impersonation, or logging changes.
  Fixtures are fictional and market-neutral (no UUIDs or real customer data).
  Cross-tenant operational records are not displayed. Tenant isolation is
  visual only.

Migration and rollback notes:
- No migrations. Rollback is revert of this branch. No deploy was made.

Known limitations:
- Existing Super Admin usage meters still use plan-consumption presentation
  from earlier fixtures; the new governance views do not treat score as tenant
  health.
- Screenshots were not captured. Interactive browser click-through of dialogs
  was not available in this agent session.

Recommended reviewer:
Codex (merge owner), with an independent check that governance copy never
implies persistence, email, support impersonation, or access to tenant
operational records.

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

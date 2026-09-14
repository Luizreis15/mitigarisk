# TASK-018 — Cursor authenticated workspace experience

## Objective

Turn the minimal real `/workspace` landing page from TASK-015 into a clear,
accessible authenticated workspace experience while preserving its current
server-derived identity and membership boundary. This task improves truthful
presentation only; it does not introduce tenant selection or operational data.

## Context

TASK-015 made `/workspace` the only real protected product route. It displays
the verified session email and a server-derived active-membership count, while
all other product routes remain explicitly fictional previews. The next
backend task will add tenant-scoped authorization and selection. This task must
prepare a reusable UI without anticipating or weakening that security work.

## In scope

- Work only in `apps/web/app/workspace/**`,
  `apps/web/components/workspace/**`, `apps/web/lib/domain/workspace-access.ts`,
  `apps/web/lib/i18n/**`, `apps/web/tests/domain/**`,
  `apps/web/tests/app/**`, and this task file.
- Refactor the current `/workspace` presentation into reusable server-safe
  components for the existing states: platform administrator, one or more
  active memberships, and no active membership.
- Preserve the verified email, server-derived membership count, explicit
  sign-out action, and visibly separate sample-data entry delivered by
  TASK-015.
- Explain in English that tenant-specific navigation is unavailable until a
  verified tenant context is selected by the server. Do not render tenant
  names, tenant identifiers, roles, capabilities, or operational records.
- Provide responsive, keyboard-accessible focus/order and clear status copy
  for authenticated, empty, configuration-unavailable, and unexpected read
  failure states that the current route can truthfully determine.
- Keep all user-facing copy in the typed message catalog and keep the view
  model pure and testable.
- Add tests for state classification, pluralization/presentation inputs, and a
  source-boundary check proving workspace client components do not import
  Supabase modules or privileged configuration.

## Out of scope

- New Supabase queries or imports, tenant selection, tenant routes, middleware,
  capability checks, database writes, hosted Auth changes, real user or tenant
  creation, operational entity/evaluation/case/policy data, fixture identity
  presented as real, migrations/RLS/RPC changes, email, Vercel configuration,
  deployment, analytics, or changes to prototype routes.

## Guardrails

- The route must continue to call `requireAuthenticatedIdentity()` before
  rendering authenticated content.
- Values passed into presentation components are server-derived. A component
  must not infer authorization from URL state, browser storage, a role label,
  or hidden controls.
- The sample-data entry remains visibly fictional and must not look like an
  authenticated tenant workspace.
- Never include real email addresses, user IDs, tenant IDs, credentials, or
  customer data in tests, screenshots, copy, or commits.
- Do not alter the approved brand mark or any route outside `/workspace`.

## Inputs and dependencies

- Start from `origin/preview/vercel-adapter` at or after `db1b8aa`, which
  contains TASK-015 and TASK-017.
- Reuse the existing workspace access classifier, sign-out Server Action,
  protected-route primitive, UI components, and typed message catalog.
- Do not depend on TASK-019. TASK-019 is intentionally the later integration
  step that adds server-authorized tenant selection.

## Acceptance criteria

1. `/workspace` presents every existing real access state clearly on desktop
   and mobile without inventing tenant context.
2. Verified identity and membership count remain server-derived, and the page
   remains fail-closed before authenticated content renders.
3. The page clearly distinguishes the authenticated workspace from the
   fictional sample-data preview.
4. No Supabase query, authorization rule, hosted setting, migration, or
   persistent mutation is introduced.
5. Existing routes and the real sign-in, password-reset, and sign-out flows
   remain buildable.
6. `npm test`, TypeScript, secret scanning, web verification, and Vercel build
   output verification pass.

## Required verification

Run and report exact results for:

```text
cd apps/web && npm test
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npm run verify:vercel
./scripts/check-secrets.sh
./scripts/verify-web.sh
```

Also manually inspect `/workspace` at narrow and wide viewport widths if a
browser is available. State explicitly when browser inspection or screenshots
are unavailable.

## Security, tenant, privacy, audit, and rollback impact

- Tenant isolation: unchanged; this task displays only an aggregate count and
  never accepts or exposes a tenant context.
- Authorization: unchanged and server-side; UI state is not authorization.
- Privacy: verified email remains the only personal value displayed and must
  not be logged or copied into fixtures.
- Auditability: no auditable business mutation occurs.
- Rollback: no migration or hosted change; revert the task commits.

## Required handoff

Create `feat/cursor-authenticated-workspace-experience` from the required base.
Use Conventional Commits. Do not merge or deploy. Append the standard handoff
to this file with outcome, branch and commits, files changed, decisions and
assumptions, exact checks, security/tenant/privacy/audit impact,
migration/rollback notes, known limitations, screenshots if available, and
recommended reviewer.

## Handoff notes (Cursor)

Outcome:
Implemented in full. `/workspace` now presents the existing real access
states (platform administrator, one or more active memberships, no
membership) plus configuration-unavailable and membership-read failure,
using reusable server-safe components and a pure view model. Tenant names,
IDs, roles, capabilities, and operational records are not rendered. Sample
data remains a visibly fictional preview. No merge or deploy was made.

Branch and commit:
`feat/cursor-authenticated-workspace-experience` from
`origin/preview/vercel-adapter` (`bd86439`). Commits: `760e888` feat(web);
this commit docs(task).

Files changed:
- `apps/web/app/workspace/page.tsx`
- `apps/web/components/workspace/workspace-experience.tsx`
- `apps/web/components/workspace/workspace-frame.tsx`
- `apps/web/components/workspace/workspace-status.tsx`
- `apps/web/components/workspace/workspace-demo-preview.tsx`
- `apps/web/components/workspace/workspace-session-actions.tsx`
- `apps/web/lib/domain/workspace-access.ts`
- `apps/web/lib/i18n/messages.ts`
- `apps/web/lib/i18n/workspace.ts`
- `apps/web/tests/domain/workspace-access.test.ts`
- `apps/web/tests/app/workspace-component-boundary.test.ts`
- `docs/tasks/TASK-018-cursor-authenticated-workspace-experience.md`

Decisions and assumptions:
- `requireAuthenticatedIdentity()` still runs before authenticated content;
  missing public config is classified first and never falls back to a
  fictional session.
- The existing `memberships` count query is unchanged; its `error` now maps
  to `read_failure` instead of a silent empty count.
- Presentation receives only a server-built view model. Components do not
  import Supabase, read URL/search params, or infer authorization.
- Copy states that tenant-specific navigation waits for server-selected
  tenant context (TASK-019 is not anticipated).
- English pluralization uses `one` vs `other` (count === 1 vs rest).
- Tests use the fictional address `example@demo.mitiga.local` only.

Checks run and exact results:
- `cd apps/web && npm test` — 106 tests, 0 fail.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — passed (no diagnostics).
- `cd apps/web && npm run verify:vercel` — `.vercel/output` is genuine Vercel
  Build Output API v3 (config.json v3, Node.js function, static/_next bundle).
- `./scripts/check-secrets.sh` — Secret check passed.
- `./scripts/verify-web.sh` — oxlint clean; `vinext build` succeeded; Web
  verification passed. Route list still includes `/workspace`.
- Browser inspection of `/workspace` at narrow and wide viewports was not
  available in this agent session (no browser tools). Screenshots were not
  captured.

Security/tenant/audit impact:
- Tenant isolation: unchanged; only an aggregate membership count is shown.
- Authorization: unchanged and server-side; UI state is not authorization.
- Privacy: verified email remains the only personal value displayed; it is
  not logged and is not copied into fixtures except the fictional demo
  address above.
- Auditability: no auditable business mutation occurs. Sign-out remains the
  existing Server Action.
- No new Supabase queries, RLS, RPCs, migrations, hosted Auth, Vercel, or
  secret changes.

Migration and rollback notes:
- No migrations. Rollback is revert of the task commits. No deploy was made.

Known limitations:
- `/workspace` still does not select a tenant or expose tenant-scoped
  navigation; that remains TASK-019.
- Membership read failure is only observable when the existing count query
  returns an error for a non-platform-admin identity.
- Visual keyboard/focus verification at 375px and desktop widths was not
  performed here.

Recommended reviewer:
Codex (merge owner), with an independent check that `/workspace` still
fail-closes via `requireAuthenticatedIdentity()`, never renders tenant
context, and that workspace components stay free of Supabase imports.

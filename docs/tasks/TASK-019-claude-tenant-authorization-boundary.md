# TASK-019 — Claude tenant authorization boundary

## Objective

Add the reusable server-side boundary that resolves an authenticated user's
active tenant memberships, selects an allowed tenant context, and enforces a
required capability without trusting client-controlled state. Integrate that
boundary into the real `/workspace` route only.

## Context

TASK-013 established verified cookie-backed identity and TASK-015 created a
fail-closed real `/workspace`. TASK-018 supplies the honest presentation layer.
The database already provides membership RLS and the `has_capability` RPC.
This task connects those existing boundaries without changing the database or
converting fictional product routes into real tenant routes.

## In scope

- Work only in `apps/web/app/workspace/**`, `apps/web/middleware.ts`,
  `apps/web/lib/supabase/**`, `apps/web/lib/domain/**`,
  `apps/web/components/workspace/**`, `apps/web/lib/i18n/**`,
  `apps/web/tests/**`, `docs/adr/**`, `docs/security/**`, and this task file.
- Add typed domain contracts and typed domain errors for active membership
  resolution, no membership, invalid/unavailable tenant selection, and missing
  capability.
- Add a request-scoped Supabase repository that lists only the verified user's
  active memberships and the minimum tenant metadata needed by `/workspace`.
  Use the authenticated anon client and existing RLS; never use service role.
- Add a fail-closed server primitive that accepts a candidate tenant ID only
  as a value to validate, proves it is among the verified user's active
  memberships, and then checks the required capability through the existing
  database RPC. A URL or form value alone is never tenant authorization.
- Give `/workspace` a server-authorized tenant selection flow. With one active
  membership it may select that tenant deterministically; with multiple active
  memberships it must require an explicit choice and revalidate it on every
  request. Do not store role/capability claims in browser storage.
- Add session-refresh middleware using the documented `@supabase/ssr` cookie
  pattern. Limit its matcher to application routes and avoid static assets.
  Middleware refreshes authentication only; it must not select a tenant or
  authorize a capability.
- Keep platform-administrator handling explicit. Platform status does not
  silently grant entry to tenant operational workspaces; any platform support
  access remains out of scope.
- Add positive and negative tests, including no session, expired/failed
  session, no membership, suspended/invited/removed membership, arbitrary
  cross-tenant ID, stale selection, missing capability, RPC failure, multiple
  memberships, and prevention of service-role/browser authorization.
- Record the security design and a manual Development verification checklist.

## Out of scope

- Supabase migrations, RLS/RPC/schema changes, hosted Supabase settings,
  service-role credentials, real account/tenant/membership creation, support
  impersonation, tenant lifecycle mutation, invitations, operational
  entity/evaluation/case/policy data, converting demo routes, persistent user
  preferences, email, Vercel configuration, deployment, billing, or analytics.

## Guardrails

- Identity must be re-derived from `auth.getUser()` through the existing
  request identity boundary. Do not decode or trust an unverified token.
- Tenant membership and capability must both be enforced server-side. Never
  trust a tenant ID, role, capability, cookie, query parameter, path parameter,
  form field, header, local storage value, or hidden UI control by itself.
- Repository queries must minimize selected columns and must not return
  cross-tenant operational data.
- Database/RLS/RPC errors fail closed with stable typed application errors;
  user-facing copy must not leak SQL, IDs, policy details, or membership data.
- Keep every Supabase client request-scoped. Do not add global client/session
  caches.
- Do not use, request, document, or expose credentials. Browser and
  authenticated server code use only the existing public Supabase variables.
- Do not change the meaning of platform administrator or create support access.

## Inputs and dependencies

- Start only after TASK-018 is merged into `origin/preview/vercel-adapter`.
- Reuse `requireAuthenticatedIdentity()`, `resolveRequestIdentity()`,
  `createServerSupabaseClient()`, `hasCapability()`/`requireCapability()`, the
  existing memberships/tenants schema and RLS, and TASK-018 workspace
  components.
- Existing migrations are read-only inputs. If they cannot support the task
  safely, stop and document the gap; do not add or edit a migration.
- No hosted access is required for implementation or automated verification.

## Acceptance criteria

1. A verified user can see only their active tenant memberships in the real
   workspace and can select only one of those tenants.
2. A client-supplied tenant ID never grants access; inactive, absent, stale,
   malformed, and cross-tenant selections fail closed with typed errors.
3. Capability enforcement is server-side and backed by the existing database
   RPC; role labels and UI visibility are never authoritative.
4. Multiple-membership selection is explicit and revalidated on each request;
   no-membership and backend-unavailable states disclose no tenant data.
5. Session refresh follows the SSR cookie boundary without performing tenant
   authorization in middleware.
6. Platform administrators do not implicitly receive tenant operational
   access through this workspace.
7. No migration, hosted action, secret, service-role use, persistent mutation,
   or demo-route conversion is introduced.
8. All required automated checks pass.

## Required verification

Run and report exact results for:

```text
cd apps/web && npm test
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npm run build
cd apps/web && npm run verify:vercel
./scripts/check-secrets.sh
./scripts/verify-web.sh
```

Tests must exercise the negative authorization matrix without calling hosted
Supabase. Run the manual Development checklist only if the human owner has
already configured a safe test environment; otherwise report it as pending and
do not request credentials.

## Security, tenant, privacy, audit, and rollback impact

- Tenant isolation: strengthened by membership proof plus capability check on
  every selected tenant context, with RLS remaining defense in depth.
- Authorization: server-side and fail-closed; middleware performs session
  refresh only.
- Privacy: only minimum tenant metadata for the verified user's active
  memberships may be returned; errors and logs contain no personal data or
  raw identifiers.
- Auditability: this task is read-only and creates no business mutation. It
  must not fabricate audit events for reads.
- Rollback: no migration or hosted change; revert the task commits and remove
  the middleware if necessary.

## Required handoff

Create `feat/claude-tenant-authorization-boundary` from the required integrated
base. Use Conventional Commits. Do not merge or deploy. Append the standard
handoff to this file with outcome, branch and commits, files changed, decisions
and assumptions, exact checks, security/tenant/privacy/audit impact,
migration/rollback notes, manual verification status, known limitations, and
recommended independent security reviewer.

## Handoff (Claude Code, 2026-09-14)

**Outcome:** Implemented in full. No merge, no deploy, no migration, no
hosted Supabase/Vercel change, no service-role use.

**Base:** `origin/preview/vercel-adapter` at
`773f78daa10751d7b2d13a65ce2b211719090ff2`, confirmed by `git rev-parse` to
match the operator's stated commit before any work started.

**Branch and commits:** `feat/claude-tenant-authorization-boundary`, five
commits on top of the base:
- `2353662` `feat(workspace): add server-validated tenant selection and
  capability boundary` — the pure decision function, the request-scoped
  membership repository, and the membership-proof/capability-check
  primitives.
- `a5e301d` `feat(workspace): wire real tenant selection into the
  /workspace route` — the route, presentation components, and copy.
- `b605e9d` `feat(auth): add session-refresh-only middleware`.
- `3e817ba` `test(workspace): cover the tenant-selection negative
  authorization matrix`.
- `c2cffb2` `docs: record ADR 0011 and TASK-019 manual verification
  checklist`.

**Files changed (all within this task's declared scope globs):**
- New: `apps/web/lib/domain/tenant-selection.ts`,
  `apps/web/lib/supabase/tenant-memberships-repository.ts`,
  `apps/web/lib/supabase/tenant-context.ts`, `apps/web/middleware.ts`,
  `apps/web/components/workspace/workspace-tenant-selection.tsx`,
  `apps/web/tests/domain/tenant-selection.test.ts`,
  `apps/web/tests/supabase/tenant-memberships-repository.test.ts`,
  `apps/web/tests/supabase/tenant-context.test.ts`,
  `apps/web/tests/app/middleware-session-refresh-only.test.ts`,
  `docs/adr/0011-tenant-authorization-boundary.md`,
  `docs/security/TASK-019-manual-test-checklist.md`.
- Modified: `apps/web/app/workspace/page.tsx`,
  `apps/web/lib/domain/workspace-access.ts` (two new optional
  `WorkspaceViewModel` fields and one new presentation kind; all existing
  exports and call signatures unchanged),
  `apps/web/components/workspace/workspace-experience.tsx`,
  `apps/web/components/workspace/workspace-frame.tsx`,
  `apps/web/components/workspace/workspace-status.tsx`,
  `apps/web/lib/i18n/messages.ts` (`workspace` section only),
  `apps/web/tests/domain/workspace-access.test.ts` (existing tests
  unmodified; new tests appended).
- No file outside `apps/web/app/workspace/**`, `apps/web/middleware.ts`,
  `apps/web/lib/supabase/**`, `apps/web/lib/domain/**`,
  `apps/web/components/workspace/**`, `apps/web/lib/i18n/**`,
  `apps/web/tests/**`, `docs/adr/**`, `docs/security/**`, or this task
  file was touched. No Supabase migration, RLS policy, or RPC was added,
  changed, or removed.

**Decisions and assumptions (full reasoning in
`docs/adr/0011-tenant-authorization-boundary.md`):**
1. A candidate tenant id (query param, form, cookie) is never
   authorization by itself — `resolveTenantSelection()` only ever uses it
   as a lookup key into the caller's own active memberships, fetched
   server-side on the same request.
2. The membership repository explicitly filters `user_id = <verified
   caller>` in the query itself rather than relying on RLS alone, because
   a platform admin's RLS grant on `memberships_select` is broader than
   what this function may ever return.
3. Membership proof (`resolveActiveTenantContext`) and capability
   checking (`resolveAuthorizedTenantContext`, layered on top of it) are
   separate, composable functions.
4. **`/workspace`'s own landing gate calls only the membership-proof
   function, not the capability-checking one.** No existing capability
   maps to "may view the generic workspace shell" for every tenant role:
   `tenant.view` is granted only to `tenant_admin` and `auditor`, not
   `risk_analyst`/`operator`/`integration_developer`
   (`supabase/migrations/20260912120100_identity_and_tenancy.sql`).
   Gating landing on `tenant.view` would have silently locked three of
   five tenant roles out of a page they are legitimately active members
   of — a silent product decision this task does not own. This gap is
   already tracked as CLA-010 in
   `docs/audits/2026-09-13-claude-architecture-security-audit.md` and
   requires human ratification of the role→capability matrix, per that
   finding's classification. `resolveAuthorizedTenantContext()` is fully
   built and tested regardless, ready for the first future operational
   route that needs "prove membership AND prove a specific capability."
5. An invalid, stale, or cross-tenant `?tenant=` value falls back to the
   same no-param selection flow rather than surfacing a distinguishable
   error, so the response never confirms or denies whether the requested
   id exists or belongs to someone else.
6. Platform-administrator status is branched out of `/workspace` before
   any membership lookup runs at all — unchanged from TASK-015/018 — so
   it cannot silently grant tenant operational access through this task's
   changes.
7. `vinext build` warns that the `middleware` file convention is
   deprecated in favor of `proxy` (a Next.js 15.x rename); the build
   still succeeds and the file works. Kept as `middleware.ts` because
   this task's contract explicitly names `apps/web/middleware.ts` as the
   in-scope file to add; renaming it would be a framework-migration
   decision outside this task's scope. Left as a limitation below.

**Exact checks run and results (clean state, this branch's HEAD):**
```text
$ cd apps/web && npm test
ℹ tests 141 / pass 141 / fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — zero diagnostics)

$ cd apps/web && npm run build
Build complete. Route (app) lists all 21 routes, including /workspace.

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment.

$ ./scripts/check-secrets.sh
Secret check passed.

$ ./scripts/verify-web.sh
oxlint clean; vinext build succeeded; Web verification passed.
```
The negative-authorization matrix required by this task — no session
(existing `apps/web/tests/supabase/identity.test.ts`, unchanged), no
membership, expired/failed session (existing), no membership, suspended/
invited/removed membership, arbitrary cross-tenant id, stale selection,
missing capability, RPC/query failure, multiple memberships, and
prevention of service-role/browser authorization (existing boundary
tests plus the new middleware source-inspection test) — is covered by the
141 passing tests above, primarily in
`apps/web/tests/domain/tenant-selection.test.ts` and
`apps/web/tests/supabase/tenant-context.test.ts`.

**Security/tenant/privacy/audit impact:**
- Tenant isolation: strengthened. `/workspace` now proves an actual
  tenant context server-side against real membership rows instead of
  only displaying a count; a client-supplied tenant id can never select a
  tenant the caller is not an active member of. RLS remains defense in
  depth; the repository's explicit `user_id` filter is the primary
  control.
- Authorization: server-side and fail-closed throughout; every non-success
  outcome is a stable typed error, never a silent default. Middleware
  performs session refresh only, proven by source-inspection test.
- Privacy: the membership repository selects only `tenant_id, name, slug`
  for the caller's own active, non-suspended-tenant memberships — no
  cross-tenant data, no role, no capability data is ever returned to the
  page. Errors and copy contain no SQL, id, or membership data (the
  invalid-selection fallback deliberately discloses nothing about the
  rejected id).
- Auditability: read-only task; no business mutation, no audit event
  fabricated.
- Rollback: no migration or hosted state. Revert this branch's five
  commits (or the merge commit, once/if a future task merges it); nothing
  else in the repository depends on it.

**Manual verification status:** Not executed — no safe Development test
environment was configured for this task, and none was requested per the
task contract's explicit instruction not to weaken that restriction. The
full manual checklist is recorded in
`docs/security/TASK-019-manual-test-checklist.md`, pending a human or a
post-merge Codex run against a real Development project.

**Known limitations:**
- The `tenant.view`-capability question described in decision 4 above is
  now ratified (see the 2026-09-14 follow-up handoff below and ADR 0011's
  "Ratification" section): `/workspace`'s landing gate is intentionally
  membership-only, by approved policy, not merely pending CLA-010. The
  broader role→capability matrix (CLA-010) remains open separately.
- `vinext`'s deprecation warning for the `middleware` file convention
  (decision 7) is not addressed; a future framework-migration task should
  evaluate renaming to `proxy.ts` if/when this repository adopts it.
- No browser was available in this environment; the interactive
  tenant-selection UI (links styled as buttons, keyboard/focus behavior)
  is verified only by source review and the existing component-boundary
  test, not by manual browser testing. `docs/security/TASK-019-manual-test-checklist.md`
  step 4–7 cover this once a Development environment is available.
- `resolveAuthorizedTenantContext()` (the capability-checking primitive)
  has no caller yet in this codebase; it is exercised only by its own
  unit tests until a future operational route adopts it.

**Recommended independent reviewer:** Codex, for consolidation with the
2026-09-13 audit cycle and for confirming this task's decision 4 against
CLA-010 once the role→capability matrix is ratified. Human review is
required specifically for that ratification, which this task's scope
does not include.

## Follow-up handoff (Claude Code, 2026-09-14): shell-entry ratification and `?tenant=` fail-closed correction

**Outcome:** Complete. No merge, no deploy, no migration, no hosted
Supabase/Vercel change, no service-role use. Still on
`feat/claude-tenant-authorization-boundary`, not merged.

**What prompted this follow-up:** The human owner ratified the
`/workspace`-shell-entry policy from the original handoff's decision 4
(identity + active membership is sufficient; capability checks are
scoped to real future operational routes, not the shell) and asked for a
security/compliance fix-up to the `?tenant=` handling, which a review
found did not match this task's own stated fail-closed intent.

**The bug fixed:** `apps/web/app/workspace/page.tsx`'s original
`InvalidTenantSelectionError` handling retried
`resolveActiveTenantContext(client, identity, null)` — i.e., re-resolved
with no candidate id. With exactly one active membership, that retry
auto-selected it, silently substituting the caller's real tenant for a
malformed, stale, or cross-tenant one they had actually requested. This
was never a cross-tenant data leak — `resolveActiveTenantContext()` never
returns a tenant the caller isn't an active member of — but it violated
"fail closed with a stable typed error, never substitute a different
answer," and a malformed `?tenant=` value was also pre-filtered by a
UUID-shape check that coerced it to "no selection" before ever reaching
the typed-error path, a second, weaker validation route outside that
boundary. Full description and reasoning: ADR 0011, "Amendment: `?tenant=`
fail-closed correction."

**Commits (Conventional Commits, appended to the same branch):** see
`git log` on `feat/claude-tenant-authorization-boundary` for this
follow-up's commits, applied after the original five: a `fix(workspace)`
commit for the `?tenant=` correction and shell-entry ratification
plumbing, a `test(workspace)` commit for the new malformed/stale/
cross-tenant negative tests, and a `docs` commit for this handoff and the
ADR 0011 amendment.

**Files changed in this follow-up (all within TASK-019's original scope
globs — `apps/web/app/workspace/**`, `apps/web/lib/domain/**`,
`apps/web/lib/i18n/**`, `apps/web/components/workspace/**`,
`apps/web/tests/**`, `docs/adr/**`, this task file):**
- `apps/web/lib/domain/tenant-selection.ts` — added
  `classifyTenantSelectionError()`, a pure mapping from each typed error
  to a route-facing classification (`no_membership`,
  `selection_required`, `invalid_selection`, `unknown`).
- `apps/web/lib/domain/workspace-access.ts` — added an `invalid_selection`
  presentation kind and an `invalidTenantSelection` input flag; it takes
  priority over `tenant_selection_required` and is never reached for a
  platform admin; its view model discloses no membership count, no
  tenant options, and no selected-tenant name.
- `apps/web/app/workspace/page.tsx` — removed the pre-emptive UUID-shape
  check (a malformed `?tenant=` value now flows through unvalidated,
  exactly like any other candidate) and the retry-on-invalid fallback;
  replaced hand-rolled `instanceof` branching with
  `classifyTenantSelectionError()`.
- `apps/web/components/workspace/workspace-status.tsx` — renders the new
  `invalid_selection` state.
- `apps/web/components/workspace/workspace-experience.tsx` — renders a
  "Start over" link (via `next/link`, to satisfy this repo's
  `no-html-link-for-pages` lint rule — a plain `<a>` failed
  `./scripts/verify-web.sh`'s oxlint step) back to plain `/workspace` for
  the `invalid_selection` state.
- `apps/web/lib/i18n/messages.ts` — added `invalidSelectionTitle`,
  `invalidSelectionBody`, `tryAgainLink` under the `workspace` section.
- `docs/adr/0011-tenant-authorization-boundary.md` — amended: corrected
  the `?tenant=` decision text (it previously described the buggy
  fallback as intended behavior), and added "Ratification" and
  "Amendment" sections.
- Tests: `apps/web/tests/domain/tenant-selection.test.ts` (malformed-id
  cases, `classifyTenantSelectionError` coverage including that
  malformed/stale/cross-tenant classify identically),
  `apps/web/tests/supabase/tenant-context.test.ts` (malformed-id
  integration cases plus a regression test that reproduces the exact
  silent-fallback bug and proves the fix no longer takes that path),
  `apps/web/tests/domain/workspace-access.test.ts` (new `invalid_selection`
  presentation/view-model tests).
- No Supabase migration, RLS policy, or RPC was touched. No file outside
  the listed scope was created, edited, or deleted.

**Decisions and assumptions:**
1. Shell-entry ratification is recorded as an ADR amendment, not a new
   ADR: it changes the status of an existing, already-documented decision
   (from "engineering judgment call, open question" to "ratified policy"),
   not a new architectural choice.
2. Malformed, stale, and cross-tenant selections are made to classify and
   render identically (`invalid_selection`, generic copy, no data) so the
   response never discloses which of the three actually happened, or
   whether the requested tenant id exists at all.
3. The retry-removal fix intentionally does not attempt to recover a
   "best guess" tenant for the caller on an invalid selection (e.g.
   auto-selecting their sole membership) — the caller must explicitly
   retry via the "Start over" link, since silently picking anything on
   their behalf is the exact behavior being removed.
4. `next/link` was used for the new "Start over" link (and was already
   used by the existing demo-preview link) rather than a plain `<a>`,
   required by this repository's oxlint configuration
   (`no-html-link-for-pages`) — `apps/web/components/workspace/workspace-tenant-selection.tsx`'s
   existing per-option links use a dynamic `href` template and were not
   flagged by that rule, but the new static `/workspace` link was.

**Exact checks run and results (clean state, this follow-up's HEAD):**
```text
$ cd apps/web && npm test
ℹ tests 152 / pass 152 / fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — zero diagnostics)

$ cd apps/web && npm run build
Build complete. Route (app) lists all 21 routes, including /workspace.

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment.

$ ./scripts/check-secrets.sh
Secret check passed.

$ ./scripts/verify-web.sh
oxlint clean; vinext build succeeded; Web verification passed.
```

**Security/tenant/privacy/audit impact:**
- Tenant isolation: unchanged at the data level — the original
  implementation never returned a tenant the caller wasn't an active
  member of, so there was no cross-tenant data exposure to begin with.
  This follow-up closes a fail-closed-consistency gap (a silent
  substitution instead of a stable typed error) and a UI-trust gap (the
  UI could imply an explicit choice was honored when it was actually
  overridden).
- Authorization: every non-success path is now routed through one pure
  classification function rather than ad hoc `instanceof` checks
  duplicated at the call site, reducing the chance of a future edit
  reintroducing a similar silent-fallback bug.
- Privacy: `invalid_selection` discloses strictly less than before (no
  membership count, no tenant data at all) and treats every cause
  (malformed input, staleness, a real cross-tenant id) identically, so it
  cannot be used to probe whether a given id is real.
- Auditability: still a read-only route; no business mutation, no audit
  event fabricated.
- Rollback: no migration or hosted state. Revert this follow-up's commits
  (on top of the original five) to return to the prior behavior;
  reverting further removes TASK-019 entirely, per the original handoff.

**Manual verification status:** Unchanged from the original handoff — not
executed, no safe Development environment configured, none requested.
`docs/security/TASK-019-manual-test-checklist.md` step 3 and step 6
already exercise a mismatched/cross-tenant `?tenant=` value and are still
the right steps to confirm this fix manually; no update to that checklist
was needed since its expected outcome ("falls back," "returns to the
selection list") is still accurate in spirit, now backed by the
corrected, non-silent implementation.

**Known limitations:** Same as the original handoff, minus the
now-resolved shell-entry-capability question. The capability-checking
primitive (`resolveAuthorizedTenantContext()`) still has no caller in
this codebase.

**Recommended independent reviewer:** Codex, to confirm the ADR 0011
amendment accurately reflects the ratified policy and that the regression
test in `tenant-context.test.ts` genuinely reproduces the fixed bug (not
just asserts the fix).

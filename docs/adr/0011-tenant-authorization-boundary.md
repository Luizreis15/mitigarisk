# ADR 0011 — Tenant authorization boundary: membership proof, capability check, and what middleware is not for

- Status: accepted
- Date: 2026-09-14

## Context

TASK-013 established verified cookie-backed identity. TASK-015/TASK-018
made `/workspace` a real, protected route that shows only a membership
*count* — it never selected a tenant. The database already has membership
RLS (`supabase/migrations/20260912120160_identity_and_tenancy_rls.sql`)
and the `has_capability` RPC
(`supabase/migrations/20260912120000_extensions_and_helpers.sql`, wrapped
by `apps/web/lib/supabase/authorization.ts`). TASK-019 connects those
existing boundaries: `/workspace` must select a real tenant context, never
trusting a client-supplied tenant id, and the deferred session-refresh
middleware risk named in ADR 0009 must finally be closed — without adding
a second, middleware-based authorization boundary.

## Decisions

**A candidate tenant id is only ever a lookup key, never authorization.**
`apps/web/lib/domain/tenant-selection.ts`'s `resolveTenantSelection()` is a
pure function: it takes the caller's real active memberships (fetched
server-side) and a requested id, and returns one of five outcomes
(`no_membership`, `auto_selected`, `selection_required`, `selected`,
`invalid_selection`). The requested id is never compared against anything
but that caller's own membership list — a well-formed UUID for someone
else's tenant, a suspended/invited/removed membership's tenant, and a
malformed value all collapse to the same `invalid_selection` outcome, so
the page cannot leak whether a given id exists.

**Membership listing is a request-scoped repository, not a raw inline
query.** `apps/web/lib/supabase/tenant-memberships-repository.ts`'s
`listActiveTenantMemberships()` takes the caller's verified `userId` and
the request's own Supabase client (anon key, cookie-bound — never
service-role), and explicitly filters `user_id = <verified id>` in the
query itself rather than relying on RLS alone. This matters because
`memberships_select`'s RLS grant is broader than what this function may
ever return: a platform admin's RLS predicate (`app.is_platform_admin()`)
would let a naive `select *` see every tenant's memberships. The explicit
filter is the primary control; RLS remains defense in depth. The query
also excludes a suspended tenant even when the membership row itself is
`active`, and selects only `tenant_id, name, slug` — the minimum needed to
label a choice.

**The membership-proof primitive and the capability-check primitive are
separate, composable functions**, not one bundled call.
`apps/web/lib/supabase/tenant-context.ts` exports:
- `resolveActiveTenantContext(client, identity, requestedTenantId)` —
  membership proof only; throws `NoActiveTenantMembershipError`,
  `TenantSelectionRequiredError`, or `InvalidTenantSelectionError`.
- `resolveAuthorizedTenantContext(client, identity, requestedTenantId, capability)`
  — membership proof, then `assertCapability()` (the existing
  `has_capability` RPC wrapper) for the proven tenant only, never called
  before membership is proven.

**`/workspace`'s own landing gate calls only the membership-proof
function, not the capability-checking one — a deliberate, documented gap,
not an oversight.** The obvious literal reading of "capability checked via
RPC/RLS" would gate `/workspace` on some capability. The only existing
candidate that reads as "may view this tenant" is `tenant.view`, but
`tenant.view` is granted to `tenant_admin` and `auditor` only
(`supabase/migrations/20260912120100_identity_and_tenancy.sql`) — not
`risk_analyst`, `operator`, or `integration_developer`. Gating the base
workspace landing page on `tenant.view` would silently lock three of five
tenant roles out of a page they are legitimately an active member of, to
satisfy this task's own acceptance-criteria wording. That would be
exactly the "resolve product ambiguity silently" failure this repository's
governance forbids. The role→capability matrix gap is already tracked as
CLA-010 in `docs/audits/2026-09-13-claude-architecture-security-audit.md`
and is a protected human decision. `resolveAuthorizedTenantContext()` is
still built, fully tested, and left ready for the first future route that
needs "prove membership AND prove capability X for it" (an operational
route this task's scope explicitly excludes).

**`/workspace` accepts a `?tenant=` query param, never trusted, always
re-verified.** With one active membership, the page auto-selects it
regardless of the param (and rejects a mismatched param as invalid,
`resolveTenantSelection`'s `invalid_selection` case — a single-membership
account is not exempt from validation). With multiple, the page requires
an explicit choice: `apps/web/components/workspace/workspace-tenant-selection.tsx`
renders one link per active membership to `/workspace?tenant=<id>`. Every
navigation is a fresh server request that re-runs
`resolveActiveTenantContext()` against real membership data — there is no
client-side state, no `localStorage`, no `useSearchParams` read for
authorization (enforced by
`apps/web/tests/app/workspace-component-boundary.test.ts`, which already
covered this for TASK-018 and needed no change for this task). An invalid,
stale, or cross-tenant id silently falls back to the same
no-param selection flow rather than surfacing a distinguishable error, so
the response never confirms or denies whether the requested id was ever
real.

**Middleware refreshes the session and nothing else.**
`apps/web/middleware.ts` implements the documented `@supabase/ssr`
cookie-refresh pattern named as deferred risk in ADR 0009: call
`auth.getUser()`, and if the SDK rotates the access/refresh token, write
the new cookies onto both the request (so this request's own Server
Components see them) and the response (so the browser stores them). It
does not import `tenant-selection.ts`, `tenant-context.ts`,
`authorization.ts`, or `identity.ts`, and never queries a table or calls
an RPC beyond the SDK's own internal refresh call.
`apps/web/tests/app/middleware-session-refresh-only.test.ts` asserts this
by source inspection — the same technique already used for the workspace
component boundary — so a future edit that tries to smuggle tenant or
capability logic into middleware fails a test immediately rather than
creating a second, inconsistent authorization boundary that could
disagree with the route-level one. The matcher excludes `_next/static`,
`_next/image`, and common static-asset extensions.

**Platform-administrator status never reaches tenant-membership
resolution at all.** `/workspace`'s page branches on
`identity.isPlatformAdmin` before calling
`resolveActiveTenantContext()` — a platform admin sees the existing
`platform_admin` notice and the membership-selection code path is not
executed for them in this route. This keeps ADR/TASK-015's existing
platform-admin behavior unchanged and satisfies this task's own guardrail
("Platform status does not silently grant entry to tenant operational
workspaces").

## Consequences

- `apps/web/lib/domain/workspace-access.ts`'s `WorkspaceViewModel` gained
  two new fields (`tenantOptions`, `selectedTenantName`) and one new
  presentation kind (`tenant_selection_required`); all existing exports
  and their call signatures are unchanged, and the previously-passing
  tests in `apps/web/tests/domain/workspace-access.test.ts` pass unmodified.
- A future task that adds a real, tenant-scoped operational route (e.g.
  Company profile, Operator queue) has a concrete, tested pattern for
  "prove membership then check a specific capability"
  (`resolveAuthorizedTenantContext()`) rather than needing to invent one.
- The `tenant.view`-vs-`/workspace` gap identified above is not resolved
  by this task and should not be treated as resolved by a future reader of
  this ADR: it remains open until CLA-010's capability matrix is
  ratified by a human decision.
- No migration, RLS policy, or RPC was added, changed, or removed. Every
  authorization decision in this task composes existing database
  primitives (`memberships` RLS, `has_capability`) rather than
  reimplementing them.

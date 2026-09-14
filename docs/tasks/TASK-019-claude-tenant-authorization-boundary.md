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

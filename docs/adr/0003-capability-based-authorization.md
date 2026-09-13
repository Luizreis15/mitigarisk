# ADR 0003 — Capability-oriented RLS via security-definer helper functions

- Status: accepted
- Date: 2026-09-12

## Context

TASK-002 needed a tenant-isolation and authorization model for every
tenant-owned table. `docs/architecture/PLATFORM-ARCHITECTURE.md` already
states the destination: "Permission capabilities are authoritative; role
names are convenient bundles," and that server-side services must verify
both identity and permission, with RLS as defense in depth.

Two implementation questions remained open: (1) how does an RLS policy
learn which tenant(s) the current user belongs to without a custom JWT
claim (which would require a token-issuing hook not otherwise needed by
this task), and (2) how does a policy check a capability without every
policy re-implementing the same membership/role/capability join.

## Decision

- Capabilities are the unit of authorization (`public.capabilities`,
  17 seeded keys). Roles (`public.roles`, 6 seeded keys, matching
  `docs/architecture/PLATFORM-ARCHITECTURE.md`'s initial role list) are
  bundles via `public.role_capabilities`; no RLS policy ever tests a role
  name directly.
- Tenant membership is derived purely from `public.memberships` (no custom
  JWT claim), read through `app.current_tenant_ids()` and
  `app.has_capability(tenant_id, capability)` — both `SECURITY DEFINER`
  functions in an `app` schema that is never exposed via PostgREST. Being
  security definer lets them read `memberships`/`role_capabilities`
  without re-entering (and risking recursion through) those tables' own
  RLS policies.
- `app.is_platform_admin()` (backed by `public.platform_admins`) is checked
  first inside `has_capability()` so a platform super admin's access is not
  tenant-scoped.
- Because `app.*` is invisible to PostgREST, the two functions a client
  needs to call directly — `has_capability` and `record_audit_event` — are
  exposed as thin `public.*` wrappers
  (`supabase/migrations/20260912120150_authorization_helpers.sql`,
  `20260912120700_audit.sql`). This was caught as a real defect during local
  verification: `apps/web/lib/supabase/authorization.ts` calling
  `client.rpc("has_capability", ...)` would otherwise silently 404 against
  a real Supabase project, since PostgREST only exposes the `public`
  schema by default.

## Consequences

- Every RLS policy in this task follows the same two-line shape:
  `using (app.is_platform_admin() or app.has_capability(tenant_id, '<key>'))`,
  which is easy to review and easy to keep consistent across ~15 tables.
- Adding a capability or role later is a data change (an `INSERT` in a new
  migration), not a schema change.
- The capability/role seed lives in SQL
  (`20260912120100_identity_and_tenancy.sql`) and is mirrored in TypeScript
  (`apps/web/lib/domain/tenancy.ts`) for compile-time safety in application
  code; `apps/web/tests/domain/tenancy-sql-sync.test.ts` fails the build if
  the two drift, since there is no generated-types pipeline yet (see ADR
  0005).
- The specific role → capability grants seeded are an implementation
  default (product has not yet ratified exact permission boundaries per
  role) and should be reviewed against real product requirements before
  any UI is built on top of them.

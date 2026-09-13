# TASK-006 threat model addendum

Extends `docs/security/TASK-002-threat-model.md` (T1-T15) with threats
specific to the auth/tenant-bootstrap RPCs added in
`supabase/migrations/20260913090000_auth_tenant_bootstrap.sql`. Same
scope note applies: no hosted project, credential, or network operation is
involved.

| # | Threat | Mitigation |
|---|---|---|
| T16 | An invited user activates someone else's pending invitation. | `public.accept_invitation()` only matches `user_id = auth.uid() and status = 'invited'`; a mismatch returns "not found" (no row leaked either way). Verified in `030-auth-tenant-bootstrap.sql`. |
| T17 | A user accepting their own invitation also changes their role in the same request. | `app.guard_membership_transition()` explicitly rejects a self-accept (`invited -> active`) that also changes `role_key`, independent of RLS. Verified negatively. |
| T18 | An active (non-invited) member self-suspends, self-removes, or otherwise edits their own membership without admin authority. | The self-service clause in `memberships_update`'s `USING` only matches `status = 'invited'`; once active, RLS matches zero rows for a self-issued update — confirmed via row-count assertion, not just an error path, since RLS denies by silent omission here rather than raising. |
| T19 | A tenant-admin invitation claims a different, real admin as the inviter (`invited_by` forgery) to obscure who actually issued it. | `memberships_insert`'s `WITH CHECK` requires `invited_by is null or invited_by = auth.uid()`. |
| T20 | A tenant invitation grants `platform_super_admin`. | Rejected at three independent layers: `public.invite_member()`'s explicit check, the `memberships_role_is_tenant_scoped` table `CHECK` constraint (applies to every insert/update regardless of code path), and `TENANT_ROLE_KEYS`/`isTenantRoleKey` in the TypeScript layer before any network call is made. |
| T21 | A non-platform-admin bootstraps a tenant by calling the RPC directly (bypassing the TypeScript pre-check). | `public.bootstrap_tenant()` re-checks `public.is_platform_admin()` itself and raises `42501`; the underlying `tenants`/`memberships` inserts are additionally RLS-gated the same way regardless of this check. Verified in `030-auth-tenant-bootstrap.sql`. |
| T22 | A partial failure (e.g. network drop) between creating a tenant, creating its first membership, and writing the audit event leaves an unaudited tenant. | All three writes happen inside one `SECURITY INVOKER` PostgREST RPC call, i.e. one Postgres transaction: `bootstrap_tenant()` either completes all three or none. There is no multi-call choreography on the client side to fail partway through. |
| T23 | A `SECURITY INVOKER` RPC or trigger added by this task silently fails to enforce anything because the invoking role cannot even resolve the `app.*` function it calls (the same class of defect ADR 0003 found for `public.has_capability()`). | Both new call sites (`public.bootstrap_tenant()` calling `is_platform_admin()`, and the `app.guard_membership_transition()` trigger calling `is_platform_admin()`/`has_capability()`) were exercised end-to-end against a real Postgres instance in `030-auth-tenant-bootstrap.sql`; the harness caught the exact `permission denied for schema app` failure twice during implementation, before either fix landed. |

## Residual risk / follow-ups

- `public.set_membership_status()` has no dedicated TypeScript-layer
  capability pre-check (unlike `inviteMember`, which validates the role
  shape before calling out); it relies entirely on the database returning
  "not found" for a forbidden target. This is intentionally minimal per
  ADR 0006 ("RLS and the trigger are the real enforcement boundary") but
  means a caller gets a generic not-found error rather than a specific
  403 — acceptable for a backend contract with no UI yet, worth revisiting
  once an API layer renders this to end users.
- The very first `platform_admins` row for a new environment has no
  RLS-gated creation path by design (ADR-documented bootstrap-of-the-
  bootstrapper problem); see `docs/security/TASK-006-deployment-and-rollback.md`.
- SSO, MFA policy, and session lifecycle are out of scope for this task and
  remain open items against the "Identity and access" bounded context in
  `docs/architecture/PLATFORM-ARCHITECTURE.md`.

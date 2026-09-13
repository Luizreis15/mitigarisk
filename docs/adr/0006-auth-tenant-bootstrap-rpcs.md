# ADR 0006 — Atomic, capability-checked RPCs for auth and tenant bootstrap

- Status: accepted
- Date: 2026-09-13

## Context

TASK-006 requires typed use cases for authenticated request identity,
platform-admin tenant creation, tenant-admin invitations, invite
acceptance, membership activation, and suspension-aware authorization,
each of which must "never trust a client-provided tenant id, actor id,
capability, or role" and must be "server-only, capability-checked, and
emit[] an audit event."

Local verification of the existing schema
(`supabase/tests/010-rls-tenant-isolation.sql`) surfaced a real gap while
implementing this: `app.has_capability()` (ADR 0003) requires an *active*
membership, so a freshly invited user (`status = 'invited'`) has zero
capabilities and could never accept their own invitation under the RLS
policies from `20260912120160_identity_and_tenancy_rls.sql`. There was no
path from "invited" to "active" that didn't require a capability the
invitee, by definition, doesn't yet have.

A second question: how does a multi-step flow (create tenant + create its
first membership + write an audit event) stay atomic and always-audited
when driven from a JavaScript client that could fail or be interrupted
between calls?

## Decision

- Add a narrow, explicit self-accept path: `memberships_update` RLS now
  additionally matches `user_id = auth.uid() and status = 'invited'`, and a
  new trigger, `app.guard_membership_transition()`, decides exactly what
  that (or any other) update attempt may actually change: identity/
  provenance columns (`id`, `tenant_id`, `user_id`, `invited_by`,
  `created_at`) are always frozen; a role change always requires
  `tenant.manage_members`; the *only* status transition a non-admin may
  make is their own `invited -> active`, and not combined with a role
  change in the same statement. Every other transition (suspend,
  reactivate, remove, admin-driven activation) requires
  `tenant.manage_members` or platform admin.
- Add `invited_by` provenance to `memberships_insert`'s `WITH CHECK`:
  `invited_by` must be `null` or the caller's own id, so no one can claim
  someone else did the inviting.
- Wrap each multi-step flow in one `SECURITY INVOKER` PostgREST RPC so it
  runs as a single call and a single transaction:
  `public.bootstrap_tenant()`, `public.invite_member()`,
  `public.accept_invitation()`, `public.set_membership_status()`. Each ends
  by calling `public.record_audit_event()` itself, so the audit event and
  the write it describes can never diverge because a client-side second
  call was skipped or failed.
- `SECURITY INVOKER` (not `DEFINER`) is deliberate: these RPCs still go
  through the same RLS policies and triggers as any other write by that
  user. The explicit `is_platform_admin()`/role checks inside them exist
  only for a clean, early error message — RLS and the trigger are the real
  enforcement boundary, consistent with ADR 0003's stance on triggers vs.
  application discipline.
- This reproduced the exact PostgREST-exposure defect ADR 0003 already
  documented: a `SECURITY INVOKER` function (or trigger, in the case of
  `app.guard_membership_transition()`) cannot even name-resolve a
  schema-qualified `app.*` call, because the invoking role
  (`authenticated`) has no `USAGE` on schema `app`. Both call sites were
  fixed the same way ADR 0003 fixed `public.has_capability()`: add
  `public.is_platform_admin()` as a thin `SECURITY DEFINER` wrapper, and
  make `app.guard_membership_transition()` itself `SECURITY DEFINER`.
- `apps/web/lib/supabase/identity.ts` resolves the caller's identity from
  `client.auth.getUser()` (which re-validates the access token against
  Supabase Auth) and `public.is_platform_admin()` — never from a
  client-supplied user id or a locally-decoded, unverified JWT claim.

## Consequences

- An invitee can accept their own invitation with no capability grant of
  any kind, closing the gap described above, while every other membership
  mutation still requires admin authority — verified positively and
  negatively in `supabase/tests/030-auth-tenant-bootstrap.sql` (15
  assertions, including that a self-accept cannot smuggle a simultaneous
  role change, and that an active member cannot self-suspend).
- `apps/web/lib/supabase/tenant-bootstrap.ts` and `memberships.ts` are thin:
  each function validates plain input shape (slug format, tenant-scoped
  role) and calls exactly one RPC. There is no risk of "created the tenant
  but forgot to audit it," because that was never two separate steps from
  the client's point of view.
- No service-role key is used anywhere in this task: every RPC runs
  `SECURITY INVOKER` as the caller's own RLS-respecting session, matching
  TASK-006's explicit out-of-scope list.
- A future flow that needs a *different* self-service transition (e.g. a
  user deactivating their own account) must add it explicitly to
  `app.guard_membership_transition()` — the default for anything not named
  there is admin-only, which is the intended fail-closed posture.

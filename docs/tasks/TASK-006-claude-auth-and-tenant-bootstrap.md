# TASK-006 — Claude authentication and tenant bootstrap foundation

## Objective

Implement server-side contracts for secure Supabase authentication, request-scoped
identity, and auditable tenant/bootstrap flows without applying anything to the
hosted Supabase project.

## Scope

- Work only in apps/web/lib/domain/**, apps/web/lib/supabase/**, apps/web/tests/**,
  supabase/**, docs/adr/**, docs/security/**, and this task file.
- Define typed use cases for authenticated request identity, platform-admin tenant
  creation, tenant-admin invitations, invite acceptance, membership activation,
  suspension-aware authorization, and auditable bootstrap events.
- Add forward-only migrations and local SQL tests only when required.
- Never trust a client-provided tenant id, actor id, capability, or role.
- Document a future hosted-project deployment procedure and rollback boundaries.

## Out of scope

- supabase link, supabase db push, hosted migration application, service-role
  keys, Resend delivery, SSO configuration, frontend screens, billing, and all
  external network calls.

## Acceptance criteria

1. Browser code remains RLS-bound and uses public Supabase configuration only.
2. Tenant bootstrap is server-only, capability-checked, and emits an audit event.
3. Invitations cannot cross tenant boundaries or assign platform-admin by membership.
4. New migrations pass the disposable local PostgreSQL suite.
5. Domain tests, TypeScript checks, secret scan, and local SQL verification pass.
6. No hosted service changes and no credential values enter Git.

## Required handoff

Commit on feat/claude-auth-tenant-bootstrap using Conventional Commits. Add the
standard handoff: outcome, commits, changed files, checks, security/tenant impact,
migration and rollback notes, limitations, and a recommended reviewer. Do not merge.

## Handoff (2026-09-13, Claude Code)

Outcome: implemented in full. Branch created from current `main` (not the
stale `feat/claude-platform-foundation`), since `main` already contains
TASK-002's merged and subsequently hardened schema (English-first defaults,
actor-provenance triggers, cross-tenant composite FKs — see
`supabase/migrations/20260912120800_security_and_english_first_hardening.sql`).

Branch and commits: `feat/claude-auth-tenant-bootstrap`, `391e07e` (RPCs +
SQL verification), `d27e5d8` (TS use cases), `f9d89a6` (domain unit tests),
`2ca06f8` (ADR 0006, threat-model addendum, deployment/rollback doc).

Files changed: `supabase/migrations/20260913090000_auth_tenant_bootstrap.sql`,
`supabase/tests/030-auth-tenant-bootstrap.sql`,
`apps/web/lib/domain/{identity,tenant-bootstrap}.ts` (new),
`apps/web/lib/domain/tenancy.ts` (+`TENANT_ROLE_KEYS`, `isTenantRoleKey`,
`canTransitionMembershipStatus`), `apps/web/lib/domain/index.ts`,
`apps/web/lib/supabase/{identity,tenant-bootstrap,memberships}.ts` (new),
`apps/web/tests/domain/{membership-transitions,tenant-role,tenant-bootstrap}.test.ts`
(new), `docs/adr/0006-auth-tenant-bootstrap-rpcs.md`,
`docs/security/TASK-006-{deployment-and-rollback,threat-model-addendum}.md`.

Decisions and assumptions (full rationale in ADR 0006):
- Closed a real gap found during verification: `app.has_capability()`
  requires an *active* membership, so an invited user had no capability at
  all and could never accept their own invitation. Added a narrow
  self-accept RLS path plus `app.guard_membership_transition()` to decide
  exactly what that (or any admin) update may change.
- Wrapped each multi-step flow (tenant+membership+audit,
  invite+audit, accept+audit, status-change+audit) in one `SECURITY
  INVOKER` PostgREST RPC per flow so it is one atomic transaction, never
  client-choreographed multiple calls. No service-role key is used
  anywhere — every RPC runs as the caller's own RLS-respecting session.
- Reproduced and fixed, twice, the same class of defect ADR 0003 first
  found: a `SECURITY INVOKER` function/trigger cannot name-resolve a
  schema-qualified `app.*` call (no `USAGE` on schema `app`). Fixed via
  `public.is_platform_admin()` (new wrapper) and making
  `app.guard_membership_transition()` itself `SECURITY DEFINER`.
- Tenant invitations are scoped to users who already have an `auth.users`
  row (no email-invite/Resend flow, per this task's explicit out-of-scope
  list); `docs/security/TASK-006-deployment-and-rollback.md` also flags
  that the very first `platform_admins` row in any environment needs a
  direct, non-RLS-gated insert by an operator — a deliberate
  bootstrap-of-the-bootstrapper step.

Checks run and exact results (matching `.github/workflows/quality.yml`
exactly, all green on this branch):
- `./supabase/tests/run-local-verification.sh` — all migrations apply; all
  assertions pass across `010-rls-tenant-isolation.sql`,
  `020-integration-hardening.sql`, and the new `030-auth-tenant-bootstrap.sql`
  (15 new assertions).
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — no errors.
- `cd apps/web && npm test` (`node --test`) — 16/16 pass.
- `./scripts/check-secrets.sh` — "Secret check passed."
- `./scripts/verify-web.sh` (oxlint with the same ignore patterns CI uses,
  plus `vinext build`) — lint clean, build succeeds.
- `cd apps/web && npm audit --omit=dev --audit-level=high` — 0 vulnerabilities.

Security/tenant/audit impact: every new write path is capability-checked
and produces exactly one audit event per action, atomically. Invite
acceptance is self-service but cannot smuggle a role change or act on
anyone else's membership; every other membership mutation still requires
`tenant.manage_members` or platform admin, verified negatively including
that an *active* member cannot self-suspend (RLS silently matches zero
rows, confirmed via row-count assertion, not just an error path). No
secret, credential, or live network operation was introduced.

Migration and rollback notes: `20260913090000_auth_tenant_bootstrap.sql` is
additive (two RLS policies replaced, not altered in place; their prior
definitions remain intact in `20260912120160_identity_and_tenancy_rls.sql`
for exact restoration). Full rollback steps, and a future hosted-project
deployment procedure, are in
`docs/security/TASK-006-deployment-and-rollback.md`.

Known limitations: `public.set_membership_status()` has no TS-layer
capability pre-check (relies on the database's "not found" response);
tenant invitations require the invitee to already have an `auth.users` row;
no generated Supabase types (unchanged from TASK-002 — Docker required).

Recommended reviewer: an independent agent for the RLS/RPC design
(security-sensitive per `docs/governance/MULTI-AGENT-DEVELOPMENT.md`), plus
whoever owns the eventual invitation UX to confirm the "invitee must
already exist" assumption is acceptable before an API layer is built on
top of it.

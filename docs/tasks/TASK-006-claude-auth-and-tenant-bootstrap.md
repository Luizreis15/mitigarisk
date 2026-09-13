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

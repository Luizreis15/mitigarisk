# TASK-006 — future hosted-project deployment procedure and rollback boundaries

This task never touches a hosted Supabase project, never uses `supabase
link`/`supabase db push`, and never handles a service-role key or other
credential — all of that is explicitly out of scope. This document exists so
a later, authorized task (or a human operator) has a concrete procedure to
follow, and so this task's own rollback boundary is explicit.

## Preconditions before any hosted deployment

1. A human with Supabase project access performs `supabase link` locally or
   in CI with a project reference and credentials that never enter this
   repository (`docs/governance/MULTI-AGENT-DEVELOPMENT.md`: "protected
   decision boundaries" include production access).
2. `./supabase/tests/run-local-verification.sh` passes on the exact commit
   being deployed (it already must, per CI's `database-quality` job).
3. `docs/security/TASK-002-threat-model.md` and this task's ADRs
   (`docs/adr/0002`–`0006`) have been reviewed by someone other than the
   author, per the governance doc's independent-review requirement for
   security-sensitive changes.
4. Confirm the target project's `auth` schema already provides
   `auth.uid()`/`auth.role()`/`auth.users` (every real Supabase project
   does) — the local verification harness's shim
   (`supabase/tests/000-local-auth-shim.sql`) must never be applied to a
   real project.

## Deployment procedure (to be executed by an authorized operator, not by this task)

1. `supabase link --project-ref <ref>` against the target project (staging
   first, always).
2. `supabase db push` (or `supabase migration up` against a remote) to
   apply every file under `supabase/migrations/` in filename order. All
   migrations in this repository as of this task are additive
   (`create table/function/policy ... if not exists` or
   `create or replace`) — none contain a `drop table`, `drop column`, or
   other destructive statement.
3. Do **not** run `supabase/seed.sql` against staging or production: it
   creates fictional `auth.users` rows and is development-fixture data
   only (`docs/architecture/PLATFORM-ARCHITECTURE.md`: "Production data is
   not used in development fixtures.").
4. Verify with the same RLS/immutability suites this task already runs
   locally, pointed at the newly migrated project instead of the local
   ephemeral cluster (same SQL, different `--db-url`), before promoting
   staging state to production.
5. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` (name only — no value ever committed) in the
   deployment platform's secret store for the target environment
   (`apps/web/lib/supabase/env.ts` reads these by name).
6. Platform admin bootstrap: the very first `platform_admins` row for a new
   environment cannot be created through `public.bootstrap_tenant()` (which
   requires an existing platform admin to call it) or any RLS-gated path —
   it must be inserted once, directly, by an operator with direct database
   access outside the application's RLS-bound clients. This is a deliberate
   bootstrap-of-the-bootstrapper step, not an oversight.

## Rollback boundaries

Every migration in this task (`20260913090000_auth_tenant_bootstrap.sql`)
is additive: two RLS policies were replaced (`memberships_insert`,
`memberships_update`) rather than altered in place, and their prior
versions are fully recorded in
`20260912120160_identity_and_tenancy_rls.sql`. To roll back after a hosted
deployment:

1. Recreate `memberships_insert`/`memberships_update` exactly as defined in
   `20260912120160_identity_and_tenancy_rls.sql`.
2. `drop trigger trg_memberships_transition_guard on public.memberships;`
   then `drop function app.guard_membership_transition();`.
3. `drop function public.bootstrap_tenant(text, text, uuid);`,
   `drop function public.invite_member(uuid, uuid, text);`,
   `drop function public.accept_invitation(uuid);`,
   `drop function public.set_membership_status(uuid, text);`,
   `drop function public.is_platform_admin();`.
4. No data migration or backfill is required for this rollback: no column
   was added, renamed, or dropped, and no existing row's shape changed.
   Any tenant/membership/audit rows created via the new RPCs remain valid
   rows under the prior schema — they simply lose the RPC entry points that
   created them.

Rolling back does not require rolling back any earlier migration in this
repository: `20260913090000` depends on functions and tables from
`20260912120000`–`20260912120800`, but nothing after it in this task
depends on anything it added, so it can be removed in isolation.

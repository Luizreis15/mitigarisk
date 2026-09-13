# TASK-013 — Development environment variables and post-merge follow-up

This task adds the application-side code boundary for real Supabase
email/password authentication. It does not enable any hosted Auth
provider setting, create any real user, or touch a hosted Supabase
project. This document names the environment variables the code expects
and gives the exact manual steps a human owner or Codex must perform
after this branch merges, before the auth foundation is actually usable
end to end.

## Development environment variables (names only — no values here or in Git)

Already required by the existing Supabase boundary
(`apps/web/lib/supabase/env.ts`) and unchanged by this task:

- `NEXT_PUBLIC_SUPABASE_URL` — the Development Supabase project's URL.
  Public by design.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the Development project's anonymous
  (publishable) key. Public by design; every table it can reach is still
  gated by RLS server-side
  (`docs/architecture/PLATFORM-ARCHITECTURE.md`, "Supabase boundary").

No new environment variable is introduced by this task.
`SUPABASE_SERVICE_ROLE_KEY` is not read by any file this task added or
changed — see `docs/adr/0009-supabase-auth-session-foundation.md` and
`apps/web/tests/supabase/no-service-role-in-client-boundary.test.ts` /
`server-browser-guard.test.ts`, which both assert this directly.

## Required hosted configuration (human owner approval required)

Per this task's explicit product decision, the Development/MVP proposal is
email + password, email confirmation, password recovery, and explicit
sign-out; SSO is out of scope. Before the code in this branch can complete
a real sign-in end to end, a human owner must, in the Development Supabase
project's dashboard only (never Production, and never performed by an
agent):

1. Confirm the Email provider is enabled under Authentication → Providers,
   with "Confirm email" turned on (email confirmation is part of the
   Development/MVP proposal this task assumes).
2. Set the Site URL and Redirect URLs (Authentication → URL Configuration)
   to the Development/preview origins that will host
   `apps/web/app/**`'s eventual real sign-in UI — this task does not add
   that UI yet (a future UI integration task switches the existing
   prototype pages over; see `docs/tasks/TASK-013-claude-supabase-auth-session-foundation.md`,
   acceptance criterion 3).
3. Leave every other provider (SSO, phone, etc.) disabled — out of scope
   for this task and the Development/MVP proposal.

## Creating the Northstar test tenant and membership (after merge, manual)

This task does not create any tenant, membership, or real user — no
hosted action is permitted. Once a human owner has completed the hosted
configuration above and the first real user has confirmed their email,
follow these steps to stand up the "Northstar" test tenant using the
existing TASK-006 bootstrap RPCs
(`supabase/migrations/20260913090000_auth_tenant_bootstrap.sql`):

1. **Create the first real user.** Sign up once through Supabase's own
   dashboard (Authentication → Users → Add user) or a real sign-in flow
   once wired, using a real, human-owned email address — never a fixture
   or shared credential. Confirm the email.
2. **Bootstrap the platform admin (one-time, per environment).** The very
   first `platform_admins` row in a fresh environment has no RLS-gated
   creation path by design (see `docs/security/TASK-006-deployment-and-rollback.md`,
   "bootstrap-of-the-bootstrapper problem"): insert it directly with
   database access outside the app's RLS-bound clients —
   `insert into public.platform_admins (user_id) values ('<the user's auth.users.id>');`
   — for whichever user should hold platform-admin authority to run the
   next step. This is a deliberate one-time exception, not a pattern to
   repeat for ordinary tenant admins.
3. **Bootstrap the Northstar tenant.** As that platform admin (a real,
   authenticated session — never the service role), call the existing
   RPC: `select public.bootstrap_tenant('Northstar', 'northstar', '<the
   initial tenant admin's auth.users.id>');`. This atomically creates the
   tenant, its first active `tenant_admin` membership, and an audit event
   (`docs/adr/0006-auth-tenant-bootstrap-rpcs.md`). The initial admin can
   be the same user as step 2, or a different real user.
4. **Invite additional Northstar members as needed** with
   `public.invite_member(...)` /`public.accept_invitation(...)`, the same
   RPCs TASK-006 added — no new mechanism is required.

None of the four steps above is performed by this task or by any
automated agent; they require a human owner's Supabase dashboard access
and are listed here so Codex (or whoever picks this up post-merge) has an
exact, unambiguous procedure rather than having to reverse-engineer it
from the schema.

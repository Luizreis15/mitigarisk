# TASK-013 — Claude Supabase authentication and session foundation

## Objective

Implement the application-side foundation for real Supabase email/password
authentication and authenticated request identity, replacing the current
prototype-only sign-in boundary without enabling any hosted Auth provider
settings or creating real users.

## Product decision for this task

The Development/MVP proposal is email + password, email confirmation, password
recovery, and explicit sign-out. SSO is out of scope. This task implements the
code boundary only; a human owner must approve any hosted Auth policy/config
change before enablement beyond Development.

## In scope

- Work only in `apps/web/app/**`, `apps/web/lib/supabase/**`,
  `apps/web/lib/domain/**`, `apps/web/tests/**`, `docs/adr/**`,
  `docs/security/**`, dependency manifests/lockfile if required, and this task.
- Establish a safe browser/server session boundary using public Supabase URL and
  anon/publishable configuration only.
- Add typed, testable use cases for sign-in, sign-out, password-reset request,
  authenticated identity resolution, and session absence/expiry.
- Add route protection primitives so a later route can require an authenticated
  user and return a stable unauthenticated result without relying on client
  role state.
- Keep tenant authorization database-backed: use the existing request-scoped
  identity and capabilities/memberships; do not trust a role or tenant id from
  a form, query parameter, cookie, or local storage.
- Retain an explicit prototype/demo mode only if it is impossible to remove
  without blocking current preview review; it must be visibly labelled and
  never silently impersonate an authenticated user.
- Add unit/integration-boundary tests for success/error mapping, no-session,
  expired session, and prevention of browser service-role use.
- Document Development env variables by name only and the exact follow-up steps
  for manually creating the Northstar test tenant and membership after merge.

## Out of scope

- Hosted Supabase Auth settings, real user creation, password delivery,
  provider enablement, Supabase migrations/RLS edits, service-role keys, Resend,
  email templates, SSO, Vercel secret entry, billing, and case/evaluation data
  persistence.

## Security requirements

- Never add credential values, `SUPABASE_SERVICE_ROLE_KEY`, database URLs, or
  Resend values to code, tests, logs, commits, or documentation.
- Use only public Supabase configuration from browser code; privileged clients
  are not required for this task.
- Session/identity must be derived from the verified Supabase session, never a
  decoded unverified token or UI fixture.
- Do not change database authorization policy or bypass RLS.

## Acceptance criteria

1. Auth flows have typed input/error boundaries and do not call Supabase at
   module import time.
2. Protected-route primitives fail closed when a session is missing or invalid.
3. Existing prototype routes remain buildable and visibly demo-only until the
   future UI integration task switches them over.
4. Existing Cloudflare build and `npm run verify:vercel` both pass.
5. `npm test`, TypeScript, secret scan, and web verification pass.
6. No hosted action, secret, or real customer data is introduced.

## Required handoff

Create `feat/claude-supabase-auth-session-foundation` from the latest approved
preview integration branch. Use Conventional Commits, do not merge, and append
the standard handoff: outcome, commits, changed files, checks, security/tenant
impact, migration/rollback notes, limitations, and recommended reviewer.

## Handoff notes (Claude Code)

_To be completed by Claude Code._

# TASK-015 — Claude real authentication route integration

## Objective

Connect MITIGA's existing English-first sign-in, password-reset, sign-out, and
route-protection experience to the safe Supabase session foundation delivered
in TASK-013. Replace prototype-only navigation only where the route is being
made real.

## Context

TASK-013 already provides cookie-backed browser/server Supabase clients,
typed auth errors, and fail-closed request identity resolution. The hosted
Development project is linked and has test Auth users. This task is an
application integration, not a database or hosted-configuration task.

## In scope

- Work only in `apps/web/app/**`, `apps/web/components/**`,
  `apps/web/lib/supabase/**`, `apps/web/lib/domain/**`,
  `apps/web/lib/i18n/**`, `apps/web/tests/**`, `docs/adr/**`,
  `docs/security/**`, dependency manifests/lockfile if needed, and this task.
- Wire the existing sign-in form to `signInWithPassword`; provide accessible
  pending, success, and typed failure states with English source copy.
- Add a password-recovery request view wired to the existing reset use case.
- Add real sign-out that clears the Supabase session and returns to sign-in.
- Add server-side protected-route handling for authenticated product routes.
  Missing, expired, or invalid sessions must fail closed and redirect to a
  safe sign-in state; never infer identity, tenant, or role from UI fixtures.
- Keep a clearly labelled demo entry available only as an explicit development
  preview aid. It must not be the default path after a real session is present,
  must not impersonate a real user, and must never be mistaken for a session.
- Missing public Supabase configuration must produce a clear, non-sensitive
  configuration state rather than a crash or a fallback to fake authentication.
- Add tests for route/auth boundary behavior, browser form error mapping, and
  absence of privileged configuration in client code.
- Document exact Vercel variable *names only* and the manual test checklist.

## Out of scope

- Hosted Supabase Auth provider changes, real Auth user creation, password
  delivery, invitation email delivery, Resend, migrations/RLS/RPC changes,
  billing, service-role keys, tenant membership creation, and production
  deployment.

## Security requirements

- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`/publishable equivalent.
- Never place secrets, database URLs, service-role values, or user UUIDs in
  code, fixtures, tests, screenshots, or docs.
- Resolve the user with verified Supabase Auth/session APIs server-side. UI
  role controls and query parameters are never authorization.
- Do not expose whether a password-reset recipient exists.
- Preserve tenant isolation: a valid user with no active membership must not
  receive a tenant workspace.

## Acceptance criteria

1. A configured Development environment can sign in, sign out, and request a
   password reset through the real Supabase client boundary.
2. Authenticated product routes are protected server-side and fail closed.
3. The current visual prototype remains reviewable only through explicit demo
   behavior and is visibly not a real authenticated session.
4. No migration, hosted Auth setting, or secret is introduced.
5. `npm test`, TypeScript, `./scripts/check-secrets.sh`,
   `./scripts/verify-web.sh`, and `npm run verify:vercel` pass.

## Required handoff

Create `feat/claude-real-auth-route-integration` from
`origin/preview/vercel-adapter`. Use Conventional Commits. Do not merge or
deploy. Include outcome, commits, files changed, exact checks, security/tenant
impact, migration/rollback notes, limitations, the manual Vercel setup
required, and recommended reviewer.

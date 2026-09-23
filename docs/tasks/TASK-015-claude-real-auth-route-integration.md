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

## Handoff (Claude Code)

Outcome: implemented in full. Branch created from `origin/preview/vercel-adapter`
(at the commit where TASK-013 had just merged). No merge, no deploy, no
hosted Supabase/Vercel change, no migration, and no secret were performed
or introduced.

Branch and commits: `feat/claude-real-auth-route-integration`, `86d0c45`
(library primitives), `13912cb` (real routes/actions/components), `8cad664`
(tests), `d34bd04` (ADR 0010 + manual test checklist), plus this handoff
commit.

Files changed:
- New: `apps/web/lib/supabase/protected-route.ts`,
  `apps/web/lib/domain/workspace-access.ts`,
  `apps/web/lib/i18n/auth-error-messages.ts`, `apps/web/app/auth-actions.ts`,
  `apps/web/app/reset-password/page.tsx`, `apps/web/app/workspace/page.tsx`,
  `apps/web/components/auth/{sign-in-form,password-reset-form,config-missing-notice}.tsx`.
- Modified: `apps/web/lib/supabase/env.ts` (+`hasPublicSupabaseConfig`),
  `apps/web/lib/supabase/auth.ts` (+`authErrorPresentationCode`),
  `apps/web/lib/domain/index.ts`, `apps/web/app/page.tsx` (rewritten as a
  Server Component), `apps/web/lib/i18n/messages.ts` (`login` section
  rewritten; new `passwordReset`/`workspace` sections),
  `apps/web/tests/supabase/auth-error-mapping.test.ts` (+2 tests).
- New tests: `apps/web/tests/domain/workspace-access.test.ts`,
  `apps/web/tests/i18n/auth-error-messages.test.ts`,
  `apps/web/tests/supabase/config-detection.test.ts`,
  `apps/web/tests/app/no-privileged-config-in-client-components.test.ts`.
- Docs: `docs/adr/0010-real-auth-route-integration.md`,
  `docs/security/TASK-015-manual-test-checklist.md`.
- No file under `apps/web/components/prototype/**` or any existing
  prototype route was touched.

Decisions and assumptions (full rationale in ADR 0010):
- No existing fixture route (`/tenants`, `/company`, `/operator`,
  `/super-admin`, `/cases`, `/evaluations`, `/policies`,
  `/company/admin(/members)`, `/invite`, `/onboarding`) was moved into a
  protected route group or gated. They all render `lib/demo/**` fixture
  data (a fixed fake actor, fake tenants) regardless of who is signed in;
  gating access to that content would not have made the content itself
  real, and risked exactly the "must not impersonate a real user" failure
  this task's own security requirements name. The "Continue with sample
  data" demo entry on `/` still opens `/tenants` directly, unchanged.
- `/workspace` is the one new, real, server-protected product route: it
  shows the verified session's real email and a real active-membership
  count (queried by the verified `userId`, never client input), with a
  distinct "no workspace yet" state when there is none — the concrete,
  tested implementation of the tenant-isolation requirement.
- `requireAuthenticatedIdentity()` (`lib/supabase/protected-route.ts`) is
  a reusable primitive, not a one-off check, ready for a future task
  building real per-tenant views.
- Sign-in/password-reset are Server Actions (only Server Actions/Route
  Handlers can reliably write session cookies, per ADR 0009's `setAll`
  caveat), using React 19's `useActionState`/`useFormStatus` for
  accessible pending/error states.
- Missing public Supabase configuration is checked server-side
  (`hasPublicSupabaseConfig()`) in each page, never in client code; the
  two real client components never import `lib/supabase/env.ts` at all
  (proven by a dedicated test, not just by convention).
- SSO's fake demo button and toast were removed from `/` along with the
  rest of the fictional-login copy, since the form is now real and a
  non-functional SSO affordance would be actively misleading rather than
  merely fictional.

Checks run and exact results:
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — no errors.
- `cd apps/web && npm test` (`node --test`) — 97/97 pass.
- `cd apps/web && npm run build` (Cloudflare) — succeeds; new routes
  `/reset-password` and `/workspace` appear in the route report alongside
  every existing route, unchanged.
- `cd apps/web && npm run verify:vercel` — succeeds; `.vercel/output/` is
  still genuine Build Output API v3 output with the new routes bundled.
- `./scripts/check-secrets.sh` — "Secret check passed."
- `./scripts/verify-web.sh` (oxlint with CI's ignore patterns, plus
  `vinext build`) — lint clean (two real findings during development —
  an unused import and a `role="status"` a11y suggestion — fixed before
  this handoff), build succeeds.

Security/tenant/audit impact: identity is always re-derived from a
verified Supabase session (`client.auth.getUser()` inside
`resolveRequestIdentity()`), never from a client-supplied role, tenant
id, or query parameter. `/workspace`'s membership query is filtered by
the verified `userId` server-side. Password-reset never reveals whether
an address belongs to an account. No `SUPABASE_SERVICE_ROLE_KEY`,
database URL, or Resend value appears anywhere in this diff (confirmed by
`check-secrets.sh` and by a dedicated test that scans the two real
client components' source for `SERVICE_ROLE` and for an import of the
server-only Supabase boundary). No RLS policy, migration, or hosted Auth
setting was touched.

Migration and rollback notes: no `supabase/**` file touched — nothing to
migrate or roll back at the database level. Rollback is reverting the
four commits above; the existing prototype is provably unaffected (no
file under `components/prototype/**` or any existing route changed), so
reverting carries no risk to it either.

Manual Vercel/Development setup required (see
`docs/security/TASK-015-manual-test-checklist.md` for the full
checklist): none beyond what TASK-012/013 already documented —
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (names
only, already set). No new variable is introduced. A human should run the
11-step manual checklist against the linked Development project's
existing test Auth users after reviewing this branch, since this task
does not create or exercise a real user itself.

Known limitations: `/workspace` intentionally does not yet render real
per-tenant product data — it is a real, honest landing point, not a
rebuilt company/operator/tenant workspace (that remains future work,
consistent with TASK-014/016). Session-refresh middleware is still not
added (deferred since TASK-013's ADR 0009, for the same reason: outside
this task's declared file scope); a signed-in user's session will rely on
Supabase's own token refresh behavior without a middleware backstop until
a future task adds one.

Recommended reviewer: an independent agent for the Server Action/cookie
design (security-sensitive), and a product owner to confirm `/workspace`'s
minimal "still being connected" framing is acceptable pending the real
workspace views a later task will build.

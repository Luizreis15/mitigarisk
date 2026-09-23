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

Outcome: implemented in full. Branch created from
`origin/preview/vercel-adapter` (the latest approved preview integration
branch, per `git branch -r`/task instruction), which already contains
TASK-012's merged Vercel adapter and TASK-011's merged brand-mark work.

Branch and commits: `feat/claude-supabase-auth-session-foundation`,
`1e7484c` (auth/session foundation), `59d1f70` (unit/boundary tests),
`fc83a7c` (ADR 0009 + follow-up doc), plus this handoff commit.

Files changed:
- `apps/web/lib/domain/auth-session.ts` (new) — typed inputs, a closed
  `AuthSessionError` hierarchy, and email/password shape validators.
- `apps/web/lib/supabase/auth.ts` (new) — `signInWithPassword`/`signOut`/
  `requestPasswordReset`, with pure `mapSignInError`/
  `mapPasswordResetRequestError` functions.
- `apps/web/lib/supabase/session.ts` (new) — `createServerSupabaseClient()`,
  a per-request, cookie-backed server client via `@supabase/ssr`.
- `apps/web/lib/supabase/browser.ts` — swapped to `@supabase/ssr`'s
  `createBrowserClient` (cookie-backed, was `localStorage`-backed).
- `apps/web/lib/supabase/identity.ts` — `resolveRequestIdentity` (the
  protected-route primitive, unchanged in name/signature from TASK-006)
  now fails closed with typed `NoActiveSessionError`/
  `SessionExpiredError`/`SessionResolutionError` instead of a generic
  `Error`.
- `apps/web/lib/supabase/server.ts` — one-line import fix (`./env` →
  `./env.ts`) needed for Node's test runner to dynamically import it;
  behavior unchanged.
- `apps/web/lib/domain/index.ts`, `apps/web/package.json` (+lockfile,
  added `@supabase/ssr`).
- `apps/web/tests/domain/auth-session.test.ts`,
  `apps/web/tests/supabase/{auth-error-mapping,identity,
  no-import-time-supabase-calls,no-service-role-in-client-boundary,
  server-browser-guard}.test.ts` (new).
- `docs/adr/0009-supabase-auth-session-foundation.md`,
  `docs/security/TASK-013-auth-follow-up.md`.

No file under `apps/web/app/**` was added or changed.

Decisions and assumptions (full rationale in ADR 0009):
- Cookie-backed sessions via `@supabase/ssr` (`createBrowserClient`/
  `createServerClient`) rather than the prior `localStorage`-backed
  browser client or a hand-rolled cookie scheme — the standard,
  Supabase-documented pattern for a browser and a server render of the
  same request to observe the same session.
- `resolveRequestIdentity` (existing from TASK-006) was upgraded in
  place to throw typed errors rather than adding a second, competing
  identity-resolution function — it already was the protected-route
  primitive; it now fails closed distinguishably.
- Session-refresh middleware (`apps/web/middleware.ts`) was written,
  then deliberately removed: it sits outside this task's declared file
  scope (`apps/web/app/**`, `lib/supabase/**`, `lib/domain/**`,
  `tests/**`), and adding it anyway would have been scope creep past an
  explicit path list rather than a judgment call this task should make
  silently. `createServerSupabaseClient()`'s `setAll` already handles the
  Server-Component "cookies are read-only" case; any flow that must set
  a cookie should do so from a Server Action or Route Handler until a
  future task adds the middleware alongside real route wiring.
- The existing demo prototype (`app/page.tsx` and the rest of `app/**`)
  is completely untouched — it still just navigates to `/tenants` on
  submit, remains visibly labeled as a prototype, and never calls any
  code this task added.
- `requestPasswordReset` intentionally does not distinguish "email
  exists" from "email does not exist," matching Supabase's own
  `resetPasswordForEmail` behavior (no user enumeration).

Checks run and exact results:
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — no errors.
- `cd apps/web && npm test` (`node --test`) — 85/85 pass.
- `cd apps/web && npm run build` (Cloudflare, unchanged path) —
  succeeds.
- `cd apps/web && npm run verify:vercel` — succeeds; `.vercel/output/`
  is still genuine Build Output API v3 output with the new
  `@supabase/ssr` code bundled into the function.
- `./scripts/check-secrets.sh` — "Secret check passed."
- `./scripts/verify-web.sh` (oxlint with CI's ignore patterns, plus
  `vinext build`) — lint clean, build succeeds.

Security/tenant/audit impact: no hosted Auth setting was changed, no
real user was created, and no credential value (`SUPABASE_SERVICE_ROLE_KEY`,
a database URL, or a Resend value) appears anywhere in this diff —
confirmed by `./scripts/check-secrets.sh` and by two dedicated tests
(`server-browser-guard.test.ts`, a runtime proof;
`no-service-role-in-client-boundary.test.ts`, a source-level check).
Identity is always re-derived from a verified Supabase session
(`client.auth.getUser()`), never from a decoded-but-unverified token or a
client-supplied role/tenant id. No database authorization policy or RLS
was touched.

Migration and rollback notes: no `supabase/**` file touched. Rollback is
reverting the three commits above; nothing in the repository depends on
this code yet since no `app/**` file calls it.

Known limitations: real end-to-end sign-in still requires a human to
complete the hosted Development configuration and the Northstar tenant
bootstrap steps in `docs/security/TASK-013-auth-follow-up.md` — this task
provides the code boundary only. Session-refresh middleware is not yet
added (see above); a future UI integration task should add it alongside
wiring the real sign-in/sign-out/reset flows into `app/**`.

Recommended reviewer: an independent agent for the session/cookie design
(security-sensitive), and the author of the future UI integration task to
confirm `signInWithPassword`/`signOut`/`requestPasswordReset`/
`resolveRequestIdentity` are a contract they can build the real sign-in
UI against.

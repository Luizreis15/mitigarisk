# ADR 0009 — Cookie-backed Supabase auth/session foundation, kept separate from the existing prototype UI

- Status: accepted
- Date: 2026-09-13

## Context

TASK-013 asks for the application-side foundation for real Supabase
email/password authentication — sign-in, sign-out, password-reset
request, authenticated identity resolution, and session absence/expiry —
without enabling any hosted Auth provider setting, creating a real user,
or disturbing the existing prototype UI (`app/page.tsx` and friends,
built by Cursor across TASK-005/007/008/010/011), which must "remain
buildable and visibly demo-only until the future UI integration task
switches them over."

The existing Supabase boundary (`apps/web/lib/supabase/{env,browser,server}.ts`,
from TASK-002/006) already had a browser client (plain `createClient`,
localStorage-backed) and a server client scoped by an explicit bearer
token (`createRequestScopedSupabaseClient(accessToken)`). Neither gives a
browser and a server render of the same request a shared view of "is this
user signed in" — the bearer-token client requires the caller to already
have a token in hand, and localStorage isn't visible to server-rendered
components at all.

## Decisions

**Cookie-backed sessions via `@supabase/ssr`, not a bespoke token
handshake.** `apps/web/lib/supabase/browser.ts` now uses
`createBrowserClient` (still URL + anon key only) and a new
`apps/web/lib/supabase/session.ts` adds `createServerSupabaseClient()`
using `createServerClient`, both from `@supabase/ssr`, reading/writing the
same cookies. This is the standard, Supabase-documented pattern for
exactly this problem in an App Router framework, and it means a
sign-in performed in a Server Action is immediately visible to the next
Server Component render without any extra plumbing.

**Session-refresh middleware is deliberately deferred, not added here.**
`@supabase/ssr`'s own documented pattern recommends a `middleware.ts` that
refreshes session cookies on every request, since a Server Component
cannot write cookies itself (see the `setAll` comment in
`apps/web/lib/supabase/session.ts`). `apps/web/middleware.ts` sits outside
this task's declared file scope (`apps/web/app/**`,
`apps/web/lib/supabase/**`, `apps/web/lib/domain/**`,
`apps/web/tests/**`) — TASK-013 scopes "route protection primitives" as
library code a later route calls, not a project-root file. Adding it
anyway would have been scope creep past an explicit path list, not a
judgment call this task should make silently. It is called out here so
the future UI integration task adds it alongside the real route wiring
that will actually need it: until then, `createServerSupabaseClient()`'s
`setAll` simply catches the Server-Component "cookies are read-only"
case, and any flow that needs to set a cookie (sign-in, sign-out,
password-reset request) does so from a Server Action or Route Handler,
where `setAll` succeeds directly without middleware.

**`resolveRequestIdentity` (the existing TASK-006 protected-route
primitive) now throws typed errors instead of a generic `Error`.**
`NoActiveSessionError` (no session was ever established, or the caller
signed out), `SessionExpiredError` (Supabase's own `session_expired`
code — the token was valid once but is no longer), and
`SessionResolutionError` (any other invalid-session code, or the identity
RPC itself failing) are now distinguishable by `instanceof` — satisfying
acceptance criterion 2 ("protected-route primitives fail closed when a
session is missing or invalid") without introducing a second, competing
identity-resolution function. The distinction is made by checking
Supabase's own `error.name`/`error.code` (`AuthSessionMissingError` /
`session_not_found` / `session_expired`), not by string-matching a
message, which is more stable across SDK versions.

**Error mapping is a pure, exported function per flow, not inline in the
use case.** `mapSignInError`/`mapPasswordResetRequestError` in
`apps/web/lib/supabase/auth.ts` take a `{ code, message }`-shaped value
and throw a typed `AuthSessionError` subtype; they are unit-tested with
fake error objects with no network call and no Supabase client, which is
the only way to exercise "success/error mapping" per this task's explicit
test requirement without a hosted action.

**`requestPasswordReset` never distinguishes "email exists" from "email
does not exist."** Supabase's own `resetPasswordForEmail` API already
does not reveal this (no user enumeration by design); this boundary
passes that behavior through unchanged rather than adding its own
existence check, which would reintroduce the exact leak Supabase's API
was designed to avoid.

**No UI change.** No file under `apps/web/app/**` was added or touched.
The existing demo sign-in form (`app/page.tsx`) still just navigates the user
to `/tenants` on submit; it is unaffected by, and does not call, any of
the new code in this task. Wiring the real flows into that UI is
explicitly a future task's job.

## Consequences

- A future UI integration task can call `signInWithPassword`/`signOut`/
  `requestPasswordReset` from a Server Action using
  `createServerSupabaseClient()`, and `resolveRequestIdentity` from any
  Server Component or Route Handler that needs to require an
  authenticated user — all already typed, tested, and fail-closed.
- The existing bearer-token `createRequestScopedSupabaseClient` and the
  service-role `getServiceRoleSupabaseClient` in
  `apps/web/lib/supabase/server.ts` are unchanged; they remain the right
  choice for the TASK-006 bootstrap/invitation RPC call sites, which are
  not tied to a browser session at all.
- `apps/web/tests/supabase/server-browser-guard.test.ts` and
  `no-service-role-in-client-boundary.test.ts` together prove, at both
  the runtime and source level, that no file reachable from browser code
  can touch `SUPABASE_SERVICE_ROLE_KEY` — the exact "prevention of
  browser service-role use" this task's security requirements ask for.
- Real end-to-end sign-in still requires a human to complete the hosted
  configuration and Northstar tenant bootstrap steps in
  `docs/security/TASK-013-auth-follow-up.md` — this task provides the
  code, not the configured environment.

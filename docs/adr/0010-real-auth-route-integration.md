# ADR 0010 — Real auth routes added alongside, not inside, the existing prototype

- Status: accepted
- Date: 2026-09-13

## Context

TASK-015 connects the TASK-013 Supabase session foundation to real
sign-in, password-reset, sign-out, and route protection, while the
existing visual prototype (`app/tenants`, `app/company`, `app/operator`,
`app/super-admin`, `app/cases`, `app/evaluations`, `app/policies`, all
built by Cursor and driven entirely by fixtures in `lib/demo/**`) "remains
reviewable only through explicit demo behavior and is visibly not a real
authenticated session."

The obvious literal reading of "protect authenticated product routes"
would move all of the above under a Next.js route group with a real
session check in front of them. That was evaluated and rejected.

## Decisions

**None of the existing fixture routes were moved, wrapped, or gated.**
Putting a real-session check in front of `/tenants`, `/company`, etc.
would have created a worse problem than it solved: those pages render
`lib/demo/session.ts`'s hardcoded actor ("Elena Park") and fictional
tenants regardless of who is actually signed in. A real, authenticated
user reaching one of those pages would see a fabricated identity and
fabricated company data presented as if it were theirs — exactly the
"must not impersonate a real user" failure this task's own security
requirements name. Gating access to that content with a real check would
not have made the content itself any less fake underneath.

**A new route, `/workspace`, is the one real, server-protected product
route this task adds**, and it is genuinely honest: it shows the
signed-in user's real email (from a verified session,
`client.auth.getUser()`), a real count of their active memberships
(queried by their verified `userId`, never a client-supplied value), and
an explicit "full workspace views are still being connected" notice. A
user with zero active memberships sees a distinct "no workspace yet"
state and nothing resembling tenant content — the concrete implementation
of "a valid user with no active membership must not receive a tenant
workspace." `apps/web/lib/domain/workspace-access.ts` makes this decision
a pure, unit-tested function (`describeWorkspaceAccess`) rather than
inline branching in the page.

**The demo entry point is unchanged, not newly gated.** "Continue with
sample data" on the sign-in screen still links straight to `/tenants`,
exactly as before this task. It does not go through any auth check,
cookie, or flag — it is not, and was never, a session, and adding a
gate to a link that already leads to fixture-only content would add
complexity without adding safety. The prototype's own existing visible
banner ("Visual prototype with fictional data. No authentication, API, or
real customer data is connected.") already labels every one of those
pages; this task did not need to add a second labeling mechanism.

**`apps/web/lib/supabase/protected-route.ts` (`requireAuthenticatedIdentity()`)
is the reusable route-protection primitive**, not a one-off inline check
in `/workspace`. It wraps the TASK-013 `resolveRequestIdentity()` (fail
closed on missing/expired/invalid session) and redirects to `/` on any
failure. A future task extending real, per-tenant product views can call
it from any new Server Component without re-deriving this logic.

**Sign-in and password-reset are Server Actions
(`apps/web/app/auth-actions.ts`), not client-side `fetch` calls to a
Route Handler.** Only a Server Action or Route Handler can reliably write
session cookies (`apps/web/lib/supabase/session.ts`'s `setAll`
caveat, carried over from ADR 0009); Server Actions additionally let the
two new forms (`SignInForm`, `PasswordResetForm`) use React 19's
`useActionState`/`useFormStatus` for accessible pending/error states with
minimal client-side code. Each action's interesting logic (calling
`signInWithPassword`/`requestPasswordReset`/`signOut` and mapping any
thrown error to a serializable `{ status: 'error', code }`) is a thin
wrapper around the already-tested TASK-013 functions; the new
`authErrorPresentationCode()` in `apps/web/lib/supabase/auth.ts` is the
one new piece of logic, and it is unit-tested directly.

**Password-reset never confirms whether an email exists**, matching
Supabase's own `resetPasswordForEmail` behavior (ADR 0009) — the success
state renders identically regardless.

**Missing public Supabase configuration renders a distinct, non-sensitive
notice instead of crashing**, decided server-side in each page
(`app/page.tsx`, `app/reset-password/page.tsx`) via
`hasPublicSupabaseConfig()` (a new, non-throwing check in
`apps/web/lib/supabase/env.ts`), never in client code — the two new
interactive forms (`SignInForm`, `PasswordResetForm`) never import
`lib/supabase/env.ts` at all, verified directly by
`apps/web/tests/app/no-privileged-config-in-client-components.test.ts`.

## Consequences

- The prototype's entire existing surface area is untouched by this task
  except for `lib/i18n/messages.ts`'s `login` section (rewritten from
  fictional-login copy to real sign-in copy, since `/` itself is the one
  existing route this task made real) and the mobile-nav "Sign out"
  affordance (`components/prototype/app-shell.tsx`), left deliberately
  unchanged since it is only ever reached from fixture-only pages that
  have no real session to sign out of.
- A future task that builds real, tenant-scoped product views has both a
  concrete pattern to copy (`/workspace`) and a ready-made primitive to
  call (`requireAuthenticatedIdentity()`) — it does not need to re-derive
  either from TASK-013's lower-level functions.
- `/tenants`, `/company`, `/operator`, `/super-admin`, `/cases`,
  `/evaluations`, `/policies`, `/company/admin(/members)`, `/invite`, and
  `/onboarding` remain exactly as reviewable, and exactly as fictional, as
  they were before this task. None of their acceptance criteria or
  existing tests are affected.

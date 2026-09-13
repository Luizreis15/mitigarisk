# TASK-015 — manual test checklist and Vercel variable names

This task connects real Supabase email/password sign-in, password-reset
request, sign-out, and server-side route protection to the existing
Development environment. It changes no hosted Auth setting, creates no
real user, and enters no secret anywhere in this diff. The checklist
below is for a human (or Codex, post-merge) to run manually against the
already-linked Development project and its existing test Auth users — it
is not automated by this task.

## Vercel/Development environment variables (names only)

No new variable is introduced by this task. Unchanged from
`docs/architecture/VERCEL-PREVIEW-ADAPTER.md` and
`docs/security/TASK-013-auth-follow-up.md`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Both are public by design. No value is recorded anywhere in this task's
diff, docs, or tests.

## Manual test checklist

Run against a Development environment with both variables above set and
at least one existing, confirmed test Auth user (per
`docs/security/TASK-013-auth-follow-up.md`'s "Creating the Northstar test
tenant and membership").

1. **Missing configuration.** Temporarily unset either public variable
   and load `/`: the page must show the "Sign-in is not available"
   notice (not a crash, not a fallback to fake authentication), with the
   "Continue with sample data" preview still reachable. Repeat for
   `/reset-password`. Restore both variables afterward.
2. **Invalid credentials.** On `/`, submit a wrong password for a real
   test account: the form shows "That email or password is incorrect,"
   the page does not navigate away, and no session cookie is set.
3. **Successful sign-in.** Submit correct credentials for a real test
   account: the browser is redirected to `/workspace`, which shows the
   real signed-in email.
4. **No membership.** Using a real test account that is not a member of
   any tenant, confirm `/workspace` shows "No workspace yet" — never a
   fabricated tenant/company view.
5. **Active membership.** Using a real test account with at least one
   active membership (see the Northstar bootstrap steps), confirm
   `/workspace` shows the real active-membership count.
6. **Platform admin.** Using the platform-admin test account (if one
   exists), confirm `/workspace` shows the platform-administrator notice
   instead of a membership count.
7. **Protected-route redirect.** While signed out (or after step 8's
   sign-out), request `/workspace` directly: confirm it redirects to `/`
   rather than rendering anything.
8. **Sign-out.** From `/workspace`, use "Sign out": confirm the browser
   returns to `/`, and that requesting `/workspace` again afterward
   redirects to `/` (session was actually cleared, not just navigated
   away from).
9. **Password-reset request.** On `/reset-password`, submit a real test
   account's email: confirm the "Check your email" state renders, and
   that a non-enrolled/fictional address produces the exact same success
   state (no enumeration). This task does not verify email delivery
   itself — Resend/email templates are out of scope.
10. **Session expiry (best effort).** If a way to force-expire a test
    session is available in the Development project, confirm requesting
    `/workspace` with an expired session redirects to `/` rather than
    erroring.
11. **Prototype unaffected.** Confirm "Continue with sample data" on `/`
    still opens `/tenants` and the rest of the existing prototype exactly
    as before this task, with its "Visual prototype with fictional data"
    banner still visible, regardless of steps 1–10's real-session state.

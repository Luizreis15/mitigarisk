# TASK-019 — manual test checklist: tenant selection and authorization boundary

This task adds server-validated tenant selection to `/workspace`
(membership proof against real data, never a trusted client-supplied
tenant id) and session-refresh-only middleware. It changes no hosted
Supabase setting, no migration, and uses no service-role credential. The
automated negative-authorization matrix is covered by
`apps/web/tests/domain/tenant-selection.test.ts`,
`apps/web/tests/supabase/tenant-memberships-repository.test.ts`, and
`apps/web/tests/supabase/tenant-context.test.ts` — this checklist is for a
human (or Codex, post-merge) to run manually against an already-linked
Development project with real test Auth users and memberships, per
`docs/security/TASK-013-auth-follow-up.md`'s bootstrap steps. It is not
automated by this task.

## Environment

No new variable is introduced. Unchanged public variables:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No value is
recorded anywhere in this task's diff, docs, or tests.

You will need at least:
- One test account with exactly one active tenant membership.
- One test account with two or more active tenant memberships in
  different tenants.
- One test account with zero memberships, or only an `invited`,
  `suspended`, or `removed` one.
- The platform-admin test account, if one exists.
- The id of a real tenant the signed-in test account is *not* a member of
  (any other tenant's id from the Development database is enough — it
  does not need to be a real UUID belonging to anyone, a syntactically
  valid but non-existent UUID works too).

## Manual test checklist

1. **Single membership, no param.** Sign in as the one-membership
   account and load `/workspace` with no `?tenant=` param: confirm the
   page shows that tenant's name (`selectedTenantNotice`) without any
   selection UI.
2. **Single membership, matching param.** Reload
   `/workspace?tenant=<that account's own tenant id>`: same result as
   step 1.
3. **Single membership, mismatched param.** Reload
   `/workspace?tenant=<some other tenant's id>`: confirm the page falls
   back to the same state as step 1 (auto-selects the real membership) —
   it must not show that tenant's name, an error naming the rejected id,
   or any indication of whether that id exists.
4. **Multiple memberships, no param.** Sign in as the multi-membership
   account and load `/workspace` with no param: confirm a selection list
   is shown with exactly that account's real tenant names, and that no
   tenant is auto-selected.
5. **Multiple memberships, select one.** Click one of the listed tenants:
   confirm the URL becomes `/workspace?tenant=<id>` and the page now
   shows that tenant's name, not a selection list.
6. **Multiple memberships, cross-tenant param.** With the multi-membership
   account, manually edit the URL to
   `/workspace?tenant=<a tenant id you are not a member of>`: confirm the
   page returns to the selection list from step 4, not an error page and
   not that tenant's data.
7. **Multiple memberships, stale param.** If a membership can be
   suspended/removed in this environment, select a tenant in step 5, then
   have an admin suspend or remove that membership, then reload the same
   URL: confirm the page falls back to the selection list (or auto-select,
   if only one membership remains) rather than continuing to show the
   revoked tenant.
8. **No membership.** Sign in as the zero-membership account (or one with
   only an `invited`/`suspended`/`removed` membership) and load
   `/workspace`: confirm "No workspace yet," never a tenant name or
   selection list.
9. **Platform admin.** Sign in as the platform-admin account and load
   `/workspace`: confirm the platform-administrator notice, never a
   tenant name or selection list, even if that account also happens to
   hold a real tenant membership.
10. **Session refresh, not authorization.** With dev tools open to the
    Network tab, load any application route while signed in with a
    session close to expiry (or force a token refresh if your Supabase
    project's access-token TTL allows testing this in a reasonable time):
    confirm the request completes normally and, if the access token
    rotated, the Supabase auth cookies in the response are updated. This
    proves the middleware ran; it does not by itself need to touch
    `/workspace` at all — any route exercises it, since the matcher
    covers the whole application.
11. **Signed out.** While signed out, request `/workspace` directly
    (with or without a `?tenant=` param): confirm it redirects to `/`
    exactly as before this task, before any tenant-selection logic runs.

## Status

Not executed as part of this task's automated verification. Per the task
contract: "Run the manual Development checklist only if the human owner
has already configured a safe test environment; otherwise report it as
pending and do not request credentials." No hosted Supabase or Vercel
access was used or requested to write this document.

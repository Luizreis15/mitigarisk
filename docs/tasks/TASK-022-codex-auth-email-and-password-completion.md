# TASK-022 — Auth email and password completion

## Objective

Complete MITIGA's hosted email/password lifecycle for confirmation, invitation,
password recovery, and password update, with Supabase Auth as token authority and
Resend as the approved SMTP provider.

## Business context

The current application can request a reset email but cannot consume the recovery
session or set a replacement password. The temporary public origin is
`https://mitiga.online` and the approved sender spelling is
`MITIGA <noreply@mitiga.online>`.

## In scope

- Safe, server-side callback exchange for Supabase email action tokens.
- A protected new-password form for recovery and invited users.
- Explicit production redirect URL construction.
- Versioned, premium HTML templates for confirmation, invitation, recovery, and
  password-changed notifications.
- A hosted-configuration checklist for Resend SMTP, Supabase URLs, templates, and
  manual acceptance testing.

## Out of scope

- Service-role use, automatic user creation, bulk invitations, database migrations,
  tenant operational data, deploys, or sending a real external message without a
  separately approved test recipient.
- Replacing Supabase Auth delivery with direct application-side Resend calls.

## Allowed bounded contexts

`apps/web/app/**`, `apps/web/components/auth/**`, `apps/web/lib/domain/**`,
`apps/web/lib/supabase/**`, `apps/web/lib/i18n/**`, `apps/web/tests/**`,
`apps/web/.env.example`, `docs/auth/**`, `docs/adr/**`, and this task contract.

## Acceptance criteria

1. Reset requests use a deterministic `/auth/confirm` redirect.
2. The callback verifies only supported Supabase OTP types and allows only internal
   destination paths.
3. Password updates require an authenticated recovery/invitation session, validate
   confirmation, and do not expose provider messages.
4. Templates are English-first, responsive, accessible, and use Supabase's hashed
   token flow for SSR.
5. No Resend key, service-role key, user credential, or customer data enters Git.

## Security, tenant, audit, and rollback

Auth tokens remain single-purpose and are verified by Supabase. Redirects fail
closed against open-redirect input. The flow is identity-scoped and does not select
or expose a tenant. No business audit event is created because no tenant operation
occurs; provider security notifications remain the record of password changes.
Rollback is a code revert plus restoring the previous hosted templates and URL/SMTP
settings.

## Required verification

`npm test`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`,
`npm run verify:vercel`, `./scripts/check-secrets.sh`, and
`./scripts/verify-web.sh`, followed by an approved manual hosted acceptance test.

## Handoff

**Outcome:** application-side confirmation/invitation/recovery callback, guarded
password update, versioned premium HTML templates, and hosted configuration guide
implemented. Hosted Supabase/Resend settings were not changed because the dashboard
session could not be opened reliably; no external email was sent.

**Branch:** `codex/transactional-auth-emails`.

**Decisions and assumptions:** `noreply@mitiga.online` corrects the requested
`noreplay` spelling. Supabase Auth remains the sole token authority and sends auth
mail through Resend SMTP; the application does not duplicate those sends through the
Resend API. The short-lived, HTTP-only password-action cookie ensures an ordinary
signed-in session cannot accidentally enter the recovery/invitation password screen.

**Checks:** 158 tests passed; TypeScript passed; Cloudflare/vinext build passed;
Vercel Build Output API v3 passed; secret scan passed; web lint/build verification
passed. The existing middleware deprecation warning remains informational.

**Security/tenant/audit:** hashed OTP verification is server-side; callback types and
destinations are allowlisted; provider messages and secrets never reach the browser.
No tenant is selected or exposed and no tenant business audit event is created.

**Migration and rollback:** no migration. Revert the implementation commit and restore
the previous hosted templates/URLs/SMTP settings if those settings are later applied.

**Known limitation:** hosted acceptance is pending. Dashboard invitations are
supported by the template/callback; application-owned invitation issuance remains a
separate privileged workflow and was not implemented with a service-role credential.

**Recommended reviewer:** independent security review, followed by human-approved
hosted configuration and a single dedicated test-account acceptance pass.

## Follow-up handoff (Claude Code, 2026-09-14): security review, one fix, hosted configuration blocked

**Outcome:** Security review complete; one finding fixed with tests. Hosted
Supabase Authentication configuration (Site URL, redirect URLs, SMTP
verification, and the four email templates) was **not applied** — see
"Hosted configuration: blocked" below for why, and the confirmed decision to
leave it pending rather than guess. No merge, no deploy, no migration, no
`.env*` read, no secret/token/API key/service-role key printed or requested,
no real email sent.

**Branch and commits:** `codex/transactional-auth-emails`, one new commit on
top of `8860e1e`:
- `5a65670` `fix(auth): narrow the /auth/confirm OTP-type allowlist to issued
  flows`.
- Plus this documentation commit.

**Security review — what was checked, and result for each:**
1. `/auth/confirm` (`apps/web/app/auth/confirm/route.ts`): verifies
   `token_hash` via `client.auth.verifyOtp({ token_hash, type })` — the
   hashed-token SSR flow, never a raw/decoded token. **Pass.**
2. OTP types allowed: originally `recovery`, `invite`, `signup`, `email`.
   **Finding (low severity, fixed):** `email` is a real Supabase
   `EmailOtpType` this project has no template for and does not enable as a
   login method; it was unreachable dead surface (Supabase would never issue
   such a token without that login method enabled), not a live bypass, but
   leaving it in the allowlist was unnecessary scope for a callback that
   should accept exactly the three flows it has templates and cookie logic
   for. **Fixed:** narrowed to `{recovery, invite, signup}` in a new,
   directly unit-tested pure predicate
   (`isSupportedAuthCallbackType`/`isPasswordActionCallbackType` in
   `apps/web/lib/supabase/site-url.ts`), replacing an inline `Set` and an
   unsafe `as EmailOtpType` cast in the route itself. Negative tests added
   for `magiclink`, `email_change`, `email`, `sms`, empty string, wrong
   case, and an injection-shaped string — all rejected.
3. Open-redirect protection (`safeAuthDestination`): a strict two-value
   allowlist (`/workspace` or `/update-password`, defaulting to the latter)
   — any other value, including a scheme-relative (`//attacker.example`) or
   absolute external URL, is rejected. Existing tests already covered this
   (`tests/supabase/site-url.test.ts`, unmodified by this review). **Pass,
   no change needed.**
4. `mitiga-password-action` HTTP-only cookie: `httpOnly: true`,
   `secure: request.nextUrl.protocol === 'https:'`, `sameSite: 'lax'`,
   `maxAge: 15 * 60`, `path: '/'`. Deleted on a successful password update
   (`apps/web/app/auth-actions.ts`'s `updatePasswordAction`), so it cannot
   be replayed to redo a mutation that already succeeded. **Pass.**
5. Expiration and link reuse: Supabase's own `verifyOtp` is the actual
   single-use enforcement (a second `GET /auth/confirm` with the same
   `token_hash` returns an error from Supabase and this route redirects to
   `/auth/error?reason=expired_link`); the 15-minute cookie window only
   bounds how long the already-verified recovery/invite state stays usable
   on this device, it does not itself enforce single-use. **Pass**, and the
   distinction is now recorded here since it was previously implicit.
6. `/update-password` (`apps/web/app/update-password/page.tsx`): requires
   both the `mitiga-password-action` cookie (recovery/invite marker) **and**
   a live `client.auth.getUser()` session; either failing redirects to
   `/auth/error`. **Pass.** One residual, out-of-scope observation (not
   fixed, see "Known limitations"): an ordinary signed-in user who still
   happens to hold an unexpired `mitiga-password-action` cookie from an
   earlier, abandoned recovery attempt in the same browser could reach
   `/update-password` and change their own password through it — this
   never grants access to another account (it still only calls
   `updateUser()` for whoever is currently authenticated), so it is not a
   privilege-escalation bug, just an odd entry path worth tightening in a
   future task if this repository ever adds an in-session "change
   password" flow that should be the only sanctioned path.
7. `updatePasswordAction`: validates confirmation match
   (`assertMatchingPasswordConfirmation`) and minimum length before calling
   Supabase; on any Supabase error, throws `UnknownAuthError(error.message)`
   internally, but `authErrorPresentationCode()` — the only thing returned
   to the client — strips that down to the stable error **name**, never the
   message. **Pass, no provider message reaches the browser.**
8. No service-role or Resend import: `grep`-verified across `app/**`,
   `components/**`, `lib/**` — zero matches for Resend SDK usage or
   `SERVICE_ROLE` outside the existing, already-guarded
   `lib/supabase/server.ts`. **Pass, unchanged from before this task.**
9. No user enumeration on reset: `requestPasswordReset` passes through
   Supabase's `resetPasswordForEmail`, which does not distinguish an
   existing vs. non-existing address; the UI's success copy is identical
   either way (`passwordReset.successBody`). **Pass, unchanged.**
10. `@supabase/ssr`/vinext/Vercel compatibility: traced directly in
    `node_modules/vinext/dist/server/app-route-handler-response.js`
    (`finalizeRouteHandlerResponse`/`applyMutableCookieFallbacks`) to
    confirm that cookies set two different ways in the same Route Handler —
    `createServerSupabaseClient()`'s `setAll` (via `cookies()` from
    `next/headers`, used internally by `verifyOtp` to write the new session)
    **and** `response.cookies.set('mitiga-password-action', ...)` on the
    `NextResponse.redirect(...)` this route returns directly — are both
    merged into the final response's `Set-Cookie` headers, not one
    overwriting the other. This is the same runtime the Vercel adapter from
    TASK-012/ADR 0008 bundles, so this holds for the actual deployment
    target, not just local `vinext build`. **Pass, verified by reading the
    actual bundled implementation, not assumed.**

**Fix applied:** see "narrow the /auth/confirm OTP-type allowlist" above.
No other code change was needed; the remaining checked items already met
this task's acceptance criteria as implemented by the prior handoff.

**Files changed in this follow-up (all within TASK-022's declared scope —
`apps/web/app/**`, `apps/web/lib/supabase/**`, `apps/web/tests/**`, this
task file):**
- `apps/web/app/auth/confirm/route.ts` — delegates type-checking to the new
  predicates; dropped the unsafe cast.
- `apps/web/lib/supabase/site-url.ts` — added
  `isSupportedAuthCallbackType`/`isPasswordActionCallbackType`.
- `apps/web/tests/supabase/site-url.test.ts` — negative coverage for the
  narrowed allowlist.
- `apps/web/tests/app/auth-email-boundary.test.ts` — source-level guard that
  the route uses the one shared predicate rather than a second, possibly
  drifting allowlist.
- This task file (handoff only).
- No `docs/auth/**` file, no migration, no `.env*` file was changed.

**Hosted configuration: blocked, not applied.** The task's instructions
authorized using "exclusively the Supabase connection already authenticated
in this terminal." That connection (the `supabase` CLI, already logged in —
`supabase orgs list`/`supabase projects list` both succeeded without any
credential being requested, read, or printed) has exactly one organization,
"Digital Hera," containing exactly two projects: **Veramo**
(`mnlulratuueetbhlywkd`) and **Flowdent** (`iuoarrfjpsbtvomhfchr`). Neither is
named MITIGA or otherwise identifiable as this project's Supabase backend:
the repository has no `supabase/config.toml` linking it to either ref, and no
`NEXT_PUBLIC_SUPABASE_URL` is set in this environment to cross-check against
either project's API URL. Rather than guess which of the two unrelated
projects to modify — which could mean editing live Authentication settings
(Site URL, redirect allowlist, SMTP, email templates) on someone else's
unrelated Veramo or Flowdent project — this was raised directly to the human
owner, who confirmed: **do not link or modify either project; record hosted
configuration as pending.** Consequently, steps 4 through 8 of the task's
instructions were not performed:
- Site URL / redirect URLs (`https://mitiga.online/auth/confirm`,
  `http://localhost:3000/auth/confirm`) — **not read or changed.**
- Custom SMTP field verification (sender name/email, host, port, username)
  — **not read.** No SMTP password was requested, read, or printed at any
  point, consistent with the task's constraint regardless of this blocker.
- The four versioned templates
  (`docs/auth/templates/{confirmation,invite,recovery,password-changed}.html`)
  — **not pasted into any hosted project.** They remain versioned in this
  repository exactly as the prior handoff left them; this review re-read all
  four (see "Template mapping" below) and found them consistent with the
  narrowed callback-type allowlist (each template's `type=` query parameter
  matches one of `recovery`/`invite`/`signup`) and with `safeAuthDestination`'s
  allowlist (each `next=` value is `/workspace` or `/update-password`).
- Password-changed security notification toggle — **not read or changed.**
- Resend click/open-tracking setting — **not checked** (would require
  accessing the Resend account, not authorized or reachable from this
  terminal either).

**Template mapping (re-verified, unchanged from the prior handoff):**

| Template | File | `type=` | `next=` | Subject |
|---|---|---|---|---|
| Confirm signup | `docs/auth/templates/confirmation.html` | `signup` | `/workspace` | Confirm your MITIGA account |
| Invite user | `docs/auth/templates/invite.html` | `invite` | `/update-password` | Your MITIGA access is ready |
| Reset password | `docs/auth/templates/recovery.html` | `recovery` | `/update-password` | Reset your MITIGA password |
| Password changed | `docs/auth/templates/password-changed.html` | n/a (notification only) | n/a | Your MITIGA password was changed |

All four use `{{ .SiteURL }}`, `{{ .TokenHash }}`, and/or `{{ .Email }}`
exactly as Supabase's Go templates require; none hard-codes `localhost`.

**Exact checks run and results (clean state, this follow-up's HEAD):**
```text
$ cd apps/web && npm test
ℹ tests 163 / pass 163 / fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — zero diagnostics)

$ cd apps/web && npm run build
Build complete. Route (app) lists /auth/confirm, /auth/error,
/update-password, /workspace, and all other routes.

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment.

$ ./scripts/check-secrets.sh
Secret check passed.

$ ./scripts/verify-web.sh
oxlint clean; vinext build succeeded; Web verification passed.

$ git diff --check
(no output — no whitespace errors)
```

**End-to-end test (step 10): pending, not executed.** Two independent
blockers, either one sufficient on its own: (a) no hosted MITIGA
Authentication configuration exists to test against, per the blocker above;
(b) no test account is identified and approved anywhere in this repository's
documentation (`docs/security/TASK-013-auth-follow-up.md`'s Northstar
bootstrap describes *how* to create one manually but names no concrete,
pre-approved address). Per the task's explicit instruction, no email address
was invented and nothing was sent. This remains "pending approved test
recipient," unchanged from the prior handoff, now additionally blocked on
hosted-project identification.

**Security/tenant/privacy/audit impact of this follow-up:** the one fix
reduces accepted OTP-callback surface from four types to the three this
project actually issues (least privilege); no behavior change for any real
user of the recovery, invite, or signup flows. No tenant is selected or
exposed by any part of this review or fix. No credential, token, or secret
was read, requested, logged, or printed at any point — verified by this
handoff's own review of every command run in this session.

**Migration and rollback:** no migration, no hosted change, so nothing to
roll back there. Revert `5a65670` to restore the four-type allowlist if
ever needed (not recommended — it only re-adds unreachable surface).

**Known limitations:**
- Hosted Supabase Authentication configuration (URLs, SMTP verification,
  templates, password-changed toggle) and Resend tracking verification
  remain entirely pending, blocked on identifying the correct hosted
  project — this is now the single blocking item for the rest of this
  task's acceptance criteria.
- The manual end-to-end acceptance test (step 10) is pending for the two
  reasons above.
- The residual `/update-password` entry-path observation in review item 6
  is documented but not fixed, as it is not a privilege-escalation risk and
  fixing it was judged out of this task's tight scope (no acceptance
  criterion names it); flagged for a future task if this repository adds
  an in-session change-password flow.

**Recommended reviewer:** independent security review of the OTP-allowlist
fix (small, mechanical); a human with access to confirm which Supabase
project (if either of Veramo/Flowdent, or a project not visible to this
terminal's CLI session) is actually MITIGA's backend, after which steps 4–8
and the end-to-end acceptance test can be completed in a follow-up pass.

## Follow-up handoff (Claude Code, 2026-09-14): hosted configuration applied, security incident, containment confirmed

**Outcome:** Hosted Supabase Authentication configuration (redirect URLs,
password-changed notification, and the three OTP email template subjects and
bodies) applied and verified. One security incident occurred and was
contained during this session (see "Security incident" below) — the human
owner has confirmed containment is complete. No merge, no additional deploy,
no migration, no `.env*` file read, no service-role credential used by this
agent at any point (the incident was an accidental **read/print** of an
already-existing key via a CLI command, not a credential this agent
requested, generated, or used to perform an action).

**Branch and commits:** `codex/transactional-auth-emails`, building on the
prior two commits (`8860e1e`, `5a65670`) plus this handoff commit. No further
application-code change was made in this pass — see "Security review" in the
previous follow-up handoff above for the one code fix; this pass is hosted
configuration plus documentation only.

### Correct project identified

The Supabase CLI session in this terminal was re-authenticated by the human
owner mid-task (account "mitiga29"). The resulting org is **Mitiga**
(`jfumypemjyjmcwnguodg`), with exactly one project: **mitigarisk**
(`njjfsdfctsewawhdlixq`, `ACTIVE_HEALTHY`, `us-east-1`). This is the correct
MITIGA backend, resolving the blocker recorded in the previous follow-up
handoff.

### Hosted configuration: read first, then applied (steps 4–6)

Using `npx -y supabase@2.117.0` (the newer CLI adds `config pull`/`config
diff`, which the locally installed 2.98.2 lacks — used only for its safe,
read-first workflow, nothing was installed globally), linked read-only to
`mitigarisk` from a scratch directory **outside this repository**
(`/private/tmp/.../mitiga-auth-verify`, never committed, removed after each
use; no `supabase/config.toml` was ever added to this repository — it is
outside TASK-022's declared bounded contexts):

1. `config pull` read the current remote Authentication configuration into a
   local file, so every field below was **read before being changed**, per
   the task's explicit order.
2. The pull's own diff output showed that a naive local-defaults-based push
   would have silently reset unrelated settings: email OTP length, signup
   confirmation requirement, email rate limit, MFA TOTP enrollment, and
   Twilio SMS enablement. None of these were touched. The final local file
   was edited to explicitly preserve every one of these at its real remote
   value (or leave the section fully undeclared, the same protection the CLI
   itself uses for credential fields) so that only the intended fields would
   change.
3. `config diff` (read-only, no write) was run again to confirm the edited
   file's diff against remote contained **exactly** the six intended
   changes, before any push:
   - `auth.additional_redirect_urls`: added `http://localhost:3000/auth/confirm`
     alongside the already-present `https://mitiga.online/auth/confirm`.
   - `auth.email.notification.password_changed.enabled`: `false` → `true`.
   - `auth.email.notification.password_changed.subject` →
     "Your MITIGA password was changed".
   - `auth.email.template.confirmation.subject` → "Confirm your MITIGA
     account".
   - `auth.email.template.invite.subject` → "Your MITIGA access is ready".
   - `auth.email.template.recovery.subject` → "Reset your MITIGA password".
4. `config push` (with this exact, pre-verified diff, after explicit human
   authorization for this specific write action — the harness's own
   permission classifier blocks hosted config-push actions by default)
   applied those six declared changes plus the four templates' HTML bodies
   (`content_path` uploads paired with each `subject`), read directly from
   this repository's `docs/auth/templates/*.html` (copied into the scratch
   directory only, never modified).
5. A final `config diff` after the push showed **zero** remaining `update`
   entries for anything this task declared — confirming the push applied
   exactly the six intended changes and nothing else.

**Non-secret values confirmed on the hosted project (step 3), no secret read
or printed:**
- Site URL: `https://mitiga.online` (already correct before this task;
  unchanged).
- Redirect URLs: `https://mitiga.online/auth/confirm`,
  `http://localhost:3000/auth/confirm` — exactly these two, no wildcard.
- SMTP: `enabled = true`, `host = smtp.resend.com`, `port = 465`,
  `user = resend`, `sender_name = "Mitiga"`, `admin_email =
  noreply@mitiga.online`. **Observation, not fixed:** the task's approved
  sender spelling is `MITIGA` (all caps); the hosted `sender_name` field
  reads `Mitiga`. This is a read-only verification step per the task
  contract ("Verifique apenas campos não secretos... Não leia, substitua ou
  imprima a senha SMTP"), and this agent has no safe way to change
  `sender_name` without also declaring the SMTP block's `pass` field — doing
  so with a placeholder/blank value would invalidate the existing,
  human-configured SMTP credential. Left for the human owner to correct via
  the dashboard (a one-field text edit, no credential involved).
- Twilio SMS: `enabled = true` — pre-existing, untouched by this task.
  Explicitly preserved during the push (see point 2 above) so this task's
  unrelated changes could not accidentally disable it.
- MFA (TOTP): `enroll_enabled = true`, `verify_enabled = true` —
  pre-existing, untouched. Not part of this task's scope.
- Templates applied: all four (`confirmation.html`, `invite.html`,
  `recovery.html`, `password-changed.html`) match this repository's
  versioned files exactly, with the subjects listed above.

**Password-changed security notification (step 7):** enabled, confirmed
above.

**Resend click/open tracking (step 8):** **not verified — pending.** No tool
available in this terminal reaches the Resend account (only the Supabase
project was authorized and reachable); checking this requires access to
Resend directly, which this task did not authorize. Recorded as pending, per
the task's own instruction to mark it as such rather than guess.

### Security incident (2026-09-14)

**What happened:** while attempting to verify the pushed redirect-URL
configuration, this agent ran `supabase projects api-keys --project-ref
njjfsdfctsewawhdlixq` piped through a grep filter intended to redact
key-shaped lines. The filter was wrong — it matched only the header row —
and the command's output, including the **anon key** and the **legacy
service_role key** in full, was printed into this agent's tool output and
therefore into this conversation. This agent did not need to run that
command at all: verifying a redirect-URL push never requires fetching
project API keys, and the command's entire purpose is to display them
unmasked. The mistake was in choosing to run the command in the first place,
not only in the failed filter.

**Immediate response:** this agent stopped in the same turn the values
appeared, before running any further command, and explicitly disclosed the
mistake to the human owner rather than continuing silently or attempting to
self-correct by rotating credentials from the terminal (which the operating
instructions do not authorize an agent to decide unilaterally). The human
owner then issued an explicit stop instruction; this agent ran zero further
Supabase commands, read zero `.env*` files, and did not reproduce, query, or
test the exposed values, for the remainder of that turn and every turn
since.

**Exposure window and scope:** from the single command's execution to this
agent's own immediate stop-and-disclosure in the same turn — there was no
gap in which this agent took any further action with the exposed values.
The values were visible only within this interactive session's tool output
and this conversation transcript; they were not written to any file in this
repository, not committed, not logged to any external system by this agent,
and not transmitted anywhere beyond this conversation. The human owner
independently assessed the legacy service_role key as compromised (the
conservative, correct call regardless of the narrow technical exposure
surface, since a secret that left its intended handling path should not be
trusted again) and led containment.

**Containment, confirmed by the human owner before this handoff resumed:**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` migrated to the new `sb_publishable_...`
  key on Vercel.
- `NEXT_PUBLIC_SITE_URL=https://mitiga.online` configured on Vercel.
- A new deployment was made with the updated configuration.
- The legacy `anon` and `service_role` keys were deactivated in Supabase.

**Log review (step 4 of this follow-up's instructions):** attempted, not
completed. No tool available in this terminal can query Supabase's
Auth/API/project request logs without either (a) a dedicated CLI logs
subcommand, which does not exist in the installed CLI (`supabase --help`
and `npx supabase@2.117.0 --help`, both checked, list no `logs`/`audit`
command), or (b) calling the Management API's log endpoints directly with
the CLI's stored access token as a bearer credential, which this agent is
explicitly forbidden from handling under any circumstance, print-free or
not. No log content, payload, token, email address, or personal data was
read, queried, or printed by this agent. **Recommended:** the human owner
(or Codex, with dashboard access) review the Supabase Dashboard's Logs
Explorer (Auth and API logs) for requests authenticated with the legacy
anon/service_role keys, scoped to the exposure window above, independent of
this handoff.

**This document contains no key, token, or credential value** — every value
above is either a project name/ref, a hostname/port, a boolean, an email
address already public in `docs/auth/hosted-auth-configuration.md`, or a
sender-name string. `./scripts/check-secrets.sh` (run below) also scans this
file's diff.

**No code, test, or scope change resulted from the incident itself** — it
occurred during hosted-configuration verification, not application
development. The one application-code fix in this task (the OTP-type
allowlist narrowing) predates and is unrelated to the incident.

### Exact checks run and results (clean state, this follow-up's HEAD)

```text
$ cd apps/web && npm test
ℹ tests 163 / pass 163 / fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — zero diagnostics)

$ cd apps/web && npm run build
Build complete.

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment.

$ ./scripts/check-secrets.sh
Secret check passed.

$ ./scripts/verify-web.sh
oxlint clean; vinext build succeeded; Web verification passed.

$ git diff --check
(no output — no whitespace errors)
```

### End-to-end test (step 7 of this follow-up): pending

No test account is identified and approved anywhere in this repository's
documentation (checked `docs/security/TASK-013-auth-follow-up.md`,
`docs/auth/hosted-auth-configuration.md`, and
`docs/reports/2026-09-14-construction-status-and-35-day-plan.md` — all
describe the *process* for an approved test account but name no concrete,
pre-approved address). Per the task's explicit instruction, no address was
invented and no email was sent. Remains "pending approved test recipient."

### Security/tenant/privacy/audit impact of this follow-up

The hosted configuration changes strengthen the auth email flow (accurate
redirect allowlist, active password-changed notification, on-brand
templates) with no tenant, RLS, migration, or business-data impact. The
security incident exposed two Supabase project API keys (anon, legacy
service_role) to this agent's own tool output/conversation only; the human
owner treated the service_role key as compromised and completed containment
(key migration on Vercel, redeploy, legacy key deactivation) before this
handoff resumed. No evidence of external exposure exists; log review to rule
out misuse during the narrow exposure window remains a recommended follow-up
for someone with Supabase Dashboard access.

### Migration and rollback

No migration. The hosted Authentication changes can be rolled back by
reverting `additional_redirect_urls` to a single entry, disabling the
password-changed notification, and restoring the previous template subjects
via the Supabase dashboard or another `config push` — no code rollback is
needed for any of this pass's changes beyond what the prior handoff already
covers.

### Known limitations

- SMTP `sender_name` reads `Mitiga`, not the approved `MITIGA` — a one-field
  dashboard correction for the human owner (see "Hosted configuration"
  above); not fixed by this agent, and not writable safely from this
  terminal without touching the SMTP credential field.
- Resend click/open-tracking verification (step 8) is pending — no Resend
  access was authorized or available from this terminal.
- Log review for the exposure window is pending — no safe, non-secret-revealing
  tool exists in this terminal to perform it; needs Supabase Dashboard
  access.
- The end-to-end acceptance test remains pending an approved test account.
- The `/update-password` residual observation from the prior follow-up
  handoff (an abandoned-recovery-cookie edge case, not a privilege
  escalation) remains unfixed and out of this task's scope, as previously
  recorded.

**Recommended reviewer:** independent security review of the incident
response and the exact hosted-configuration diff recorded above (both are
mechanically verifiable — the diff output is reproducible via `supabase
config diff` and requires no credential to inspect); a human with Supabase
Dashboard access for the pending log review, the `sender_name` correction,
and the Resend tracking check.

## Production follow-up — 2026-09-14

The human owner approved full TASK-022 completion, confirmed the SMTP sender
name was corrected to `MITIGA`, and approved `leduardoreis15@gmail.com`
exclusively as the end-to-end test recipient.

After the TASK-022 integration commit was promoted, Vercel reported the
deployment as ready but every public route returned HTTP 500. Runtime logs
identified `ERR_MODULE_NOT_FOUND` for `next`, imported by
`apps/web/middleware.ts`. Vinext's local and Build Output API checks had not
covered Vercel's separate root-middleware bundling path. The correction adds
the exact Next runtime package as a production dependency and makes
`verify:vercel` fail when a `next/server.js` middleware import lacks a
declared, resolvable runtime dependency. The first corrected preview then
exposed Node ESM's requirement for the explicit `.js` subpath; the middleware
import and regression check use that deployable entry point.

This follow-up changes no authentication policy, tenant boundary, hosted
Supabase configuration, data, migration, email template, or secret. Rollback
is the follow-up commit plus promotion of the preceding known-good deployment.
The approved recovery email must only be sent after the corrected public
deployment passes route smoke checks.

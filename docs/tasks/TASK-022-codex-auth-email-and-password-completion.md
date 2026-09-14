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

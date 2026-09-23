# Hosted auth configuration — mitiga.online

## Approved identities

- Application origin: `https://mitiga.online`
- Sender name: `MITIGA`
- Sender address: `noreply@mitiga.online`

The sender spelling intentionally uses `noreply`, not `noreplay`.

## Resend and Supabase responsibilities

Supabase Auth owns confirmation, invitation, recovery, and security tokens.
Resend delivers those messages through Supabase's custom SMTP configuration.
Do not implement a second direct-Resend password-reset send in the application.

Configure Supabase Authentication SMTP with:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the Resend API key, entered directly in the Supabase dashboard
- Sender: `MITIGA <noreply@mitiga.online>`

`RESEND_API_KEY` may also exist as a Vercel Secret for later application-owned
notifications, but this auth flow does not read it.

## Supabase URL configuration

- Site URL: `https://mitiga.online`
- Exact production redirect: `https://mitiga.online/auth/confirm`
- Local redirect: `http://localhost:3000/auth/confirm`
- Preview wildcard only in a non-production test environment when needed:
  `https://*-*.vercel.app/auth/confirm`

Avoid a broad wildcard on the production domain. Set Vercel
`NEXT_PUBLIC_SITE_URL=https://mitiga.online` with Config visibility for Production.

## Template mapping

Paste the versioned HTML from `docs/auth/templates/` into the matching Supabase
Authentication email template. Suggested subjects:

- Confirm signup: `Confirm your MITIGA account`
- Invite user: `Your MITIGA access is ready`
- Reset password: `Reset your MITIGA password`
- Password changed notification: `Your MITIGA password was changed`

Enable the password-changed security notification. Disable click/open tracking for
auth email because link rewriting can break verification links.

## Manual acceptance test

Use a dedicated, human-approved test account. Never use a customer account.

1. Request recovery for an unknown address and confirm the UI does not disclose it.
2. Request recovery for the test account and inspect sender, subject, mobile layout,
   and `https://mitiga.online/auth/confirm` destination.
3. Open the link once, set a valid matching password, and reach `/workspace`.
4. Confirm the same link cannot be reused.
5. Confirm mismatched and short passwords fail without a provider message.
6. Send one dashboard invitation to the approved test address; activate it and set
   a password.
7. Confirm the password-changed security notification arrives.
8. Confirm Resend reports delivery and no secret appears in Vercel, Supabase, or
   application logs.

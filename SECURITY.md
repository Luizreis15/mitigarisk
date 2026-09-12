# Security policy

## Secret handling

Never commit, paste into a pull request, or place in an agent prompt:

- Supabase service-role keys, JWT secrets, database passwords, or connection strings;
- Resend API keys or webhook signing secrets;
- production tokens, private keys, customer exports, or unredacted personal data.

Local secrets belong in ignored `.env.local` files. Deployed secrets belong in the platform secret store. `.env.example` contains names and safe placeholders only.

If a secret is exposed, stop using it, revoke or rotate it at the provider, remove it from active branches, and record an incident. Rewriting Git history is not a substitute for rotation.

## High-risk change approval

Human approval is mandatory for production credentials, access policies, authentication, billing, tenant suspension, retention changes, destructive database migrations, data exports, and external notifications.

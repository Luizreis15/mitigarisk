# Local verification (no hosted project, no credentials)

`run-local-verification.sh` spins up a disposable Postgres cluster on the
local machine (via `initdb`/`pg_ctl`, no Docker and no network access),
applies:

1. `000-local-auth-shim.sql` — the minimum `auth` schema, roles, and
   `auth.uid()`/`auth.role()` that Supabase itself provisions in every real
   project. Test-only; never run against a real Supabase database.
2. Every file in `supabase/migrations/`, unmodified.
3. `supabase/seed.sql` — fictional development fixtures only.
4. `010-rls-tenant-isolation.sql` — authorized access, unauthenticated
   denial, cross-tenant denial, least-privilege, and published-policy
   immutability assertions.

Then tears the cluster down. Nothing here touches a hosted Supabase project,
reads `.env*`, or requires any credential.

Run it with:

```sh
supabase/tests/run-local-verification.sh
```

If `supabase start` (the official Supabase CLI, backed by Docker) is
available in a given environment, the same migrations and seed can
alternatively be verified with `supabase db reset`, which exercises the
platform's real `auth` schema instead of the shim.

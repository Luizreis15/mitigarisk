# TASK-012 — Claude Vercel preview adapter

## Objective

Make the existing Vinext application deployable as a functional Vercel preview
without removing its current Cloudflare Workers deployment path. The result
must serve app and dynamic routes on Vercel rather than producing a successful
build followed by `404 NOT_FOUND`.

## Context

The project is a Vinext/Vite app presently configured with
`@cloudflare/vite-plugin` and `wrangler` output. Vercel correctly runs
`npm run build`, but that Cloudflare artifact does not supply Vercel functions
or routing output. Vinext's documented path for Vercel is the Nitro Vite
adapter; use that target-specific adapter rather than copying output folders
or faking static files.

## In scope

- Work only in `apps/web/**`, `docs/architecture/**`, `docs/adr/**`,
  `docs/security/**`, GitHub/Vercel configuration files required for the
  adapter, and this task file.
- Add the supported Nitro/Vercel deployment path for Vinext.
- Make deployment target explicit and deterministic (for example through an
  explicit non-secret build target) so local/Cloudflare behavior is not
  silently replaced by Vercel behavior.
- Preserve functional routes including dynamic details:
  `/cases/:id`, `/evaluations/:id`, `/policies/:id`.
- Provide a non-secret Vercel build configuration/documented Project Settings
  for monorepo root `apps/web`, Node 22.x, and the Vercel build target.
- Add a local verification command or test that proves the Vercel build emits
  the required Vercel deployment output and does not merely complete a Vite
  build.
- Document preview environment variables by name only. The only currently
  needed public variables are `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`; do not add values to Git.

## Out of scope

- Vercel account/project changes, deployment, domain changes, secret entry,
  Supabase/Resend credential use, schema migrations, real authentication,
  product UI work, or removal of Cloudflare support.
- Adding `SUPABASE_SERVICE_ROLE_KEY`, database URLs, Resend keys, or any other
  server secret to Vercel or Git.

## Acceptance criteria

1. A documented Vercel-target build from `apps/web` emits the format Vercel
   needs to serve static assets and dynamic routes; it is not a Cloudflare
   `wrangler` artifact masquerading as a Vercel output.
2. Existing Cloudflare/local development build path remains documented and
   passes its existing verification.
3. `npm run build`, the Vercel-target verification, `npm test`, TypeScript,
   `./scripts/check-secrets.sh`, and `./scripts/verify-web.sh` pass as
   applicable.
4. No secrets, customer data, network calls, hosted deploys, or credentials
   appear in the diff.
5. The handoff states the exact Vercel dashboard settings and deployment
   command for Codex to use after merge.

## Required handoff

Create `feat/claude-vercel-preview-adapter` from current `main`. Use
Conventional Commits, do not merge, and append the standard handoff: outcome,
commits, changed files, checks, security/tenant impact, migration/rollback
notes, limitations, and recommended reviewer.

## Handoff notes (Claude Code)

_To be completed by Claude Code._

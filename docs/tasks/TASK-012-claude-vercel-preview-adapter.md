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

Outcome: implemented in full, exactly as scoped. Branch created from
current `main`.

Branch and commits: `feat/claude-vercel-preview-adapter`, `672dd3d` (Vercel
build via Vinext's Nitro adapter, explicit `DEPLOY_TARGET` switch),
`f9a5711` (Build Output verification script + CI job), `9f5b362` (ADR 0008
+ architecture doc), plus this handoff commit.

Files changed:
- `apps/web/vite.config.ts` — explicit `DEPLOY_TARGET` switch; `vercel`
  branch adds `nitro()` alongside `vinext()`, a targeted `resolve.alias`
  workaround (three bare CSS specifiers), and pins the Function runtime
  to `nodejs22.x`. The `cloudflare` (default) branch is byte-for-byte
  unchanged in behavior.
- `apps/web/package.json` (+lockfile) — new `nitro` devDependency, new
  `build:vercel`/`verify:vercel` scripts.
- `apps/web/vercel.json` — non-secret build command for a Vercel project
  rooted at `apps/web`.
- `apps/web/scripts/verify-vercel-build.mjs` — the Vercel-target
  verification command.
- `.github/workflows/quality.yml` — new `vercel-preview-quality` CI job
  running the verification script, parallel to the existing
  `database-quality` job.
- `docs/architecture/VERCEL-PREVIEW-ADAPTER.md`,
  `docs/adr/0008-vercel-preview-adapter.md`.

Decisions and assumptions (full rationale in ADR 0008):
- `DEPLOY_TARGET=vercel` is an explicit, non-secret build-time switch
  (never autodetected), so every existing invocation — local dev, the
  Cloudflare build, existing CI jobs — is provably unaffected unless this
  variable is set.
- Diagnosed and fixed a real build failure: once `nitro()` is present,
  three bare CSS-package `@import`s in `app/globals.css`
  (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`) fail to
  resolve (their CSS entry points sit behind a non-standard `"style"`
  export condition, or in `shadcn`'s case a subpath its own `exports` map
  doesn't declare). Isolated by toggling plugins one at a time
  (`vinext()` alone under `DEPLOY_TARGET=vercel`, no `nitro()`, builds
  fine) rather than assumed. Fixed with a `resolve.alias` mapping the
  three specifiers straight to their real `.css` files, scoped only to
  the `vercel` branch — `app/globals.css` itself, and the Cloudflare
  build's CSS handling, are untouched.
- The Vercel Function's Node runtime is pinned explicitly
  (`nitro: { vercel: { functions: { runtime: 'nodejs22.x' } } }`) rather
  than left to Nitro's own local-machine-Node-version inference, which
  had produced `nodejs24.x` on this machine before the fix.
- No Vercel account, project, domain, secret, or deployment was touched.
  Exact Project Settings (Root Directory `apps/web`, Node 22.x, build
  command, env var names only) and the deployment command are documented
  in `docs/architecture/VERCEL-PREVIEW-ADAPTER.md` for Codex to apply
  after human review — acceptance criterion 5.

Checks run and exact results (all from a clean local state, matching the
task's required list):
- `npm run build` (Cloudflare, `apps/web`) — succeeds, unchanged output
  shape (`dist/server/wrangler.json` and friends), same route report as
  before this task.
- `npm run verify:vercel` (`apps/web`) — builds with
  `DEPLOY_TARGET=vercel NITRO_PRESET=vercel`, then asserts and confirms:
  `.vercel/output/config.json` is Build Output API `version: 3`; at least
  one `*.func` function exists whose declared handler file is actually
  present on disk; `.vercel/output/static/_next` (client assets) exists;
  no Cloudflare `wrangler.json`/`server/` artifact is present. Passed.
- `npm test` (`apps/web`, `node --test`) — 60/60 pass (unchanged from
  before this task; this task added no domain tests).
- `npx tsc --noEmit -p tsconfig.json` (`apps/web`) — no errors.
- `./scripts/check-secrets.sh` — "Secret check passed."
- `./scripts/verify-web.sh` (oxlint with CI's ignore patterns, plus
  `vinext build`) — lint clean, build succeeds.

Security/tenant/audit impact: none. No Supabase/Resend credential, real
authentication, database write, or network call was introduced — the
Vercel branch only changes which Vite build plugins run and where the
build artifact lands. The only environment variables this deployment
target needs are the two already-public ones
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`),
documented by name only; no value was entered anywhere in this diff, and
`./scripts/check-secrets.sh` confirms none is present.

Migration and rollback notes: no `supabase/**` file touched. Rollback is
reverting the four commits on this branch (or simply never merging it,
per the task's explicit "do not merge"); the Cloudflare deployment path
is untouched and would continue working exactly as before regardless.

Known limitations: verified locally only — no real Vercel account,
project, or deployment exists yet; a human/Codex must apply the
documented Project Settings and run an actual `vercel deploy` after
reviewing this branch. `vinext`/`nitro` are both pre-1.0/beta packages;
the CSS `resolve.alias` workaround depends on their current (beta)
resolution behavior and should be re-verified (`npm run verify:vercel`)
after any version bump of either.

Recommended reviewer: an independent agent or Codex (as the operator who
will actually apply the Vercel Project Settings and deploy) to confirm
the documented settings match what the Vercel dashboard expects, and to
re-run `npm run verify:vercel` after any future `vinext`/`nitro` upgrade
given both are beta packages.

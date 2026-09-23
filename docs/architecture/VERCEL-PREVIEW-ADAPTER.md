# Vercel preview adapter (TASK-012)

`apps/web` is a Vinext (Vite-based Next.js-compatible) application whose
primary deployment target is Cloudflare Workers (`@cloudflare/vite-plugin` +
`wrangler`). This document covers the second, explicitly-selected build
target added by TASK-012: a real Vercel deployment via Vinext's documented
[Nitro](https://v3.nitro.build/) Vite adapter. It does not replace or
change the Cloudflare path — see `apps/web/AGENTS.md` and
`docs/architecture/PLATFORM-ARCHITECTURE.md` for the platform's default
runtime baseline, which is unchanged.

## Why this exists

Vercel already runs `npm run build` successfully against this repository,
but that command (`vinext build`) emits a Cloudflare Workers artifact
(`dist/server/wrangler.json` and friends) — a format Vercel does not know
how to serve. The result was a green build followed by `404 NOT_FOUND` on
every route. This is not a bug in the Cloudflare build; it is simply the
wrong artifact for Vercel's routing layer.

## The explicit deployment target switch

`apps/web/vite.config.ts` picks between two completely separate plugin
sets based on one environment variable, defaulting to the existing,
unchanged Cloudflare path:

| `DEPLOY_TARGET` | Plugins | Output |
|---|---|---|
| unset / anything else (default) | `vinext()`, `sites()`, `cloudflare()` | `dist/` — Cloudflare Workers artifact (unchanged from before this task) |
| `vercel` | `vinext()`, `nitro()` | `.vercel/output/` — Vercel Build Output API v3 |

This is deliberately a build-time switch on a non-secret variable, not
autodetection: local development (`npm run dev`), the existing Cloudflare
build, and CI's existing `database-quality`/`web-quality` jobs never
change behavior unless `DEPLOY_TARGET=vercel` is set explicitly. See ADR
0008 for why Nitro (rather than copying/faking output) and why the build
needed an additional `resolve.alias` fix.

## Commands

- `npm run build` — unchanged Cloudflare Workers build (`vinext build` →
  `dist/`).
- `npm run build:vercel` — `DEPLOY_TARGET=vercel NITRO_PRESET=vercel vite
  build` → `.vercel/output/`. `NITRO_PRESET=vercel` is set explicitly
  because Nitro's platform auto-detection only fires inside recognized
  CI/CD environments (Vercel's own build environment, Netlify, AWS
  Amplify, etc.) — not a plain local shell or GitHub Actions runner.
- `npm run verify:vercel` — runs `build:vercel` and then asserts the
  result is genuine Vercel deployment output (Build Output API v3
  `config.json`, a Node.js function whose declared handler file actually
  exists, and a `static/_next` client asset bundle) rather than a
  completed-but-wrong build. See
  `apps/web/scripts/verify-vercel-build.mjs`. This is the "Vercel-target
  verification" required by TASK-012's acceptance criteria; run it as
  part of any change to `vite.config.ts` or the `nitro`/`vinext`
  dependency versions.

## Dynamic routes

`/cases/:id`, `/evaluations/:id`, `/policies/:id` are served the same way
every other App Router route is: a single catch-all Vercel Function
(`.vercel/output/functions/__server.func`) contains the full RSC/SSR
bundle and Vinext's own router, and `config.json` routes every
non-`_next/static` request to it (`"src": "/(.*)", "dest": "/__server"`).
This is the standard Vercel pattern for a full SSR framework function —
there is one function, not one per dynamic route — and it is the same
routing code that already serves these routes under Cloudflare Workers.
`verify-vercel-build.mjs` asserts the function's declared handler file
exists so a build that silently produced an empty/broken function fails
loudly instead of deploying a working-looking `.vc-config.json` that
404s at request time.

## Vercel Project Settings (for Codex to apply after this branch merges)

This task does not touch a Vercel account, project, or deployment — these
are the exact settings to apply by hand, or via `vercel link`/`vercel
project`, once a human has reviewed this branch:

- **Root Directory:** `apps/web` (this is a monorepo; Vercel must build
  from here, not the repository root).
- **Framework Preset:** Other (the repo supplies its own Build Output API
  v3 output via `apps/web/vercel.json`'s `buildCommand`; no framework
  zero-config detection should run).
- **Build Command:** `npm run build:vercel` (already set in
  `apps/web/vercel.json`; the dashboard should leave "Override" off and
  use the repo's own setting).
- **Output Directory:** leave at the default. `.vercel/output/` is
  Vercel's fixed, well-known Build Output API location — it is detected
  automatically and must not be overridden.
- **Install Command:** default (`npm ci` / `npm install`).
- **Node.js Version:** 22.x, matching `apps/web/package.json`'s
  `engines.node` (`>=22.13.0`). The deployed Function's own runtime is
  additionally pinned to `nodejs22.x` explicitly in `vite.config.ts`
  (`nitro: { vercel: { functions: { runtime: 'nodejs22.x' } } }`), so the
  Function runtime does not depend on this dashboard setting matching —
  but the install/build toolchain still should.
- **Environment Variables (Preview and Production, values entered
  directly in the Vercel dashboard — never in Git):**
  - `NEXT_PUBLIC_SUPABASE_URL` — the Supabase project URL. Public by
    design (`apps/web/lib/supabase/env.ts`).
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the Supabase anonymous key. Public
    by design; every table it can reach is still gated by RLS
    server-side (`docs/architecture/PLATFORM-ARCHITECTURE.md`, "Supabase
    boundary").
  - Nothing else is required for this preview to build and serve routes.
    Do not add `SUPABASE_SERVICE_ROLE_KEY`, a database URL, a Resend key,
    or any other server secret to this Vercel project — none of the code
    that would use them is exercised by this adapter (TASK-012 is
    explicitly scoped to exclude real authentication, Supabase/Resend
    credential use, and schema migrations).

## Deployment command

Once Project Settings above are applied and the branch is merged, deploy
with the standard Vercel CLI/dashboard flow — this task does not run
either:

```sh
cd apps/web
vercel deploy            # preview deployment
vercel deploy --prod     # production deployment
```

Both pick up the `buildCommand` from `apps/web/vercel.json` automatically.
An already-built `.vercel/output/` (e.g. produced locally by `npm run
build:vercel` for a quick manual check) can also be deployed directly with
`vercel deploy --prebuilt`, matching the command Nitro itself prints after
a successful build.

## Known limitations

- Verified locally only, against a disposable `.vercel/output/` directory
  — no Vercel account, project, domain, or deployment was created or
  touched by this task.
- `vinext`/`nitro` are both pre-1.0/beta packages
  (`vinext@1.0.0-beta.9`, `nitro@3.0.260903-beta`); the `resolve.alias`
  workaround in `vite.config.ts` (see ADR 0008) may become unnecessary or
  need adjustment on a future upgrade of either.
- Prerendering/ISR route classification is the same "best-effort static
  analysis" Vinext already reports for the Cloudflare build (see the `?
  Unknown` routes in either build's output) — this task did not change
  that behavior for either target.

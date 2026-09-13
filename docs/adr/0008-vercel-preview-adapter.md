# ADR 0008 — Vercel preview via Vinext's Nitro adapter, selected by an explicit build-time switch

- Status: accepted
- Date: 2026-09-13

## Context

Vercel already ran `npm run build` against this repository successfully,
but the command (`vinext build`) produces a Cloudflare Workers artifact
(`dist/server/wrangler.json`), which Vercel cannot serve — every route
404s despite a green build. TASK-012 asks for a real, functional Vercel
preview without removing the existing Cloudflare deployment path, using
"the supported Nitro/Vercel deployment path for Vinext... rather than
copying output folders or faking static files."

Vinext's own README documents exactly this: Cloudflare Workers has native,
deepest support, and every other platform (Vercel, Netlify, AWS, Deno
Deploy) is reached via the [Nitro](https://v3.nitro.build/) Vite plugin
added alongside `vinext()`.

## Decisions

**One `vite.config.ts`, one explicit switch, not two config files or
autodetection.** `DEPLOY_TARGET=vercel` selects `nitro()` in place of
`cloudflare()`/`sites()`; anything else (including unset, which covers
every existing local-dev, Cloudflare-build, and CI invocation) preserves
the exact pre-task behavior. This directly satisfies TASK-012's
requirement that "local/Cloudflare behavior is not silently replaced by
Vercel behavior" — a `git diff` reviewer can see the entire blast radius
of "building for Vercel" is contained inside one `if` branch that nothing
runs through by default.

**`sites()` and the Cloudflare D1/R2 binding config are omitted from the
Vercel branch, not merely inert.** `@openai/sites-vite-plugin`'s README
states it "assumes Vite's default `dist` output directory," which Nitro's
`.output`/`.vercel/output` build does not use — keeping it in the Vercel
branch would be silently-broken dead weight, not a real code path change
under test.

**A `resolve.alias` workaround for three bare CSS-package specifiers.**
`app/globals.css` uses Tailwind v4's CSS-first syntax
(`@import 'tailwindcss'`, `@import 'tw-animate-css'`, `@import
'shadcn/tailwind.css'`). These resolve fine under the Cloudflare target
but fail under the Nitro/Vercel target with a raw `ENOENT` trying to open
a literal file named `tailwindcss` at the project root — reproduced and
isolated by removing plugins one at a time: `nitro()`'s presence is the
trigger (`vinext()` alone under `DEPLOY_TARGET=vercel`, no `nitro()`,
builds fine to the default `dist/` shape). The nitro plugin's own
environment/build configuration changes how Vite's internal CSS `@import`
resolver reaches these packages' `exports` maps (their CSS entry points
are declared under a non-standard `"style"` export condition, or in
`shadcn`'s case a subpath — `./tailwind.css` — the package's own
`exports` map does not even declare, yet resolves today via whatever
fallback the working Cloudflare/default resolution path uses). Rather
than depend on undocumented resolver internals of two beta packages
(`vinext@1.0.0-beta.9`, `nitro@3.0.260903-beta`), `vite.config.ts`'s
Vercel branch aliases the three bare specifiers straight to their real
`.css` files on disk (`node_modules/tailwindcss/index.css`,
`node_modules/tw-animate-css/dist/tw-animate.css`,
`node_modules/shadcn/dist/tailwind.css`). This sidesteps package-exports
resolution for these three imports entirely, is easy to verify by
reading, and does not touch the shared `app/globals.css` file (so the
Cloudflare build's CSS handling is provably unaffected — it never
executes this branch).

**The Vercel Function's Node runtime is pinned explicitly
(`nitro: { vercel: { functions: { runtime: 'nodejs22.x' } } }`), not left
to Nitro's own inference.** Nitro's `resolveVercelRuntime()` otherwise
picks a runtime from the *local build machine's* Node version if no
override is set — meaning a build run under a newer local/CI Node could
silently ship a different (newer) Lambda runtime than intended. Pinning
to `nodejs22.x` matches `apps/web/package.json`'s `engines.node` and
TASK-012's explicit requirement, and makes the deployed runtime
deterministic regardless of who or what triggers the build.

**Verification is a script, not just a passing exit code.** A `vite
build` that silently regresses to the old Cloudflare-shaped output (or
produces an incomplete Nitro output — e.g. a function whose declared
handler file doesn't actually exist) would still exit 0. `apps/web/scripts/verify-vercel-build.mjs`
asserts the actual Build Output API v3 shape Vercel requires
(`config.json` with `version: 3`, at least one `*.func` directory whose
`.vc-config.json` declares a real, existing Node.js handler, and a
`static/_next` client asset directory) and explicitly fails if a
Cloudflare-shaped artifact (`wrangler.json`, a `server/` directory) ends
up inside `.vercel/output` — directly encoding acceptance criterion 1
("not a Cloudflare wrangler artifact masquerading as a Vercel output") as
a check rather than trusting a build's exit code alone.

## Consequences

- `npm run build` (Cloudflare, default) is untouched: same command, same
  plugins, same output shape, verified by re-running it after this task's
  changes and diffing behavior against the pre-task baseline.
- `npm run verify:vercel` is the one command that proves the Vercel path
  actually works end to end (build + shape assertions); it should be run
  again after any `vinext`/`nitro` version bump or `vite.config.ts`
  change, since the CSS alias workaround depends on internal behavior of
  two beta packages that may change without a major version bump.
- No Vercel account, project, secret, or deployment was touched by this
  task — `docs/architecture/VERCEL-PREVIEW-ADAPTER.md` hands Codex the
  exact Project Settings and deployment commands to apply by hand after
  human review, per TASK-012's required handoff.
- If a future `vinext`/`nitro` upgrade fixes the underlying CSS resolution
  gap upstream, the `resolve.alias` block becomes a safe no-op (an alias
  to the same file the default resolver would have found anyway) rather
  than something that must be removed urgently — but it is worth
  revisiting then to keep the config minimal.

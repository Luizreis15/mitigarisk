import { fileURLToPath } from 'node:url';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json' with { type: 'json' };

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

// Explicit, non-secret deployment target switch (docs/architecture/VERCEL-PREVIEW-ADAPTER.md).
// Defaults to the existing Cloudflare Workers path so local dev and the
// current deployment are never silently changed; only an explicit
// `DEPLOY_TARGET=vercel` picks the Nitro Vite adapter Vinext documents for
// non-Cloudflare targets (https://v3.nitro.build/).
const deployTarget = process.env.DEPLOY_TARGET === 'vercel' ? 'vercel' : 'cloudflare';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async () => {
  if (deployTarget === 'vercel') {
    // Vinext's documented path for platforms other than Cloudflare: the
    // Nitro Vite plugin (https://v3.nitro.build/). `sites()` and the
    // Cloudflare D1/R2 binding config above are Cloudflare/OpenAI-Sites
    // specific and are deliberately omitted here, not just unused — the
    // `sites()` plugin's `dist/` output assumption does not match Nitro's
    // `.output/` build output.
    const { nitro } = await import('nitro/vite');

    return {
      css: { postcss: { plugins: [tailwindcss()] } },
      // The nitro plugin's own environment/build config changes how Vite's
      // CSS `@import` resolver reaches these packages' `exports` maps
      // ("style" condition / subpath-without-explicit-export cases), which
      // otherwise resolve fine under the Cloudflare target. Aliasing the
      // bare specifiers straight to their real CSS files sidesteps that
      // resolution path entirely rather than depending on it.
      resolve: {
        alias: {
          tailwindcss: fileURLToPath(
            new URL('./node_modules/tailwindcss/index.css', import.meta.url),
          ),
          'tw-animate-css': fileURLToPath(
            new URL('./node_modules/tw-animate-css/dist/tw-animate.css', import.meta.url),
          ),
          'shadcn/tailwind.css': fileURLToPath(
            new URL('./node_modules/shadcn/dist/tailwind.css', import.meta.url),
          ),
        },
      },
      // Pin the Vercel Function runtime explicitly (matches this project's
      // `engines.node` range and the documented Vercel Project Settings in
      // docs/architecture/VERCEL-PREVIEW-ADAPTER.md) instead of letting
      // Nitro infer it from the local build machine's Node version.
      nitro: { vercel: { functions: { runtime: 'nodejs22.x' } } },
      plugins: [vinext(), nitro()],
    };
  }

  // Cloudflare Workers (default): unchanged from before this task.
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});

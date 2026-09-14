#!/usr/bin/env node
// TASK-012: proves the Vercel-target build emits real Vercel deployment
// output — the Build Output API v3 shape (config.json + functions/*.func +
// static/) — and not merely a completed Vite build or a relabeled
// Cloudflare `wrangler` artifact.
//
// Runs `vite build` with the explicit, non-secret DEPLOY_TARGET=vercel /
// NITRO_PRESET=vercel switch (see vite.config.ts), then asserts the
// resulting .vercel/output/ directory has the shape Vercel requires.
// Never touches Vercel's dashboard, deploys anything, or reads a secret.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const outputDir = path.join(webRoot, ".vercel", "output");
const require = createRequire(import.meta.url);

function fail(message) {
  console.error(`\n✗ Vercel output verification failed: ${message}\n`);
  process.exit(1);
}

function readJson(filePath, label) {
  if (!existsSync(filePath)) {
    fail(`expected ${label} at ${path.relative(webRoot, filePath)}, but it does not exist`);
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} at ${path.relative(webRoot, filePath)} is not valid JSON: ${error.message}`);
  }
}

const middlewarePath = path.join(webRoot, "middleware.ts");
const middlewareSource = existsSync(middlewarePath) ? readFileSync(middlewarePath, "utf8") : "";
if (/from\s+["']next\/server(?:\.js)?["']/.test(middlewareSource)) {
  const packageJson = readJson(path.join(webRoot, "package.json"), "package.json");
  if (!packageJson.dependencies?.next) {
    fail("middleware.ts imports next/server.js, so next must be a production dependency for Vercel's separately bundled middleware");
  }
  try {
    require.resolve("next/server.js");
  } catch {
    fail("middleware.ts imports next/server.js, but that runtime entry point cannot be resolved");
  }
}

console.log("==> cleaning any stale .vercel/output");
rmSync(outputDir, { recursive: true, force: true });

console.log("==> building with DEPLOY_TARGET=vercel NITRO_PRESET=vercel npx vite build");
execFileSync("npx", ["vite", "build"], {
  cwd: webRoot,
  stdio: "inherit",
  env: { ...process.env, DEPLOY_TARGET: "vercel", NITRO_PRESET: "vercel" },
});

console.log("\n==> verifying .vercel/output/ is real Vercel Build Output API v3 output");

const config = readJson(path.join(outputDir, "config.json"), "Build Output config.json");
if (config.version !== 3) {
  fail(`config.json version must be 3 (Vercel's Build Output API), got ${JSON.stringify(config.version)}`);
}
if (!Array.isArray(config.routes) || config.routes.length === 0) {
  fail("config.json must declare at least one route");
}

const functionsDir = path.join(outputDir, "functions");
if (!existsSync(functionsDir)) {
  fail("expected a functions/ directory — a static-only build cannot serve dynamic routes");
}
const functionDirs = readdirSync(functionsDir).filter((name) => name.endsWith(".func"));
if (functionDirs.length === 0) {
  fail("expected at least one *.func directory under functions/");
}

let sawServerlessDynamicRouteHandler = false;
for (const functionDir of functionDirs) {
  const vcConfig = readJson(
    path.join(functionsDir, functionDir, ".vc-config.json"),
    `${functionDir}/.vc-config.json`,
  );
  if (typeof vcConfig.runtime !== "string" || !vcConfig.runtime.startsWith("nodejs")) {
    fail(`${functionDir}/.vc-config.json runtime must be a nodejs*.x runtime, got ${JSON.stringify(vcConfig.runtime)}`);
  }
  if (!vcConfig.handler || typeof vcConfig.handler !== "string") {
    fail(`${functionDir}/.vc-config.json must declare a handler entry point`);
  }
  if (existsSync(path.join(functionsDir, functionDir, vcConfig.handler))) {
    sawServerlessDynamicRouteHandler = true;
  }
}
if (!sawServerlessDynamicRouteHandler) {
  fail("no function's declared handler file actually exists — dynamic routes (/cases/:id, /evaluations/:id, /policies/:id) would 404");
}

const staticDir = path.join(outputDir, "static");
if (!existsSync(staticDir)) {
  fail("expected a static/ directory for client assets");
}
if (!existsSync(path.join(staticDir, "_next"))) {
  fail("expected static/_next/ (the client asset bundle) — got a function without its client assets");
}

// The defect this whole task exists to fix: Vercel running `npm run build`
// against the Cloudflare artifact and returning a successful build followed
// by 404s. Assert the Cloudflare-specific artifact was not just copied in.
if (existsSync(path.join(outputDir, "wrangler.json")) || existsSync(path.join(outputDir, "server"))) {
  fail(".vercel/output contains a Cloudflare wrangler artifact, not real Vercel output");
}

console.log("✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment: config.json (v3), a Node.js function with a real handler, and a static/_next client bundle.\n");

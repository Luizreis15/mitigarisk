import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// TASK-019 guardrail: "Middleware refreshes authentication only; it must
// not select a tenant or authorize a capability." Proven by source
// inspection, the same style already used by
// tests/app/workspace-component-boundary.test.ts and
// tests/supabase/no-service-role-in-client-boundary.test.ts: middleware.ts
// must never import or reference any tenant-selection or
// capability-checking primitive, so a future edit that tries to add
// authorization logic here fails this test rather than silently shipping a
// second, middleware-only authorization boundary.

const middlewarePath = fileURLToPath(new URL("../../middleware.ts", import.meta.url));
const source = readFileSync(middlewarePath, "utf8");

const FORBIDDEN_REFERENCES = [
  "tenant-selection",
  "tenant-context",
  "resolveActiveTenantContext",
  "resolveAuthorizedTenantContext",
  "resolveRequestIdentity",
  "hasCapability",
  "assertCapability",
  "has_capability",
  "is_platform_admin",
  ".from(",
  "memberships",
  "SERVICE_ROLE",
  "getServiceRoleSupabaseConfig",
];

void test("middleware.ts never references tenant selection, capability checks, or service-role credentials", () => {
  for (const forbidden of FORBIDDEN_REFERENCES) {
    assert.equal(
      source.includes(forbidden),
      false,
      `middleware.ts must not reference "${forbidden}"`,
    );
  }
});

void test("middleware.ts only calls auth.getUser() for its session-refresh side effect", () => {
  assert.ok(source.includes("supabase.auth.getUser()"), "middleware.ts must refresh the session");
  assert.equal(source.includes(".rpc("), false, "middleware.ts must not call any RPC");
});

void test("middleware.ts excludes static assets from its matcher", () => {
  assert.ok(source.includes("_next/static"), "matcher must exclude _next/static");
  assert.ok(source.includes("_next/image"), "matcher must exclude _next/image");
});

void test("middleware.ts uses standard request headers rather than NextRequest-only cookies", () => {
  assert.equal(source.includes("request.cookies"), false, "Vercel invokes the middleware with a standard Request");
  assert.ok(source.includes("request.headers"), "middleware must read cookies through standard HTTP headers");
});

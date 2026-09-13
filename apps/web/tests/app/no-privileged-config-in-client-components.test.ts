import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// "Add tests for ... absence of privileged configuration in client code"
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md). Every
// component marked 'use client' that this task added or touched must
// never reference a service-role credential or import the server-only
// Supabase boundary — the client bundle must only ever carry the public
// URL/anon key, and only via components that never mention the
// privileged pair at all.

const CLIENT_COMPONENT_FILES = [
  "components/auth/sign-in-form.tsx",
  "components/auth/password-reset-form.tsx",
  "components/auth/config-missing-notice.tsx",
];

void test("auth client components are marked 'use client' where interactive", () => {
  for (const file of ["components/auth/sign-in-form.tsx", "components/auth/password-reset-form.tsx"]) {
    const path = fileURLToPath(new URL(`../../${file}`, import.meta.url));
    const source = readFileSync(path, "utf8");
    assert.ok(source.startsWith("'use client'"), `${file} must be a client component`);
  }
});

void test("auth client components never reference SERVICE_ROLE or import the server-only Supabase boundary", () => {
  for (const file of CLIENT_COMPONENT_FILES) {
    const path = fileURLToPath(new URL(`../../${file}`, import.meta.url));
    const source = readFileSync(path, "utf8");
    assert.ok(!source.includes("SERVICE_ROLE"), `${file} must never reference a service-role credential`);
    assert.ok(
      !source.includes("lib/supabase/server") && !source.includes("lib/supabase/env"),
      `${file} must never import the server-only Supabase boundary`,
    );
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Belt-and-suspenders alongside server-browser-guard.test.ts: proves by
// source inspection that the modules reachable from browser code
// (browser.ts, the cookie-backed session helper, and the auth use cases
// built on top of it) never even reference SUPABASE_SERVICE_ROLE_KEY, so a
// future edit cannot accidentally wire the service-role key into a client
// bundle without this test catching it at the text level, independent of
// whether the code path is actually exercised at runtime.

const CLIENT_REACHABLE_FILES = ["browser.ts", "session.ts", "auth.ts"];

void test("browser-reachable Supabase modules never reference SUPABASE_SERVICE_ROLE_KEY", () => {
  for (const file of CLIENT_REACHABLE_FILES) {
    const path = fileURLToPath(new URL(`../../lib/supabase/${file}`, import.meta.url));
    const source = readFileSync(path, "utf8");
    assert.ok(
      !source.includes("SERVICE_ROLE"),
      `${file} must never reference a service-role credential`,
    );
  }
});

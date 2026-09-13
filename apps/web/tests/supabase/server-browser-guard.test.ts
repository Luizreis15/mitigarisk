import { test } from "node:test";
import assert from "node:assert/strict";

// Proves apps/web/lib/supabase/server.ts (the only module in this codebase
// that ever touches SUPABASE_SERVICE_ROLE_KEY) refuses to load at all in a
// browser context. This must be the only test in this process that imports
// server.ts: the guard only fires on the module's first evaluation, and
// `node --test` isolates each matched file into its own process, so this
// file being self-contained is what makes the assertion meaningful.

void test("lib/supabase/server.ts throws immediately when window is defined", async () => {
  assert.equal(typeof (globalThis as { window?: unknown }).window, "undefined");
  (globalThis as { window?: unknown }).window = {};

  try {
    await assert.rejects(
      () => import("../../lib/supabase/server.ts"),
      /must not be imported from browser code/,
    );
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

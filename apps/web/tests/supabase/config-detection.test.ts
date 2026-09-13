import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPublicSupabaseConfig } from "../../lib/supabase/env.ts";

// "Missing public Supabase configuration must produce a clear, non-sensitive
// configuration state rather than a crash or a fallback to fake
// authentication" (docs/tasks/TASK-015-claude-real-auth-route-integration.md).

function withEnv(overrides: Record<string, string | undefined>, run: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const key of Object.keys(previous)) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

void test("hasPublicSupabaseConfig is false when either variable is missing", () => {
  withEnv(
    { NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" },
    () => assert.equal(hasPublicSupabaseConfig(), false),
  );
  withEnv(
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined },
    () => assert.equal(hasPublicSupabaseConfig(), false),
  );
  withEnv(
    { NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined },
    () => assert.equal(hasPublicSupabaseConfig(), false),
  );
});

void test("hasPublicSupabaseConfig is true when both variables are set", () => {
  withEnv(
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" },
    () => assert.equal(hasPublicSupabaseConfig(), true),
  );
});

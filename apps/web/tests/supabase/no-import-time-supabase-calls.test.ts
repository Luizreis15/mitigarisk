import { test } from "node:test";
import assert from "node:assert/strict";

// Acceptance criterion 1 (docs/tasks/TASK-013-claude-supabase-auth-session-foundation.md):
// "Auth flows have typed input/error boundaries and do not call Supabase at
// module import time." Proven by importing the auth-flow modules with the
// Supabase env vars deliberately unset: if any of them read configuration
// or constructed a client at the top level, this import would throw.

void test("importing the auth/session/identity modules never throws, even with no Supabase env vars set", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    await assert.doesNotReject(() => import("../../lib/supabase/auth.ts"));
    await assert.doesNotReject(() => import("../../lib/supabase/identity.ts"));
    await assert.doesNotReject(() => import("../../lib/domain/auth-session.ts"));
  } finally {
    if (previousUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
});

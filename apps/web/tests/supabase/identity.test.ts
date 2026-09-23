import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isExpiredSessionError, isNoSessionError, resolveRequestIdentity } from "../../lib/supabase/identity.ts";
import {
  NoActiveSessionError,
  SessionExpiredError,
  SessionResolutionError,
} from "../../lib/domain/auth-session.ts";

// Fakes a SupabaseClient's .auth.getUser()/.rpc() shape so
// resolveRequestIdentity — the protected-route primitive — can be tested
// without a network call or a real Supabase project.
function fakeClient(overrides: {
  getUser: () => Promise<{ data: { user: unknown }; error: unknown }>;
  rpc?: () => Promise<{ data: unknown; error: unknown }>;
}): SupabaseClient {
  return {
    auth: { getUser: overrides.getUser },
    rpc: overrides.rpc ?? (async () => ({ data: true, error: null })),
  } as unknown as SupabaseClient;
}

void test("isNoSessionError recognizes AuthSessionMissingError by name", () => {
  assert.equal(isNoSessionError({ name: "AuthSessionMissingError" }), true);
});

void test("isNoSessionError recognizes session_not_found by code", () => {
  assert.equal(isNoSessionError({ code: "session_not_found" }), true);
});

void test("isNoSessionError is false for an unrelated error", () => {
  assert.equal(isNoSessionError({ name: "AuthApiError", code: "invalid_credentials" }), false);
});

void test("isExpiredSessionError recognizes session_expired by code", () => {
  assert.equal(isExpiredSessionError({ code: "session_expired" }), true);
});

void test("isExpiredSessionError is false for an unrelated error", () => {
  assert.equal(isExpiredSessionError({ code: "session_not_found" }), false);
});

void test("resolveRequestIdentity fails closed with NoActiveSessionError when there is no session", async () => {
  const client = fakeClient({
    getUser: async () => ({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    }),
  });
  await assert.rejects(() => resolveRequestIdentity(client), NoActiveSessionError);
});

void test("resolveRequestIdentity fails closed with NoActiveSessionError when getUser returns no user and no error", async () => {
  const client = fakeClient({ getUser: async () => ({ data: { user: null }, error: null }) });
  await assert.rejects(() => resolveRequestIdentity(client), NoActiveSessionError);
});

void test("resolveRequestIdentity fails closed with SessionExpiredError for an expired session", async () => {
  const client = fakeClient({
    getUser: async () => ({
      data: { user: null },
      error: { name: "AuthApiError", code: "session_expired", message: "Session Expired" },
    }),
  });
  await assert.rejects(() => resolveRequestIdentity(client), SessionExpiredError);
});

void test("resolveRequestIdentity fails closed with SessionResolutionError for any other invalid session", async () => {
  const client = fakeClient({
    getUser: async () => ({
      data: { user: null },
      error: { name: "AuthApiError", code: "bad_jwt", message: "invalid JWT" },
    }),
  });
  await assert.rejects(() => resolveRequestIdentity(client), SessionResolutionError);
});

void test("resolveRequestIdentity fails closed with SessionResolutionError when the capability RPC fails", async () => {
  const client = fakeClient({
    getUser: async () => ({ data: { user: { id: "10000000-0000-0000-0000-000000000001" } }, error: null }),
    rpc: async () => ({ data: null, error: { message: "function is_platform_admin() does not exist" } }),
  });
  await assert.rejects(() => resolveRequestIdentity(client), SessionResolutionError);
});

void test("resolveRequestIdentity resolves the verified identity on a valid session", async () => {
  const client = fakeClient({
    getUser: async () => ({ data: { user: { id: "10000000-0000-0000-0000-000000000001" } }, error: null }),
    rpc: async () => ({ data: false, error: null }),
  });
  const identity = await resolveRequestIdentity(client);
  assert.equal(identity.userId, "10000000-0000-0000-0000-000000000001");
  assert.equal(identity.isPlatformAdmin, false);
});

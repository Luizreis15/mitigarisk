import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestIdentity } from "../domain/identity";
import type { UserId } from "../domain/ids";

// Resolves the identity behind the current request from the Supabase
// session the client was constructed with (see
// apps/web/lib/supabase/server.ts, createRequestScopedSupabaseClient) —
// never from a request body or header a caller could set themselves.
// client.auth.getUser() re-validates the access token against Supabase Auth
// on every call rather than trusting a locally-decoded, unverified JWT.
export async function resolveRequestIdentity(client: SupabaseClient): Promise<RequestIdentity> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unable to resolve an authenticated user for this request");
  }
  const userId = data.user.id as UserId;

  // public.is_platform_admin() (supabase/migrations/20260913090000_auth_tenant_bootstrap.sql)
  // is the single source of truth; it is checked here, not re-derived from
  // any claim on the token.
  const { data: isPlatformAdmin, error: adminError } = await client.rpc("is_platform_admin");
  if (adminError) {
    throw new Error(`is_platform_admin RPC failed: ${adminError.message}`);
  }

  return { userId, isPlatformAdmin: isPlatformAdmin === true };
}

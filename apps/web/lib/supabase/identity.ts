import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestIdentity } from "../domain/identity";
import type { UserId } from "../domain/ids";
import { NoActiveSessionError, SessionExpiredError, SessionResolutionError } from "../domain/auth-session.ts";

// Resolves the identity behind the current request from the Supabase
// session the client was constructed with (see
// apps/web/lib/supabase/session.ts, createServerSupabaseClient, or
// apps/web/lib/supabase/server.ts, createRequestScopedSupabaseClient) —
// never from a request body or header a caller could set themselves.
// client.auth.getUser() re-validates the access token against Supabase Auth
// on every call rather than trusting a locally-decoded, unverified JWT.
//
// This is the protected-route primitive: a future route/Server Component
// that must require an authenticated user calls this and lets
// NoActiveSessionError/SessionResolutionError propagate (fail closed) when
// no valid session exists, rather than falling back to any client-supplied
// role or tenant id.

/** True for the specific "no session at all" error Supabase's SDK raises for getUser(). */
export function isNoSessionError(error: { name?: string; code?: string }): boolean {
  return error.name === "AuthSessionMissingError" || error.code === "session_not_found";
}

/** True for a session that existed but is no longer valid (expired or revoked token). */
export function isExpiredSessionError(error: { code?: string }): boolean {
  return error.code === "session_expired";
}

export async function resolveRequestIdentity(client: SupabaseClient): Promise<RequestIdentity> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (isNoSessionError(error)) throw new NoActiveSessionError();
    if (isExpiredSessionError(error)) throw new SessionExpiredError();
    throw new SessionResolutionError(error.message);
  }
  if (!data.user) throw new NoActiveSessionError();

  const userId = data.user.id as UserId;

  // public.is_platform_admin() (supabase/migrations/20260913090000_auth_tenant_bootstrap.sql)
  // is the single source of truth; it is checked here, not re-derived from
  // any claim on the token.
  const { data: isPlatformAdmin, error: adminError } = await client.rpc("is_platform_admin");
  if (adminError) {
    throw new SessionResolutionError(`is_platform_admin RPC failed: ${adminError.message}`);
  }

  return { userId, isPlatformAdmin: isPlatformAdmin === true };
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig, getServiceRoleSupabaseConfig } from "./env.ts";

// Server-only Supabase boundary. Importing this module from a browser bundle
// throws immediately: the service role key must never leave the server
// (docs/architecture/PLATFORM-ARCHITECTURE.md, "Supabase boundary" +
// "Privileged operations use server-side credentials and a narrow
// repository/service boundary.").
if (typeof window !== "undefined") {
  throw new Error("apps/web/lib/supabase/server.ts must not be imported from browser code");
}

/**
 * RLS-respecting client scoped to one request's authenticated user. Prefer
 * this over the service-role client for anything the acting user should be
 * allowed to do themselves — it enforces tenant isolation and capability
 * checks the same way the database would for any other PostgREST caller.
 */
export function createRequestScopedSupabaseClient(accessToken: string): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Privileged client that bypasses RLS entirely. Reserved for trusted
 * server-side operations that cannot be expressed as an authenticated
 * user's own action (tenant provisioning, webhook/notification delivery
 * workers, scheduled jobs). Every call site using this client is
 * responsible for its own authorization and audit logging — RLS will not
 * help it. Least privilege: prefer createRequestScopedSupabaseClient first.
 */
let cachedServiceRoleClient: SupabaseClient | null = null;

export function getServiceRoleSupabaseClient(): SupabaseClient {
  if (cachedServiceRoleClient) return cachedServiceRoleClient;
  const { url, serviceRoleKey } = getServiceRoleSupabaseConfig();
  cachedServiceRoleClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedServiceRoleClient;
}

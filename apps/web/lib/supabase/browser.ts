import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./env.ts";

// Browser boundary: project URL and public anonymous key only
// (docs/architecture/PLATFORM-ARCHITECTURE.md, "Supabase boundary"). Every
// row this client can read or write is still gated by RLS server-side; this
// file must never import the service role key.
//
// Uses @supabase/ssr's createBrowserClient (cookie-backed session storage,
// not localStorage) so the browser and server session boundaries
// (apps/web/lib/supabase/session.ts, middleware.ts) observe the same
// session via the same cookies — required for real sign-in/sign-out to be
// visible to server components and route handlers on the next request.

let cachedClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { url, anonKey } = getPublicSupabaseConfig();
  cachedClient = createBrowserClient(url, anonKey);
  return cachedClient;
}

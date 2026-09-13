import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./env";

// Browser boundary: project URL and public anonymous key only
// (docs/architecture/PLATFORM-ARCHITECTURE.md, "Supabase boundary"). Every
// row this client can read or write is still gated by RLS server-side; this
// file must never import the service role key.

let cachedClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { url, anonKey } = getPublicSupabaseConfig();
  cachedClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cachedClient;
}

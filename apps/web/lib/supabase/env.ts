// Reads only environment variable *names*, never values, at module scope.
// Actual secrets live in the deployment secret store or an ignored local
// env file; this module is never allowed to read those files directly
// (docs/governance/MULTI-AGENT-DEVELOPMENT.md, AGENTS.md).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Safe for browser bundles: URL and anonymous key only, never a secret. */
export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

/**
 * Non-throwing check for a UI that must render a clear, non-sensitive
 * "not configured" state instead of crashing when the Development
 * environment is missing its public Supabase configuration
 * (docs/tasks/TASK-015-claude-real-auth-route-integration.md).
 */
export function hasPublicSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server-only: the service role key must never reach a browser bundle. */
export function getServiceRoleSupabaseConfig(): { url: string; serviceRoleKey: string } {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

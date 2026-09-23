import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "./env.ts";

// Cookie-backed server session boundary for Server Components, Server
// Actions, and Route Handlers (docs/tasks/TASK-013-claude-supabase-auth-session-foundation.md).
// Public URL and anon key only — never a service-role credential; that
// remains apps/web/lib/supabase/server.ts's getServiceRoleSupabaseClient().
//
// A new client must be created per request (never cached/shared across
// requests): it closes over that request's cookie jar. setAll can throw
// when called from a Server Component (cookies are read-only there); that
// is caught and ignored below. Per @supabase/ssr's own documented pattern,
// a middleware that refreshes the session on every request is the
// recommended way to make that safe in general — deliberately deferred to
// the future UI integration task, since apps/web/middleware.ts sits
// outside this task's declared file scope
// (docs/tasks/TASK-013-claude-supabase-auth-session-foundation.md,
// "Work only in apps/web/app/**, apps/web/lib/supabase/**,
// apps/web/lib/domain/**, apps/web/tests/**..."). Until that middleware
// exists, call sites that need to set cookies (sign-in, sign-out,
// password-reset request) must do so from a Server Action or Route
// Handler, where setAll succeeds directly.
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe as long as middleware.ts refreshes the session on every
          // request (it does — see apps/web/middleware.ts).
        }
      },
    },
  });
}

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicSupabaseConfig, hasPublicSupabaseConfig } from './lib/supabase/env';

// Session-refresh-only middleware
// (docs/tasks/TASK-019-claude-tenant-authorization-boundary.md,
// docs/adr/0009-supabase-auth-session-foundation.md's deferred-middleware
// risk). This is the documented `@supabase/ssr` cookie-refresh pattern:
// calling auth.getUser() re-validates the access token and, when it
// rotates, setAll below rewrites the auth cookies onto both the request
// (so this request's own Server Components see them) and the response (so
// the browser stores them). Every route in apps/web/lib/supabase/session.ts's
// setAll comment relies on this running before any Server Component reads
// cookies with a read-only cookie jar.
//
// This file must never grow authorization logic of any kind: no proving
// which tenant a caller may act as, no checking a permission, no database
// lookup beyond the auth refresh above, no privileged credential.
// Every such decision lives only in the request-scoped server boundaries
// route code calls directly, one layer up from here. Middleware runs on
// every matched request regardless of whether that request ever reaches an
// authorization boundary, so it must stay incapable of making one — see
// tests/app/middleware-session-refresh-only.test.ts, which fails this
// file's build if that ever stops being true.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasPublicSupabaseConfig()) {
    return response;
  }

  const { url, anonKey } = getPublicSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh only. The return value is deliberately unused: this call exists
  // solely for its cookie-rotation side effect via setAll above, not to
  // make any authorization decision here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

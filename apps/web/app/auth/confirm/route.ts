import { NextResponse, type NextRequest } from 'next/server';
import {
  isSupportedAuthCallbackType,
  safeAuthDestination,
} from '@/lib/supabase/site-url';

/**
 * Auth email entrypoint. Does NOT call verifyOtp on GET — scanners and
 * SafeLinks would consume the one-time token before the human clicks.
 * Valid links are forwarded to /auth/continue for an explicit POST confirm.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const rawType = request.nextUrl.searchParams.get('type');
  const destination = safeAuthDestination(request.nextUrl.searchParams.get('next'));

  if (!tokenHash || !isSupportedAuthCallbackType(rawType)) {
    return NextResponse.redirect(new URL('/auth/error?reason=invalid_link', request.url));
  }

  const continueUrl = new URL('/auth/continue', request.url);
  continueUrl.searchParams.set('token_hash', tokenHash);
  continueUrl.searchParams.set('type', rawType);
  continueUrl.searchParams.set('next', destination);
  return NextResponse.redirect(continueUrl);
}

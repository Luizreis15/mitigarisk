import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import {
  isPasswordActionCallbackType,
  isSupportedAuthCallbackType,
  safeAuthDestination,
} from '@/lib/supabase/site-url';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const rawType = request.nextUrl.searchParams.get('type');
  const destination = safeAuthDestination(request.nextUrl.searchParams.get('next'));

  if (!tokenHash || !isSupportedAuthCallbackType(rawType)) {
    return NextResponse.redirect(new URL('/auth/error?reason=invalid_link', request.url));
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType,
  });

  if (error) {
    return NextResponse.redirect(new URL('/auth/error?reason=expired_link', request.url));
  }

  const isPasswordAction = isPasswordActionCallbackType(rawType);
  const response = NextResponse.redirect(
    new URL(isPasswordAction ? destination : '/workspace', request.url),
  );
  if (isPasswordAction) {
    response.cookies.set('mitiga-password-action', rawType, {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
  }
  return response;
}

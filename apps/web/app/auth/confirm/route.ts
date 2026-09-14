import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { safeAuthDestination } from '@/lib/supabase/site-url';

const SUPPORTED_TYPES = new Set<EmailOtpType>(['recovery', 'invite', 'signup', 'email']);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const rawType = request.nextUrl.searchParams.get('type');
  const destination = safeAuthDestination(request.nextUrl.searchParams.get('next'));

  if (!tokenHash || !rawType || !SUPPORTED_TYPES.has(rawType as EmailOtpType)) {
    return NextResponse.redirect(new URL('/auth/error?reason=invalid_link', request.url));
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(new URL('/auth/error?reason=expired_link', request.url));
  }

  const isPasswordAction = rawType === 'recovery' || rawType === 'invite';
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

'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import {
  authErrorPresentationCode,
  requestPasswordReset,
  signInWithPassword,
  signOut,
  updatePassword,
} from '@/lib/supabase/auth';
import {
  getAuthConfirmUrl,
  isPasswordActionCallbackType,
  isSupportedAuthCallbackType,
  safeAuthDestination,
} from '@/lib/supabase/site-url';

// Server Actions wiring the real Supabase auth boundary from TASK-013 to
// the sign-in and password-recovery forms
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md). Only
// Server Actions and Route Handlers can reliably write session cookies
// (apps/web/lib/supabase/session.ts); these are intentionally the only
// place in this task that does.

export type AuthActionResult = { status: 'success' } | { status: 'error'; code: string };

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function signInAction(
  _previousState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = readFormValue(formData, 'email');
  const password = readFormValue(formData, 'password');

  const client = await createServerSupabaseClient();
  try {
    await signInWithPassword(client, { email, password });
  } catch (error) {
    return { status: 'error', code: authErrorPresentationCode(error) };
  }

  redirect('/workspace');
}

export async function requestPasswordResetAction(
  _previousState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = readFormValue(formData, 'email');

  const client = await createServerSupabaseClient();
  try {
    await requestPasswordReset(client, { email }, { redirectTo: getAuthConfirmUrl() });
  } catch (error) {
    return { status: 'error', code: authErrorPresentationCode(error) };
  }

  // Supabase's own API never reveals whether the address exists; the
  // caller sees the same "check your email" outcome either way.
  return { status: 'success' };
}

export async function updatePasswordAction(
  _previousState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const cookieStore = await cookies();
  const passwordAction = cookieStore.get('mitiga-password-action')?.value;
  if (passwordAction !== 'recovery' && passwordAction !== 'invite') {
    return { status: 'error', code: 'NoActiveSessionError' };
  }

  const password = readFormValue(formData, 'password');
  const confirmation = readFormValue(formData, 'passwordConfirmation');
  const client = await createServerSupabaseClient();

  try {
    await updatePassword(client, { password, confirmation });
  } catch (error) {
    return { status: 'error', code: authErrorPresentationCode(error) };
  }

  cookieStore.delete('mitiga-password-action');
  return { status: 'success' };
}

export async function signOutAction(): Promise<void> {
  const client = await createServerSupabaseClient();
  await signOut(client);
  redirect('/');
}

/**
 * Completes an invite/recovery/signup link after an explicit human POST
 * from /auth/continue. Never call verifyOtp from a bare GET handler.
 */
export async function confirmAuthLinkAction(formData: FormData): Promise<void> {
  const tokenHash = readFormValue(formData, 'token_hash');
  const rawType = readFormValue(formData, 'type');
  const destination = safeAuthDestination(readFormValue(formData, 'next') || null);

  if (!tokenHash || !isSupportedAuthCallbackType(rawType)) {
    redirect('/auth/error?reason=invalid_link');
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType,
  });

  if (error) {
    redirect('/auth/error?reason=expired_link');
  }

  const cookieStore = await cookies();
  if (isPasswordActionCallbackType(rawType)) {
    cookieStore.set('mitiga-password-action', rawType, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
    redirect(destination);
  }

  redirect('/workspace');
}

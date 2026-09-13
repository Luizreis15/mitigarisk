'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import {
  authErrorPresentationCode,
  requestPasswordReset,
  signInWithPassword,
  signOut,
} from '@/lib/supabase/auth';

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
    await requestPasswordReset(client, { email });
  } catch (error) {
    return { status: 'error', code: authErrorPresentationCode(error) };
  }

  // Supabase's own API never reveals whether the address exists; the
  // caller sees the same "check your email" outcome either way.
  return { status: 'success' };
}

export async function signOutAction(): Promise<void> {
  const client = await createServerSupabaseClient();
  await signOut(client);
  redirect('/');
}

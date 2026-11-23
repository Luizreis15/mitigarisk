'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  DEMO_ACCESS_COOKIE,
  DEMO_ACCESS_MAX_AGE_SECONDS,
  demoAccessToken,
  findDemoRole,
  isDemoAccessCookieValid,
  isDemoSwitcherEnabled,
  timingSafeEqualStrings,
} from '@/lib/demo-switcher';
import { createServerSupabaseClient } from '@/lib/supabase/session';
import { signInWithPassword, signOut } from '@/lib/supabase/auth';

export type DemoActionResult = { status: 'error'; code: 'disabled' | 'bad_code' | 'locked' | 'sign_in_failed' } | null;

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function unlockDemoSwitcherAction(
  _previous: DemoActionResult,
  formData: FormData,
): Promise<DemoActionResult> {
  if (!isDemoSwitcherEnabled()) return { status: 'error', code: 'disabled' };

  const code = readFormValue(formData, 'code').trim();
  const expected = process.env.DEMO_ACCESS_CODE as string;
  if (!timingSafeEqualStrings(code, expected)) return { status: 'error', code: 'bad_code' };

  const cookieStore = await cookies();
  cookieStore.set(DEMO_ACCESS_COOKIE, await demoAccessToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DEMO_ACCESS_MAX_AGE_SECONDS,
    path: '/',
  });
  redirect('/');
}

export async function demoSignInAction(
  _previous: DemoActionResult,
  formData: FormData,
): Promise<DemoActionResult> {
  if (!isDemoSwitcherEnabled()) return { status: 'error', code: 'disabled' };

  const cookieStore = await cookies();
  if (!(await isDemoAccessCookieValid(cookieStore.get(DEMO_ACCESS_COOKIE)?.value))) {
    return { status: 'error', code: 'locked' };
  }

  const role = findDemoRole(readFormValue(formData, 'role'));
  if (!role) return { status: 'error', code: 'sign_in_failed' };

  const client = await createServerSupabaseClient();
  // Leave any current session first so the switch is a clean change of role.
  await signOut(client).catch(() => undefined);
  try {
    await signInWithPassword(client, {
      email: role.email,
      password: process.env.DEMO_ACCOUNTS_PASSWORD as string,
    });
  } catch {
    return { status: 'error', code: 'sign_in_failed' };
  }

  redirect('/workspace');
}

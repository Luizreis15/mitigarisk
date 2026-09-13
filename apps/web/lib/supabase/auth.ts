import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AuthSessionError,
  AuthRateLimitedError,
  EmailNotConfirmedError,
  InvalidCredentialsError,
  UnknownAuthError,
  assertValidEmail,
  assertValidPasswordShape,
  type PasswordResetRequestInput,
  type SignInWithPasswordInput,
} from "../domain/auth-session.ts";
import type { UserId } from "../domain/ids";

// Typed use cases for the Development/MVP auth surface: email + password
// sign-in, sign-out, and password-reset request
// (docs/tasks/TASK-013-claude-supabase-auth-session-foundation.md). Each
// function takes an already-constructed client (typically from
// apps/web/lib/supabase/session.ts) rather than constructing its own, so
// call sites control which session boundary (browser vs. server) is used —
// consistent with apps/web/lib/supabase/memberships.ts and tenant-bootstrap.ts.
//
// Error mapping is a separate, pure, exported function precisely so it can
// be unit-tested with a fake { code, message } object — no network call,
// no Supabase client, no hosted action required.

interface SupabaseAuthErrorShape {
  code?: string;
  message: string;
}

/** Maps a Supabase sign-in error to a typed domain error. Never returns. */
export function mapSignInError(error: SupabaseAuthErrorShape): never {
  switch (error.code) {
    case "invalid_credentials":
      throw new InvalidCredentialsError();
    case "email_not_confirmed":
      throw new EmailNotConfirmedError();
    case "over_request_rate_limit":
      throw new AuthRateLimitedError();
    default:
      throw new UnknownAuthError(error.message);
  }
}

/** Maps a Supabase password-reset-request error to a typed domain error. Never returns. */
export function mapPasswordResetRequestError(error: SupabaseAuthErrorShape): never {
  switch (error.code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      throw new AuthRateLimitedError();
    default:
      throw new UnknownAuthError(error.message);
  }
}

export interface SignInResult {
  userId: UserId;
}

export async function signInWithPassword(
  client: SupabaseClient,
  input: SignInWithPasswordInput,
): Promise<SignInResult> {
  assertValidEmail(input.email);
  assertValidPasswordShape(input.password);

  const { data, error } = await client.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) mapSignInError(error);
  if (!data.user) {
    throw new UnknownAuthError("Sign-in succeeded without returning a user");
  }

  return { userId: data.user.id as UserId };
}

export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw new UnknownAuthError(error.message);
}

/**
 * Requests a password-reset email. Supabase's own API never reveals
 * whether the address belongs to an account (no user enumeration): a
 * caller must show the same outcome to the end user regardless of whether
 * this resolves or throws for reasons other than a genuine rate limit.
 */
export async function requestPasswordReset(
  client: SupabaseClient,
  input: PasswordResetRequestInput,
  options?: { redirectTo?: string },
): Promise<void> {
  assertValidEmail(input.email);

  const { error } = await client.auth.resetPasswordForEmail(input.email, options);
  if (error) mapPasswordResetRequestError(error);
}

/**
 * Stable, serializable presentation code for a thrown auth error, safe to
 * return from a Server Action to a client component (a thrown class
 * instance itself does not survive that boundary) and to key UI copy off
 * of (apps/web/lib/i18n/messages.ts, `login.errors`/`passwordReset.errors`).
 * Never includes the underlying message, which may echo back
 * caller-supplied input.
 */
export function authErrorPresentationCode(error: unknown): string {
  if (error instanceof AuthSessionError) return error.name;
  return "UnknownAuthError";
}

import type { UserId } from "./ids";

// Typed contracts for real Supabase email/password authentication
// (docs/tasks/TASK-013-claude-supabase-auth-session-foundation.md). Pure
// types, typed errors, and input validation only — no Supabase import, no
// I/O. Session/identity is always derived from a verified Supabase session
// server-side (apps/web/lib/supabase/session.ts, identity.ts); nothing
// here trusts a client-supplied role, tenant id, or decoded-but-unverified
// token.

export interface SignInWithPasswordInput {
  email: string;
  password: string;
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface AuthenticatedSession {
  userId: UserId;
  email: string | null;
  /** ISO timestamp, or null when the underlying session carries no expiry. */
  expiresAt: string | null;
}

// Typed errors -----------------------------------------------------------
// Every failure mode this boundary can produce is one of these; call sites
// (a future Server Action, route handler, or protected-route check) can
// pattern-match on `instanceof` instead of parsing a Supabase error string.

export abstract class AuthSessionError extends Error {}

export class InvalidEmailError extends AuthSessionError {
  constructor() {
    super("Invalid email address");
    this.name = "InvalidEmailError";
  }
}

export class InvalidPasswordShapeError extends AuthSessionError {
  constructor(reason: string) {
    super(`Invalid password: ${reason}`);
    this.name = "InvalidPasswordShapeError";
  }
}

/** Wrong email/password pair. Deliberately does not say which was wrong. */
export class InvalidCredentialsError extends AuthSessionError {
  constructor() {
    super("Email or password is incorrect");
    this.name = "InvalidCredentialsError";
  }
}

export class EmailNotConfirmedError extends AuthSessionError {
  constructor() {
    super("This email address has not been confirmed yet");
    this.name = "EmailNotConfirmedError";
  }
}

export class AuthRateLimitedError extends AuthSessionError {
  constructor() {
    super("Too many attempts; try again later");
    this.name = "AuthRateLimitedError";
  }
}

/** No session exists at all — the caller was never signed in, or signed out. */
export class NoActiveSessionError extends AuthSessionError {
  constructor() {
    super("No active session for this request");
    this.name = "NoActiveSessionError";
  }
}

/** A session existed but is no longer valid (expired or revoked token). */
export class SessionExpiredError extends AuthSessionError {
  constructor() {
    super("The session has expired");
    this.name = "SessionExpiredError";
  }
}

/** An unexpected failure resolving/validating a session against Supabase Auth. */
export class SessionResolutionError extends AuthSessionError {
  constructor(message: string) {
    super(`Failed to resolve the current session: ${message}`);
    this.name = "SessionResolutionError";
  }
}

/** Any other Supabase Auth error this boundary did not classify by name. */
export class UnknownAuthError extends AuthSessionError {
  constructor(message: string) {
    super(message);
    this.name = "UnknownAuthError";
  }
}

// Input validation ---------------------------------------------------------
// Pre-checks for a clean, early error before any network call — not a
// substitute for Supabase's own hosted email-confirmation and password
// policy, which stays server-side and out of this task's scope.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function assertValidEmail(email: string): void {
  if (typeof email !== "string" || email.length > 320 || !EMAIL_RE.test(email)) {
    throw new InvalidEmailError();
  }
}

export function assertValidPasswordShape(password: string): void {
  if (typeof password !== "string" || password.length === 0) {
    throw new InvalidPasswordShapeError("must not be empty");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new InvalidPasswordShapeError(`must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

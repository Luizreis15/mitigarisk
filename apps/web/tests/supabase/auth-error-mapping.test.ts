import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPasswordResetRequestError, mapSignInError } from "../../lib/supabase/auth.ts";
import {
  AuthRateLimitedError,
  EmailNotConfirmedError,
  InvalidCredentialsError,
  UnknownAuthError,
} from "../../lib/domain/auth-session.ts";

// Pure error-mapping tests: no Supabase client, no network call, no hosted
// action — exercised with fake { code, message } objects shaped like the
// errors Supabase's SDK actually returns.

void test("mapSignInError maps invalid_credentials", () => {
  assert.throws(
    () => mapSignInError({ code: "invalid_credentials", message: "Invalid login credentials" }),
    InvalidCredentialsError,
  );
});

void test("mapSignInError maps email_not_confirmed", () => {
  assert.throws(
    () => mapSignInError({ code: "email_not_confirmed", message: "Email not confirmed" }),
    EmailNotConfirmedError,
  );
});

void test("mapSignInError maps over_request_rate_limit", () => {
  assert.throws(
    () => mapSignInError({ code: "over_request_rate_limit", message: "Rate limit exceeded" }),
    AuthRateLimitedError,
  );
});

void test("mapSignInError falls back to UnknownAuthError for an unrecognized code", () => {
  assert.throws(
    () => mapSignInError({ code: "some_future_code", message: "Something unexpected" }),
    UnknownAuthError,
  );
});

void test("mapSignInError falls back to UnknownAuthError when there is no code at all", () => {
  assert.throws(() => mapSignInError({ message: "Network hiccup" }), UnknownAuthError);
});

void test("mapPasswordResetRequestError maps rate-limit codes", () => {
  assert.throws(
    () => mapPasswordResetRequestError({ code: "over_email_send_rate_limit", message: "Rate limited" }),
    AuthRateLimitedError,
  );
  assert.throws(
    () => mapPasswordResetRequestError({ code: "over_request_rate_limit", message: "Rate limited" }),
    AuthRateLimitedError,
  );
});

void test("mapPasswordResetRequestError never reveals whether the email exists", () => {
  // Supabase's resetPasswordForEmail does not return an error for an
  // unknown address at all (no enumeration) — this only proves that any
  // *other* unrecognized error still fails closed rather than being
  // swallowed as a false "sent" outcome.
  assert.throws(
    () => mapPasswordResetRequestError({ code: "unexpected_failure", message: "boom" }),
    UnknownAuthError,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { loginErrorMessage, passwordResetErrorMessage } from "../../lib/i18n/auth-error-messages.ts";
import { messages } from "../../lib/i18n/messages.ts";

// Browser form error mapping (docs/tasks/TASK-015-claude-real-auth-route-integration.md):
// every known AuthSessionError subtype's .name must map to distinct
// English copy, and an unrecognized code must fall back to the generic
// message rather than leaking a raw Supabase error string.

void test("loginErrorMessage maps every known auth error code to its own English copy", () => {
  for (const code of Object.keys(messages.login.errors)) {
    assert.equal(loginErrorMessage(code), messages.login.errors[code as keyof typeof messages.login.errors]);
  }
});

void test("loginErrorMessage falls back to the generic message for an unrecognized code", () => {
  assert.equal(loginErrorMessage("SomeFutureSupabaseErrorName"), messages.login.errors.UnknownAuthError);
});

void test("passwordResetErrorMessage maps every known code and falls back for unrecognized ones", () => {
  for (const code of Object.keys(messages.passwordReset.errors)) {
    assert.equal(
      passwordResetErrorMessage(code),
      messages.passwordReset.errors[code as keyof typeof messages.passwordReset.errors],
    );
  }
  assert.equal(
    passwordResetErrorMessage("SomeFutureSupabaseErrorName"),
    messages.passwordReset.errors.UnknownAuthError,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidEmailError,
  InvalidPasswordShapeError,
  PasswordConfirmationMismatchError,
  assertMatchingPasswordConfirmation,
  assertValidEmail,
  assertValidPasswordShape,
} from "../../lib/domain/auth-session.ts";

void test("assertValidEmail accepts well-formed addresses", () => {
  assert.doesNotThrow(() => assertValidEmail("person@example.test"));
  assert.doesNotThrow(() => assertValidEmail("a.b+c@sub.example.test"));
});

void test("password confirmation must match exactly", () => {
  assert.doesNotThrow(() =>
    assertMatchingPasswordConfirmation({ password: "correct-horse", confirmation: "correct-horse" }),
  );
  assert.throws(
    () => assertMatchingPasswordConfirmation({ password: "correct-horse", confirmation: "different-value" }),
    PasswordConfirmationMismatchError,
  );
});

void test("assertValidEmail rejects malformed addresses", () => {
  for (const bad of ["", "not-an-email", "missing-domain@", "@missing-local.test", "no spaces allowed@example.test"]) {
    assert.throws(() => assertValidEmail(bad), InvalidEmailError);
  }
});

void test("assertValidPasswordShape accepts a reasonable password", () => {
  assert.doesNotThrow(() => assertValidPasswordShape("correct-horse-battery"));
});

void test("assertValidPasswordShape rejects empty and too-short passwords", () => {
  assert.throws(() => assertValidPasswordShape(""), InvalidPasswordShapeError);
  assert.throws(() => assertValidPasswordShape("short1"), InvalidPasswordShapeError);
});

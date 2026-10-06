import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCreateCustomerInput,
  InvalidExternalReferenceError,
  InvalidFullNameError,
  InvalidDateOfBirthError,
  InvalidCustomerCountryCodeError,
  InvalidCustomerOnboardingChannelError,
} from "../../lib/domain/customer.ts";
import type { CreateCustomerInput } from "../../lib/domain/customer.ts";

const VALID: CreateCustomerInput = {
  externalReference: "CUST-DEMO-001",
  fullName: "Elena Marchetti",
  dateOfBirth: "1988-04-12",
  countryOfBirth: "IT",
  nationality: "IT",
  residenceCountry: "MT",
  onboardingChannel: "face_to_face",
};

void test("validateCreateCustomerInput accepts a valid fictional entry and normalizes country codes", () => {
  const result = validateCreateCustomerInput({ ...VALID, countryOfBirth: "it", nationality: " IT " });
  assert.equal(result.countryOfBirth, "IT");
  assert.equal(result.nationality, "IT");
  assert.equal(result.externalReference, "CUST-DEMO-001");
});

void test("rejects an empty external reference", () => {
  assert.throws(() => validateCreateCustomerInput({ ...VALID, externalReference: "  " }), InvalidExternalReferenceError);
});

void test("rejects an external reference over 100 characters", () => {
  assert.throws(
    () => validateCreateCustomerInput({ ...VALID, externalReference: "x".repeat(101) }),
    InvalidExternalReferenceError,
  );
});

void test("rejects an empty full name", () => {
  assert.throws(() => validateCreateCustomerInput({ ...VALID, fullName: "" }), InvalidFullNameError);
});

void test("rejects a malformed date of birth", () => {
  assert.throws(() => validateCreateCustomerInput({ ...VALID, dateOfBirth: "12/04/1988" }), InvalidDateOfBirthError);
});

void test("rejects a date of birth in the future", () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);
  assert.throws(() => validateCreateCustomerInput({ ...VALID, dateOfBirth: future }), InvalidDateOfBirthError);
});

void test("rejects a malformed country code", () => {
  assert.throws(() => validateCreateCustomerInput({ ...VALID, residenceCountry: "MLT" }), InvalidCustomerCountryCodeError);
});

void test("rejects an unsupported onboarding channel", () => {
  assert.throws(
    // @ts-expect-error deliberately invalid at the type level too
    () => validateCreateCustomerInput({ ...VALID, onboardingChannel: "remote" }),
    InvalidCustomerOnboardingChannelError,
  );
});

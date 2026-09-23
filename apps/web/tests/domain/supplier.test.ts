import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCreateSupplierInput,
  InvalidSupplierReferenceError,
  InvalidSupplierDisplayNameError,
  InvalidCountryCodeError,
  InvalidRegistrationIdentifierError,
  InvalidIndustryCodeError,
  InvalidOperatingCountryCodesError,
  InvalidRelationshipPurposeError,
  InvalidAnnualExposureError,
  InvalidCurrencyCodeError,
  InvalidOnboardingChannelError,
  InvalidWebsiteDomainError,
  type CreateSupplierInput,
} from "../../lib/domain/supplier.ts";

// Fictional fixture matches docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
// "Business scenario and fictional reference record" exactly.
function atlasInput(overrides: Partial<CreateSupplierInput> = {}): CreateSupplierInput {
  return {
    reference: "SUP-ATLAS-001",
    displayName: "Atlas Components Ltd.",
    registrationCountryCode: "MT",
    registrationIdentifier: "C-FICTIONAL-1042",
    industryCode: "industrial_components",
    operatingCountryCodes: ["MT", "IT"],
    relationshipPurpose: "Supply of replacement components for operational equipment.",
    annualExposureMinor: 24_000_000,
    annualExposureCurrency: "EUR",
    onboardingChannel: "assisted",
    websiteDomain: "atlas-components.example",
    ...overrides,
  };
}

void test("validateCreateSupplierInput accepts the fictional Atlas Components record and normalizes it", () => {
  const validated = validateCreateSupplierInput(atlasInput());
  assert.equal(validated.reference, "SUP-ATLAS-001");
  assert.equal(validated.registrationCountryCode, "MT");
  assert.deepEqual(validated.operatingCountryCodes, ["MT", "IT"]);
  assert.equal(validated.annualExposureMinor, 24_000_000);
  assert.equal(validated.annualExposureCurrency, "EUR");
  assert.equal(validated.websiteDomain, "atlas-components.example");
});

void test("validateCreateSupplierInput normalizes lower-case country/currency codes and trims text fields", () => {
  const validated = validateCreateSupplierInput(
    atlasInput({
      registrationCountryCode: "mt",
      operatingCountryCodes: ["mt", " it "],
      annualExposureCurrency: "eur",
      displayName: "  Atlas Components Ltd.  ",
    }),
  );
  assert.equal(validated.registrationCountryCode, "MT");
  assert.deepEqual(validated.operatingCountryCodes, ["MT", "IT"]);
  assert.equal(validated.annualExposureCurrency, "EUR");
  assert.equal(validated.displayName, "Atlas Components Ltd.");
});

void test("validateCreateSupplierInput allows an absent website domain", () => {
  const validated = validateCreateSupplierInput(atlasInput({ websiteDomain: null }));
  assert.equal(validated.websiteDomain, null);
});

void test("validateCreateSupplierInput rejects an empty reference", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ reference: "  " })), InvalidSupplierReferenceError);
});

void test("validateCreateSupplierInput rejects an empty display name", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ displayName: "" })), InvalidSupplierDisplayNameError);
});

void test("validateCreateSupplierInput rejects a malformed registration country code", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ registrationCountryCode: "MLT" })), InvalidCountryCodeError);
});

void test("validateCreateSupplierInput rejects an empty registration identifier", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ registrationIdentifier: "" })), InvalidRegistrationIdentifierError);
});

void test("validateCreateSupplierInput rejects an empty industry code", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ industryCode: "" })), InvalidIndustryCodeError);
});

void test("validateCreateSupplierInput rejects zero operating countries", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ operatingCountryCodes: [] })), InvalidOperatingCountryCodesError);
});

void test("validateCreateSupplierInput rejects a malformed operating country code", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ operatingCountryCodes: ["MT", "XYZ"] })), InvalidOperatingCountryCodesError);
});

void test("validateCreateSupplierInput rejects an empty relationship purpose", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ relationshipPurpose: "" })), InvalidRelationshipPurposeError);
});

void test("validateCreateSupplierInput rejects a negative or non-integer exposure", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ annualExposureMinor: -1 })), InvalidAnnualExposureError);
  assert.throws(() => validateCreateSupplierInput(atlasInput({ annualExposureMinor: 1.5 })), InvalidAnnualExposureError);
  assert.throws(() => validateCreateSupplierInput(atlasInput({ annualExposureMinor: Number.NaN })), InvalidAnnualExposureError);
});

void test("validateCreateSupplierInput rejects a malformed currency code", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ annualExposureCurrency: "EU" })), InvalidCurrencyCodeError);
});

void test("validateCreateSupplierInput rejects an unsupported onboarding channel", () => {
  assert.throws(
    () => validateCreateSupplierInput(atlasInput({ onboardingChannel: "phone" as CreateSupplierInput["onboardingChannel"] })),
    InvalidOnboardingChannelError,
  );
});

void test("validateCreateSupplierInput rejects an implausible website domain", () => {
  assert.throws(() => validateCreateSupplierInput(atlasInput({ websiteDomain: "not a domain" })), InvalidWebsiteDomainError);
});

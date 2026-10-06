import { InvalidCustomerCountryCodeError } from "./customer.ts";

// Form state helpers for the customer creation form
// (docs/tasks/TASK-035-cursor-customer-assessment-experience.md). React 19
// resets a form before every Server Action, so a failed submission echoes the
// submitted values back for re-rendering. The server remains the authority:
// echoed values are re-validated on the next submission like any other input.

export const CUSTOMER_FORM_FIELDS = [
  "externalReference",
  "fullName",
  "dateOfBirth",
  "countryOfBirth",
  "nationality",
  "residenceCountry",
  "onboardingChannel",
] as const;

export type CustomerFormField = (typeof CUSTOMER_FORM_FIELDS)[number];
export type CustomerFormValues = Record<CustomerFormField, string>;

/** Upper bound on an echoed value, so a forged oversized field is never reflected back in full. */
const ECHO_MAX_LENGTH = 300;

export function pickSubmittedCustomerValues(readField: (name: string) => string): CustomerFormValues {
  return Object.fromEntries(
    CUSTOMER_FORM_FIELDS.map((field) => [field, readField(field).slice(0, ECHO_MAX_LENGTH)]),
  ) as CustomerFormValues;
}

const ERROR_FIELDS: Record<string, CustomerFormField> = {
  InvalidExternalReferenceError: "externalReference",
  DuplicateCustomerReferenceError: "externalReference",
  InvalidFullNameError: "fullName",
  InvalidDateOfBirthError: "dateOfBirth",
  InvalidCustomerOnboardingChannelError: "onboardingChannel",
};

function isCustomerFormField(value: string): value is CustomerFormField {
  return (CUSTOMER_FORM_FIELDS as readonly string[]).includes(value);
}

/** The create-form field a typed error points at, if any. */
export function customerErrorField(error: unknown): CustomerFormField | null {
  if (error instanceof InvalidCustomerCountryCodeError) {
    return isCustomerFormField(error.field) ? error.field : null;
  }
  if (error instanceof Error && Object.prototype.hasOwnProperty.call(ERROR_FIELDS, error.name)) {
    return ERROR_FIELDS[error.name];
  }
  return null;
}

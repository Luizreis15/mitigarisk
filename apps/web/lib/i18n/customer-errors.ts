import { messages } from './messages.ts';

const errors: Record<string, string> = messages.customerWorkspace.errors;

/** Catalog copy for a typed error name; only own catalog entries count, so names like "constructor" fall back safely. */
export function customerErrorMessage(code: string): string {
  return Object.hasOwn(errors, code) ? errors[code] : errors.UnknownError;
}

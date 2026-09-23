import { messages } from "./messages.ts";

// Pure error-code -> English copy lookup for the two real auth forms
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md, "browser
// form error mapping"). Separated from the form components themselves so
// this mapping is testable without React/DOM.

export function loginErrorMessage(code: string): string {
  const known = messages.login.errors as Record<string, string>;
  return known[code] ?? messages.login.errors.UnknownAuthError;
}

export function passwordResetErrorMessage(code: string): string {
  const known = messages.passwordReset.errors as Record<string, string>;
  return known[code] ?? messages.passwordReset.errors.UnknownAuthError;
}

import { interpolate, messages } from "./messages.ts";
import type { MembershipCountForm } from "../domain/workspace-access.ts";

export function workspaceMembershipCountCopy(
  count: number,
  form: MembershipCountForm,
) {
  const template =
    form === "one"
      ? messages.workspace.membershipCountOne
      : messages.workspace.membershipCountOther;
  return interpolate(template, { count });
}

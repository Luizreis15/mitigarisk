// Pure classification of what a verified, authenticated identity should
// see on the real workspace landing page
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md, "Preserve
// tenant isolation: a valid user with no active membership must not
// receive a tenant workspace"). Takes only values already resolved
// server-side from a verified session and a real membership count — never
// a client-supplied role or tenant id.

export type WorkspaceAccessState =
  | "platform_admin"
  | "active_member"
  | "no_membership";

export type WorkspacePresentationKind =
  | "config_unavailable"
  | "read_failure"
  | WorkspaceAccessState;

export type MembershipCountForm = "one" | "other";

export type WorkspaceViewModel = {
  kind: WorkspacePresentationKind;
  signedInEmail: string | null;
  activeMembershipCount: number;
  membershipCountForm: MembershipCountForm;
  showsAuthenticatedSession: boolean;
};

export function describeWorkspaceAccess(input: {
  isPlatformAdmin: boolean;
  activeMembershipCount: number;
}): WorkspaceAccessState {
  if (input.isPlatformAdmin) return "platform_admin";
  if (input.activeMembershipCount > 0) return "active_member";
  return "no_membership";
}

export function membershipCountForm(count: number): MembershipCountForm {
  return count === 1 ? "one" : "other";
}

export function describeWorkspacePresentation(input: {
  publicConfigAvailable: boolean;
  membershipReadFailed: boolean;
  isPlatformAdmin: boolean;
  activeMembershipCount: number;
}): WorkspacePresentationKind {
  if (!input.publicConfigAvailable) return "config_unavailable";
  if (input.membershipReadFailed) return "read_failure";
  return describeWorkspaceAccess({
    isPlatformAdmin: input.isPlatformAdmin,
    activeMembershipCount: input.activeMembershipCount,
  });
}

export function buildWorkspaceViewModel(input: {
  publicConfigAvailable: boolean;
  membershipReadFailed: boolean;
  isPlatformAdmin: boolean;
  activeMembershipCount: number;
  signedInEmail: string | null;
}): WorkspaceViewModel {
  const kind = describeWorkspacePresentation(input);
  const showsAuthenticatedSession =
    kind !== "config_unavailable";
  const activeMembershipCount = showsAuthenticatedSession
    ? input.activeMembershipCount
    : 0;

  return {
    kind,
    signedInEmail: showsAuthenticatedSession ? input.signedInEmail : null,
    activeMembershipCount,
    membershipCountForm: membershipCountForm(activeMembershipCount),
    showsAuthenticatedSession,
  };
}

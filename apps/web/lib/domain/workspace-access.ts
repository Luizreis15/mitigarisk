// Pure classification of what a verified, authenticated identity should
// see on the real workspace landing page
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md, "Preserve
// tenant isolation: a valid user with no active membership must not
// receive a tenant workspace"; docs/tasks/TASK-019-claude-tenant-authorization-boundary.md,
// server-validated tenant selection). Takes only values already resolved
// server-side from a verified session, a real membership list, and a
// server-validated tenant-selection outcome — never a client-supplied role
// or tenant id.

export type WorkspaceAccessState =
  | "platform_admin"
  | "active_member"
  | "no_membership";

export type WorkspacePresentationKind =
  | "config_unavailable"
  | "read_failure"
  | "invalid_selection"
  | "tenant_selection_required"
  | WorkspaceAccessState;

export type MembershipCountForm = "one" | "other";

export interface TenantOptionView {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export type WorkspaceViewModel = {
  kind: WorkspacePresentationKind;
  signedInEmail: string | null;
  activeMembershipCount: number;
  membershipCountForm: MembershipCountForm;
  showsAuthenticatedSession: boolean;
  tenantOptions: TenantOptionView[];
  selectedTenantName: string | null;
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
  tenantSelectionRequired?: boolean;
  invalidTenantSelection?: boolean;
}): WorkspacePresentationKind {
  if (!input.publicConfigAvailable) return "config_unavailable";
  if (input.membershipReadFailed) return "read_failure";
  // A malformed, stale, or cross-tenant `?tenant=` value is classified
  // before tenant_selection_required/active_member/no_membership: it must
  // never be treated as "no selection was requested" (which would fall
  // through to auto-select a single remaining membership) or silently
  // reinterpreted as any other state.
  if (!input.isPlatformAdmin && input.invalidTenantSelection) return "invalid_selection";
  if (!input.isPlatformAdmin && input.tenantSelectionRequired) return "tenant_selection_required";
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
  tenantSelectionRequired?: boolean;
  invalidTenantSelection?: boolean;
  tenantOptions?: TenantOptionView[];
  selectedTenantName?: string | null;
}): WorkspaceViewModel {
  const kind = describeWorkspacePresentation({
    publicConfigAvailable: input.publicConfigAvailable,
    membershipReadFailed: input.membershipReadFailed,
    isPlatformAdmin: input.isPlatformAdmin,
    activeMembershipCount: input.activeMembershipCount,
    tenantSelectionRequired: input.tenantSelectionRequired ?? false,
    invalidTenantSelection: input.invalidTenantSelection ?? false,
  });
  const showsAuthenticatedSession =
    kind !== "config_unavailable";
  // invalid_selection never discloses a membership count: it renders the
  // same generic "try again" state regardless of how many active
  // memberships the caller actually has.
  const activeMembershipCount =
    showsAuthenticatedSession && kind !== "invalid_selection"
      ? input.activeMembershipCount
      : 0;

  return {
    kind,
    signedInEmail: showsAuthenticatedSession ? input.signedInEmail : null,
    activeMembershipCount,
    membershipCountForm: membershipCountForm(activeMembershipCount),
    showsAuthenticatedSession,
    tenantOptions: kind === "tenant_selection_required" ? (input.tenantOptions ?? []) : [],
    selectedTenantName: kind === "active_member" ? (input.selectedTenantName ?? null) : null,
  };
}

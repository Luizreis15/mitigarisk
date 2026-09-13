// Pure classification of what a verified, authenticated identity should
// see on the real workspace landing page
// (docs/tasks/TASK-015-claude-real-auth-route-integration.md, "Preserve
// tenant isolation: a valid user with no active membership must not
// receive a tenant workspace"). Takes only values already resolved
// server-side from a verified session and a real membership count — never
// a client-supplied role or tenant id.

export type WorkspaceAccessState = "platform_admin" | "active_member" | "no_membership";

export function describeWorkspaceAccess(input: {
  isPlatformAdmin: boolean;
  activeMembershipCount: number;
}): WorkspaceAccessState {
  if (input.isPlatformAdmin) return "platform_admin";
  if (input.activeMembershipCount > 0) return "active_member";
  return "no_membership";
}

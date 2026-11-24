// Member invitation types shared by the repository and the UI.

export const INVITABLE_ROLES = ['tenant_admin', 'risk_analyst', 'operator', 'auditor'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

export interface PendingInvitation {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  roleKey: string;
  invitedAt: string;
}

export interface DirectoryMember {
  membershipId: string;
  userId: string;
  email: string;
  roleKey: string;
  status: string;
  createdAt: string;
}

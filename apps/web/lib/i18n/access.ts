import type { MembershipStatus, RoleKey } from '../domain/tenancy.ts';
import { messages } from './messages.ts';

const roleLabels = messages.companyAdmin.roles;
const statusLabels = messages.accessWorkspace.statusValues;
const actionLabels = messages.accessWorkspace.actions;

export function membershipRoleLabel(roleKey: RoleKey): string {
  if (roleKey in roleLabels) {
    return roleLabels[roleKey as keyof typeof roleLabels];
  }
  return roleKey.replace(/_/g, ' ');
}

export function membershipStatusLabel(status: MembershipStatus): string {
  return statusLabels[status] ?? status;
}

export function auditActionLabel(action: string): string {
  if (Object.prototype.hasOwnProperty.call(actionLabels, action)) {
    return actionLabels[action as keyof typeof actionLabels];
  }
  return action.replace(/[._]/g, ' ');
}

export function shortActorId(id: string | null): string {
  if (!id) return messages.accessWorkspace.systemActor;
  return id.slice(0, 8);
}

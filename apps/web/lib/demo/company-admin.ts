import { memberships } from './session';
import type { Capability } from './types';

export type CompanyAdminRoleKey =
  | 'tenant_admin'
  | 'risk_analyst'
  | 'operator'
  | 'auditor';

export type CompanyMemberStatus =
  | 'active'
  | 'invited'
  | 'suspended'
  | 'removed';

export type CompanyMemberCapability =
  | 'tenant.view'
  | 'tenant.manage_settings'
  | 'tenant.manage_members'
  | 'policy.view'
  | 'policy.manage'
  | 'evaluation.run'
  | 'evaluation.view'
  | 'case.manage'
  | 'case.decide'
  | 'case.view'
  | 'audit.view';

export type CompanyAdminWorkspaceState =
  | 'ready'
  | 'empty'
  | 'loading'
  | 'error'
  | 'denied';

export type DemoCompanyProfile = {
  tenantId: string;
  name: string;
  slug: string;
  environment: string;
  status: 'active';
  plan: string;
  policyVersion: string;
  actor: string;
};

export type DemoCompanyMember = {
  id: string;
  displayName: string;
  email: string;
  roleKey: CompanyAdminRoleKey;
  status: CompanyMemberStatus;
  capabilities: CompanyMemberCapability[];
  invitedAt: string | null;
  updatedAt: string;
};

export const northstarCompany: DemoCompanyProfile = {
  tenantId: 'ten_northstar_gaming',
  name: 'Northstar Gaming Ltd.',
  slug: 'northstar-gaming',
  environment: 'Staging',
  status: 'active',
  plan: 'Growth',
  policyVersion: 'pol-2026.09.11-v1',
  actor: 'Elena Park',
};

export const companyAdminRoleKeys: CompanyAdminRoleKey[] = [
  'tenant_admin',
  'risk_analyst',
  'operator',
  'auditor',
];

export const roleCapabilityBundles: Record<
  CompanyAdminRoleKey,
  CompanyMemberCapability[]
> = {
  tenant_admin: [
    'tenant.view',
    'tenant.manage_settings',
    'tenant.manage_members',
    'policy.view',
  ],
  risk_analyst: [
    'tenant.view',
    'policy.view',
    'policy.manage',
    'evaluation.run',
    'evaluation.view',
  ],
  operator: ['tenant.view', 'case.manage', 'case.decide', 'case.view'],
  auditor: [
    'tenant.view',
    'audit.view',
    'case.view',
    'evaluation.view',
    'policy.view',
  ],
};

export const northstarMembers: DemoCompanyMember[] = [
  {
    id: 'cmem_elena_park',
    displayName: 'Elena Park',
    email: 'elena.park@demo.mitiga.local',
    roleKey: 'tenant_admin',
    status: 'active',
    capabilities: roleCapabilityBundles.tenant_admin,
    invitedAt: null,
    updatedAt: '2026-09-10T09:00:00.000Z',
  },
  {
    id: 'cmem_mateo_ruiz',
    displayName: 'Mateo Ruiz',
    email: 'mateo.ruiz@demo.mitiga.local',
    roleKey: 'risk_analyst',
    status: 'active',
    capabilities: roleCapabilityBundles.risk_analyst,
    invitedAt: null,
    updatedAt: '2026-09-11T16:20:00.000Z',
  },
  {
    id: 'cmem_amina_okonkwo',
    displayName: 'Amina Okonkwo',
    email: 'amina.okonkwo@demo.mitiga.local',
    roleKey: 'operator',
    status: 'active',
    capabilities: roleCapabilityBundles.operator,
    invitedAt: null,
    updatedAt: '2026-09-12T08:14:00.000Z',
  },
  {
    id: 'cmem_jonah_hale',
    displayName: 'Jonah Hale',
    email: 'jonah.hale@demo.mitiga.local',
    roleKey: 'auditor',
    status: 'active',
    capabilities: roleCapabilityBundles.auditor,
    invitedAt: null,
    updatedAt: '2026-09-09T12:40:00.000Z',
  },
  {
    id: 'cmem_priya_raman',
    displayName: 'Priya Raman',
    email: 'priya.raman@demo.mitiga.local',
    roleKey: 'operator',
    status: 'invited',
    capabilities: roleCapabilityBundles.operator,
    invitedAt: '2026-09-12T18:05:00.000Z',
    updatedAt: '2026-09-12T18:05:00.000Z',
  },
  {
    id: 'cmem_leah_chen',
    displayName: 'Leah Chen',
    email: 'leah.chen@demo.mitiga.local',
    roleKey: 'risk_analyst',
    status: 'suspended',
    capabilities: roleCapabilityBundles.risk_analyst,
    invitedAt: null,
    updatedAt: '2026-09-08T11:02:00.000Z',
  },
  {
    id: 'cmem_owen_briggs',
    displayName: 'Owen Briggs',
    email: 'owen.briggs@demo.mitiga.local',
    roleKey: 'auditor',
    status: 'removed',
    capabilities: roleCapabilityBundles.auditor,
    invitedAt: null,
    updatedAt: '2026-09-07T15:33:00.000Z',
  },
];

export function northstarAdminMembership() {
  return memberships.find((item) => item.id === 'mem_northstar_admin');
}

export function canManageCompanyMembers(capabilities?: Capability[]) {
  return Boolean(capabilities?.includes('tenant.manage_members'));
}

export function parseCompanyAdminState(
  value: string | null,
): CompanyAdminWorkspaceState {
  if (
    value === 'empty' ||
    value === 'loading' ||
    value === 'error' ||
    value === 'denied'
  ) {
    return value;
  }
  return 'ready';
}

import type {
  Capability,
  MembershipViewModel,
  OnboardingStepViewModel,
  PrototypeScenario,
} from './types';

export const sessionActor = {
  id: 'usr_elena_park',
  name: 'Elena Park',
  email: 'elena.park@demo.mitiga.local',
};

export const invitationActor = {
  name: 'Priya Raman',
};

export const memberships: MembershipViewModel[] = [
  {
    id: 'mem_helix_company',
    tenantId: 'ten_helix_commerce',
    tenantName: 'Helix Commerce Ltd.',
    environment: 'Staging',
    role: 'company',
    status: 'active',
    capabilities: ['company.view', 'company.evaluate', 'policy.view'],
    href: '/company',
  },
  {
    id: 'mem_northstar_admin',
    tenantId: 'ten_northstar_gaming',
    tenantName: 'Northstar Gaming Ltd.',
    environment: 'Staging',
    role: 'company-admin',
    status: 'active',
    capabilities: [
      'company.view',
      'tenant.view',
      'tenant.manage_settings',
      'tenant.manage_members',
    ],
    href: '/company/admin',
  },
  {
    id: 'mem_helix_operator',
    tenantId: 'ten_helix_commerce',
    tenantName: 'Helix Commerce Ltd.',
    environment: 'Staging',
    role: 'operator',
    status: 'active',
    capabilities: ['operator.queue'],
    href: '/operator',
  },
  {
    id: 'mem_cedar_invite',
    tenantId: 'ten_cedar',
    tenantName: 'Cedar Marketplaces',
    environment: 'Staging',
    role: 'company',
    status: 'invited',
    capabilities: [],
    href: '/invite?membership=mem_cedar_invite',
  },
  {
    id: 'mem_platform',
    tenantId: 'ten_platform',
    tenantName: 'MITIGA platform',
    environment: 'Production',
    role: 'super-admin',
    status: 'active',
    capabilities: ['platform.admin'],
    href: '/super-admin',
  },
];

export const firstCompanyOnboarding: MembershipViewModel = {
  id: 'mem_onboarding',
  tenantId: 'ten_unprovisioned',
  tenantName: '',
  environment: 'Unassigned',
  role: 'company',
  status: 'onboarding',
  capabilities: [],
  href: '/onboarding',
};

export const onboardingSteps: OnboardingStepViewModel[] = [
  { id: 'company_profile', optional: false },
  { id: 'environment', optional: false },
  { id: 'policy_template', optional: false },
  { id: 'invite_operators', optional: true },
];

export const prototypeScenarios: PrototypeScenario[] = [
  { id: 'empty-company', href: '/company?state=empty' },
  { id: 'empty-operator', href: '/operator?state=empty' },
  { id: 'empty-admin', href: '/super-admin?state=empty' },
  { id: 'denied-admin', href: '/denied?capability=platform.admin' },
  { id: 'empty-members', href: '/company/admin/members?state=empty' },
  { id: 'denied-members', href: '/company/admin/members?state=denied' },
  { id: 'loading-admin', href: '/company/admin?state=loading' },
  { id: 'error-admin', href: '/company/admin?state=error' },
  { id: 'empty-entities', href: '/entities?state=empty' },
  { id: 'denied-evaluate', href: '/evaluations/new?state=denied' },
  { id: 'loading-entities', href: '/entities?state=loading' },
  { id: 'error-entities', href: '/entities?state=error' },
  { id: 'empty-governance', href: '/super-admin/tenants?state=empty' },
  { id: 'denied-governance', href: '/super-admin/tenants?state=denied' },
  { id: 'loading-governance', href: '/super-admin/tenants?state=loading' },
  { id: 'error-governance', href: '/super-admin/tenants?state=error' },
];

export function membershipById(id: string) {
  return memberships.find((item) => item.id === id);
}

export function hasCapability(
  capabilities: Capability[],
  capability: Capability,
) {
  return capabilities.includes(capability);
}

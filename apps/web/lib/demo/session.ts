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
    capabilities: ['company.view', 'company.evaluate'],
    href: '/company',
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

import { memberships } from './session';
import type { Capability } from './types';

export type TenantLifecycle = 'draft' | 'active' | 'suspended';
export type PlatformVisibility = 'listed' | 'restricted';
export type PolicyPosture = 'published' | 'draft_only' | 'none';
export type ConfigurationReadiness = 'ready' | 'incomplete' | 'blocked';
export type GovernanceWorkspaceState =
  | 'ready'
  | 'empty'
  | 'loading'
  | 'error'
  | 'denied';

export type DemoGovernedTenant = {
  id: string;
  name: string;
  slug: string;
  environment: string;
  lifecycle: TenantLifecycle;
  visibility: PlatformVisibility;
  membershipActive: number;
  membershipInvited: number;
  membershipSuspended: number;
  policyPosture: PolicyPosture;
  policyVersion: string | null;
  configuration: ConfigurationReadiness;
  lastAuditAction: string;
  lastAuditActor: string;
  lastAuditAt: string;
  correlationId: string;
};

export type GovernanceListQuery = {
  q: string;
  lifecycle: TenantLifecycle | 'all';
  workspace: GovernanceWorkspaceState;
};

export const tenantLifecycles: TenantLifecycle[] = [
  'draft',
  'active',
  'suspended',
];

export const governedTenants: DemoGovernedTenant[] = [
  {
    id: 'ten_northstar_gaming',
    name: 'Northstar Gaming Ltd.',
    slug: 'northstar-gaming',
    environment: 'Staging',
    lifecycle: 'active',
    visibility: 'listed',
    membershipActive: 4,
    membershipInvited: 1,
    membershipSuspended: 1,
    policyPosture: 'published',
    policyVersion: 'nst-pol-2026.09.01-v2',
    configuration: 'ready',
    lastAuditAction: 'tenant.membership.invite_preview',
    lastAuditActor: 'platform.ops',
    lastAuditAt: '2026-09-13T11:20:00.000Z',
    correlationId: 'corr_gov_northstar',
  },
  {
    id: 'ten_helix_commerce',
    name: 'Helix Commerce Ltd.',
    slug: 'helix-commerce',
    environment: 'Staging',
    lifecycle: 'active',
    visibility: 'listed',
    membershipActive: 6,
    membershipInvited: 0,
    membershipSuspended: 0,
    policyPosture: 'published',
    policyVersion: 'pol-2026.09.11-v4',
    configuration: 'incomplete',
    lastAuditAction: 'policy.publish',
    lastAuditActor: 'platform.ops',
    lastAuditAt: '2026-09-11T18:04:00.000Z',
    correlationId: 'corr_gov_helix',
  },
  {
    id: 'ten_cedar',
    name: 'Cedar Marketplaces',
    slug: 'cedar-marketplaces',
    environment: 'Unassigned',
    lifecycle: 'draft',
    visibility: 'restricted',
    membershipActive: 0,
    membershipInvited: 1,
    membershipSuspended: 0,
    policyPosture: 'none',
    policyVersion: null,
    configuration: 'blocked',
    lastAuditAction: 'tenant.draft.created',
    lastAuditActor: 'platform.ops',
    lastAuditAt: '2026-09-09T08:12:00.000Z',
    correlationId: 'corr_gov_cedar',
  },
  {
    id: 'ten_harbor_ledger',
    name: 'Harbor Ledger Co.',
    slug: 'harbor-ledger',
    environment: 'Staging',
    lifecycle: 'suspended',
    visibility: 'restricted',
    membershipActive: 2,
    membershipInvited: 0,
    membershipSuspended: 3,
    policyPosture: 'published',
    policyVersion: 'hl-pol-2026.08.20-v1',
    configuration: 'ready',
    lastAuditAction: 'tenant.suspend_preview',
    lastAuditActor: 'platform.ops',
    lastAuditAt: '2026-09-08T16:44:00.000Z',
    correlationId: 'corr_gov_harbor',
  },
  {
    id: 'ten_nimbus_fulfilment',
    name: 'Nimbus Fulfilment',
    slug: 'nimbus-fulfilment',
    environment: 'Staging',
    lifecycle: 'active',
    visibility: 'listed',
    membershipActive: 3,
    membershipInvited: 2,
    membershipSuspended: 0,
    policyPosture: 'draft_only',
    policyVersion: 'nf-pol-2026.09.04-d1',
    configuration: 'incomplete',
    lastAuditAction: 'policy.draft.updated',
    lastAuditActor: 'platform.ops',
    lastAuditAt: '2026-09-12T07:05:00.000Z',
    correlationId: 'corr_gov_nimbus',
  },
];

export function platformAdminCapabilities() {
  return memberships.find((item) => item.id === 'mem_platform')?.capabilities;
}

export function canGovernTenants(capabilities?: Capability[]) {
  return Boolean(capabilities?.includes('platform.admin'));
}

export function getGovernedTenant(id: string | undefined) {
  if (!id) return undefined;
  return governedTenants.find((item) => item.id === id);
}

export function parseTenantLifecycle(
  value: string | null,
): TenantLifecycle | 'all' {
  if (value === 'draft' || value === 'active' || value === 'suspended') {
    return value;
  }
  return 'all';
}

export function parseGovernanceState(
  value: string | null,
): GovernanceWorkspaceState {
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

export function parseGovernanceQuery(
  params: URLSearchParams,
): GovernanceListQuery {
  return {
    q: params.get('q') ?? '',
    lifecycle: parseTenantLifecycle(params.get('lifecycle')),
    workspace: parseGovernanceState(params.get('state')),
  };
}

export function governanceSearchParams(query: GovernanceListQuery) {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.lifecycle !== 'all') params.set('lifecycle', query.lifecycle);
  if (query.workspace !== 'ready') params.set('state', query.workspace);
  return params;
}

export function governanceListHref(query?: Partial<GovernanceListQuery>) {
  const params = governanceSearchParams({
    q: query?.q ?? '',
    lifecycle: query?.lifecycle ?? 'all',
    workspace: query?.workspace ?? 'ready',
  });
  const encoded = params.toString();
  return encoded
    ? `/super-admin/tenants?${encoded}`
    : '/super-admin/tenants';
}

export function governanceDetailHref(id: string) {
  return `/super-admin/tenants/${id}`;
}

export function filterGovernedTenants(query: GovernanceListQuery) {
  if (query.workspace === 'empty') return [];
  const needle = query.q.trim().toLowerCase();
  return governedTenants.filter((item) => {
    if (query.lifecycle !== 'all' && item.lifecycle !== query.lifecycle) {
      return false;
    }
    if (!needle) return true;
    return (
      item.name.toLowerCase().includes(needle) ||
      item.slug.toLowerCase().includes(needle) ||
      item.id.toLowerCase().includes(needle)
    );
  });
}

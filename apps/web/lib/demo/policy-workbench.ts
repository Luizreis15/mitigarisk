import { demoPolicies, demoPolicyHistory } from './policies';
import type {
  DemoPolicy,
  DemoPolicyHistoryEvent,
  PolicyLifecycle,
} from './types';

export const policyLifecycles: PolicyLifecycle[] = [
  'draft',
  'published',
  'archived',
];

export type PolicyWorkbenchQuery = {
  q: string;
  lifecycle: PolicyLifecycle | 'all';
  empty: boolean;
};

export function parsePolicyLifecycle(
  value: string | null,
): PolicyLifecycle | 'all' {
  if (value === 'draft' || value === 'published' || value === 'archived') {
    return value;
  }
  return 'all';
}

export function parsePolicyQuery(params: URLSearchParams): PolicyWorkbenchQuery {
  return {
    q: params.get('q') ?? '',
    lifecycle: parsePolicyLifecycle(params.get('lifecycle')),
    empty: params.get('state') === 'empty',
  };
}

export function policySearchParams(query: PolicyWorkbenchQuery) {
  const params = new URLSearchParams();
  if (query.q.trim()) {
    params.set('q', query.q.trim());
  }
  if (query.lifecycle !== 'all') {
    params.set('lifecycle', query.lifecycle);
  }
  if (query.empty) {
    params.set('state', 'empty');
  }
  return params;
}

export function policyListHref(query: PolicyWorkbenchQuery) {
  const serialized = policySearchParams(query).toString();
  return serialized ? `/policies?${serialized}` : '/policies';
}

export function policyDetailHref(policyId: string, query?: PolicyWorkbenchQuery) {
  if (!query) {
    return `/policies/${policyId}`;
  }
  const serialized = policySearchParams(query).toString();
  return serialized ? `/policies/${policyId}?${serialized}` : `/policies/${policyId}`;
}

export function getPolicy(id: string) {
  return demoPolicies.find((item) => item.id === id);
}

export function historyForPolicy(policyId: string): DemoPolicyHistoryEvent[] {
  return demoPolicyHistory
    .filter((item) => item.policyId === policyId)
    .slice()
    .sort((left, right) => left.at.localeCompare(right.at));
}

function matchesSearch(item: DemoPolicy, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    item.id.toLowerCase().includes(needle) ||
    item.name.toLowerCase().includes(needle) ||
    String(item.versionNumber).includes(needle)
  );
}

export function filterPolicies(query: PolicyWorkbenchQuery): DemoPolicy[] {
  if (query.empty) {
    return [];
  }
  return demoPolicies.filter((item) => {
    if (query.lifecycle !== 'all' && item.lifecycle !== query.lifecycle) {
      return false;
    }
    return matchesSearch(item, query.q);
  });
}

export function canViewPolicies(capabilities?: readonly string[]) {
  return Boolean(
    capabilities?.includes('policy.view') || capabilities?.includes('company.view'),
  );
}

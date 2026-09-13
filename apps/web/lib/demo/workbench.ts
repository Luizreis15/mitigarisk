import { demoCases } from './data';
import type {
  CaseStatus,
  DemoCase,
  RiskBand,
  WorkbenchView,
} from './types';

export const workbenchViews: WorkbenchView[] = [
  'open',
  'needs_information',
  'escalated',
  'closed',
];

export type WorkbenchQuery = {
  view: WorkbenchView;
  q: string;
  band: RiskBand | 'all';
  status: CaseStatus | 'all';
  empty: boolean;
};

export function parseWorkbenchView(value: string | null): WorkbenchView {
  if (
    value === 'needs_information' ||
    value === 'escalated' ||
    value === 'closed' ||
    value === 'open'
  ) {
    return value;
  }
  return 'open';
}

export function viewForStatus(status: CaseStatus): WorkbenchView {
  if (status === 'waiting_evidence') {
    return 'needs_information';
  }
  if (status === 'escalated') {
    return 'escalated';
  }
  if (status === 'closed') {
    return 'closed';
  }
  return 'open';
}

export function parseWorkbenchQuery(params: URLSearchParams): WorkbenchQuery {
  const band = params.get('band');
  const status = params.get('status');
  return {
    view: parseWorkbenchView(params.get('view')),
    q: params.get('q') ?? '',
    band:
      band === 'low' || band === 'medium' || band === 'high' ? band : 'all',
    status:
      status === 'open' ||
      status === 'in_review' ||
      status === 'waiting_evidence' ||
      status === 'escalated' ||
      status === 'closed'
        ? status
        : 'all',
    empty: params.get('state') === 'empty',
  };
}

export function workbenchSearchParams(query: WorkbenchQuery) {
  const params = new URLSearchParams();
  params.set('view', query.view);
  if (query.q.trim()) {
    params.set('q', query.q.trim());
  }
  if (query.band !== 'all') {
    params.set('band', query.band);
  }
  if (query.status !== 'all') {
    params.set('status', query.status);
  }
  if (query.empty) {
    params.set('state', 'empty');
  }
  return params;
}

export function workbenchHref(query: WorkbenchQuery) {
  const params = workbenchSearchParams(query);
  const serialized = params.toString();
  return serialized ? `/cases?${serialized}` : '/cases';
}

export function caseDetailHref(caseId: string, query: WorkbenchQuery) {
  const params = workbenchSearchParams(query);
  const serialized = params.toString();
  return serialized ? `/cases/${caseId}?${serialized}` : `/cases/${caseId}`;
}

export function caseHrefFromQueue(item: Pick<DemoCase, 'id' | 'status'>) {
  return caseDetailHref(item.id, {
    view: viewForStatus(item.status),
    q: '',
    band: 'all',
    status: 'all',
    empty: false,
  });
}

function matchesSearch(item: DemoCase, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    item.id.toLowerCase().includes(needle) ||
    item.reference.toLowerCase().includes(needle) ||
    item.subject.toLowerCase().includes(needle)
  );
}

export function filterWorkbenchCases(query: WorkbenchQuery): DemoCase[] {
  if (query.empty) {
    return [];
  }
  return demoCases.filter((item) => {
    if (viewForStatus(item.status) !== query.view) {
      return false;
    }
    if (query.status !== 'all' && item.status !== query.status) {
      return false;
    }
    if (query.band !== 'all' && item.riskBand !== query.band) {
      return false;
    }
    return matchesSearch(item, query.q);
  });
}

export function casesInView(view: WorkbenchView) {
  return demoCases.filter((item) => viewForStatus(item.status) === view);
}

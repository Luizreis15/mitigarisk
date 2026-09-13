import { northstarCompany } from './company-admin';
import { memberships } from './session';
import type { Capability, DataQuality, PolicyLifecycle } from './types';

export type EntityRelationship = 'customer' | 'partner' | 'supplier';
export type OperationalChannel = 'web' | 'api' | 'assisted';
export type ActivityBand = 'low' | 'moderate' | 'elevated';
export type FactProvenance = 'customer_declaration' | 'staff_entry';
export type IntakeWorkspaceState =
  | 'ready'
  | 'empty'
  | 'loading'
  | 'error'
  | 'denied';

export type DemoIntakePolicy = {
  id: string;
  name: string;
  versionNumber: number;
  lifecycle: PolicyLifecycle;
};

export type DemoEntityRecord = {
  id: string;
  displayName: string;
  reference: string;
  relationship: EntityRelationship;
  channel: OperationalChannel;
  activityBand: ActivityBand;
  declaredFacts: string;
  completeness: DataQuality;
  provenance: FactProvenance;
  recordedAt: string;
  updatedAt: string;
  contactEmail: string;
  exampleEvaluationId: string | null;
};

export type EvaluationIntakeValues = {
  entityId: string;
  displayName: string;
  reference: string;
  relationship: EntityRelationship;
  channel: OperationalChannel;
  activityBand: ActivityBand;
  declaredFacts: string;
  policyId: string;
  provenance: FactProvenance;
};

export const intakeTenant = northstarCompany;

export const northstarIntakePolicies: DemoIntakePolicy[] = [
  {
    id: 'nst-pol-2026.09.01-v2',
    name: 'Northstar onboarding review policy',
    versionNumber: 2,
    lifecycle: 'published',
  },
  {
    id: 'nst-pol-2026.07.12-v1',
    name: 'Northstar onboarding review policy',
    versionNumber: 1,
    lifecycle: 'archived',
  },
];

export const northstarEntities: DemoEntityRecord[] = [
  {
    id: 'ent_aurora_studio',
    displayName: 'Aurora Studio Partners',
    reference: 'NST-ENT-1042',
    relationship: 'customer',
    channel: 'web',
    activityBand: 'moderate',
    declaredFacts:
      'Legal name Aurora Studio Partners. Operating channel web. Activity described as moderate. No national identity document is required for this record.',
    completeness: 'complete',
    provenance: 'customer_declaration',
    recordedAt: '2026-09-08T10:15:00.000Z',
    updatedAt: '2026-09-12T09:40:00.000Z',
    contactEmail: 'aurora.studio@demo.mitiga.local',
    exampleEvaluationId: 'ev_10510',
  },
  {
    id: 'ent_harbor_ledger',
    displayName: 'Harbor Ledger Co.',
    reference: 'NST-ENT-1088',
    relationship: 'partner',
    channel: 'api',
    activityBand: 'elevated',
    declaredFacts:
      'Partner integration via API. Activity described as elevated. Channel facts are complete; relationship owner is still missing.',
    completeness: 'partial',
    provenance: 'staff_entry',
    recordedAt: '2026-09-10T14:02:00.000Z',
    updatedAt: '2026-09-13T11:18:00.000Z',
    contactEmail: 'harbor.ledger@demo.mitiga.local',
    exampleEvaluationId: 'ev_10477',
  },
  {
    id: 'ent_nimbus_fulfilment',
    displayName: 'Nimbus Fulfilment',
    reference: 'NST-ENT-1114',
    relationship: 'supplier',
    channel: 'assisted',
    activityBand: 'low',
    declaredFacts: 'Supplier record started. Declared operating facts are incomplete.',
    completeness: 'insufficient',
    provenance: 'staff_entry',
    recordedAt: '2026-09-11T08:22:00.000Z',
    updatedAt: '2026-09-11T08:22:00.000Z',
    contactEmail: 'nimbus.fulfilment@demo.mitiga.local',
    exampleEvaluationId: null,
  },
];

export function companyEvaluateCapabilities() {
  return memberships.find((item) => item.id === 'mem_helix_company')?.capabilities;
}

export function canStartEvaluation(capabilities?: Capability[]) {
  return Boolean(capabilities?.includes('company.evaluate'));
}

export function getEntity(id: string | null | undefined) {
  if (!id) return undefined;
  return northstarEntities.find((item) => item.id === id);
}

export function publishedIntakePolicies() {
  return northstarIntakePolicies.filter((item) => item.lifecycle === 'published');
}

export function getIntakePolicy(id: string) {
  return northstarIntakePolicies.find((item) => item.id === id);
}

export function valuesFromEntity(entity: DemoEntityRecord): EvaluationIntakeValues {
  const published = publishedIntakePolicies()[0];
  return {
    entityId: entity.id,
    displayName: entity.displayName,
    reference: entity.reference,
    relationship: entity.relationship,
    channel: entity.channel,
    activityBand: entity.activityBand,
    declaredFacts: entity.declaredFacts,
    policyId: published?.id ?? '',
    provenance: entity.provenance,
  };
}

export function emptyIntakeValues(): EvaluationIntakeValues {
  const first = northstarEntities[0];
  return first
    ? valuesFromEntity(first)
    : {
        entityId: '',
        displayName: '',
        reference: '',
        relationship: 'customer',
        channel: 'web',
        activityBand: 'low',
        declaredFacts: '',
        policyId: publishedIntakePolicies()[0]?.id ?? '',
        provenance: 'staff_entry',
      };
}

export function intakeQuality(values: EvaluationIntakeValues): DataQuality {
  const missingRequired = [
    values.displayName,
    values.reference,
    values.declaredFacts,
    values.policyId,
  ].filter((item) => item.trim().length === 0).length;

  if (missingRequired >= 2 || values.declaredFacts.trim().length < 24) {
    return 'insufficient';
  }
  if (missingRequired === 1) {
    return 'partial';
  }
  return 'complete';
}

export function parseIntakeState(
  value: string | null,
): IntakeWorkspaceState {
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

export function entityHref(id: string) {
  return `/entities/${id}`;
}

export function evaluationIntakeHref(entityId?: string) {
  if (!entityId) return '/evaluations/new';
  return `/evaluations/new?entity=${entityId}`;
}

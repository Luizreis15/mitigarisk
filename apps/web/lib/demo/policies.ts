import { currentTenant } from './data';
import type {
  DemoPolicy,
  DemoPolicyHistoryEvent,
} from './types';

const helixName = 'Helix onboarding risk policy';

export const demoPolicies: DemoPolicy[] = [
  {
    id: 'pol-2026.08.02-v3',
    name: helixName,
    versionNumber: 3,
    lifecycle: 'archived',
    owner: currentTenant.actor,
    tenant: currentTenant.name,
    effectiveFrom: '2026-08-02T00:00:00.000Z',
    effectiveTo: '2026-09-11T18:04:00.000Z',
    lastActivityAt: '2026-09-11T18:04:00.000Z',
    supersededBy: 'pol-2026.09.11-v4',
    factors: [
      { key: 'identity', weight: 30 },
      { key: 'fraud', weight: 30 },
      { key: 'regulatory', weight: 25 },
      { key: 'financial', weight: 15 },
    ],
    thresholds: [
      {
        minScore: 0,
        maxScore: 39,
        scoreBand: 'low',
        recommendationPath: 'accept_path',
      },
      {
        minScore: 40,
        maxScore: 69,
        scoreBand: 'medium',
        recommendationPath: 'review',
      },
      {
        minScore: 70,
        maxScore: 100,
        scoreBand: 'high',
        recommendationPath: 'additional_evidence',
      },
    ],
  },
  {
    id: 'pol-2026.09.11-v4',
    name: helixName,
    versionNumber: 4,
    lifecycle: 'published',
    owner: currentTenant.actor,
    tenant: currentTenant.name,
    effectiveFrom: '2026-09-11T18:04:00.000Z',
    effectiveTo: null,
    lastActivityAt: '2026-09-11T18:04:00.000Z',
    supersededBy: null,
    factors: [
      { key: 'identity', weight: 25 },
      { key: 'fraud', weight: 35 },
      { key: 'regulatory', weight: 25 },
      { key: 'financial', weight: 15 },
    ],
    thresholds: [
      {
        minScore: 0,
        maxScore: 39,
        scoreBand: 'low',
        recommendationPath: 'accept_path',
      },
      {
        minScore: 40,
        maxScore: 69,
        scoreBand: 'medium',
        recommendationPath: 'review',
      },
      {
        minScore: 70,
        maxScore: 100,
        scoreBand: 'high',
        recommendationPath: 'additional_evidence',
      },
    ],
  },
  {
    id: 'pol-2026.09.13-v5',
    name: helixName,
    versionNumber: 5,
    lifecycle: 'draft',
    owner: currentTenant.actor,
    tenant: currentTenant.name,
    effectiveFrom: null,
    effectiveTo: null,
    lastActivityAt: '2026-09-13T09:15:00.000Z',
    supersededBy: null,
    factors: [
      { key: 'identity', weight: 20 },
      { key: 'fraud', weight: 40 },
      { key: 'regulatory', weight: 25 },
      { key: 'financial', weight: 15 },
    ],
    thresholds: [
      {
        minScore: 0,
        maxScore: 34,
        scoreBand: 'low',
        recommendationPath: 'accept_path',
      },
      {
        minScore: 35,
        maxScore: 64,
        scoreBand: 'medium',
        recommendationPath: 'review',
      },
      {
        minScore: 65,
        maxScore: 100,
        scoreBand: 'high',
        recommendationPath: 'additional_evidence',
      },
    ],
  },
];

export const demoPolicyHistory: DemoPolicyHistoryEvent[] = [
  {
    id: 'ph_v3_1',
    policyId: 'pol-2026.08.02-v3',
    action: 'policy.created',
    actor: currentTenant.actor,
    at: '2026-08-01T16:10:00.000Z',
    correlationId: 'corr_pol_v3',
  },
  {
    id: 'ph_v3_2',
    policyId: 'pol-2026.08.02-v3',
    action: 'policy.published',
    actor: currentTenant.actor,
    at: '2026-08-02T00:00:00.000Z',
    correlationId: 'corr_pol_v3',
  },
  {
    id: 'ph_v3_3',
    policyId: 'pol-2026.08.02-v3',
    action: 'policy.archived',
    actor: currentTenant.actor,
    at: '2026-09-11T18:04:00.000Z',
    correlationId: 'corr_7f3a',
  },
  {
    id: 'ph_v4_1',
    policyId: 'pol-2026.09.11-v4',
    action: 'policy.created',
    actor: currentTenant.actor,
    at: '2026-09-10T14:22:00.000Z',
    correlationId: 'corr_7f3a',
  },
  {
    id: 'ph_v4_2',
    policyId: 'pol-2026.09.11-v4',
    action: 'policy.published',
    actor: currentTenant.actor,
    at: '2026-09-11T18:04:00.000Z',
    correlationId: 'corr_7f3a',
  },
  {
    id: 'ph_v5_1',
    policyId: 'pol-2026.09.13-v5',
    action: 'policy.created',
    actor: currentTenant.actor,
    at: '2026-09-13T09:15:00.000Z',
    correlationId: 'corr_pol_v5',
  },
];

import { messages } from '@/lib/i18n/messages';
import type { DemoRole } from './types';

export const roleLabels = messages.views;

export const rolePaths: Record<DemoRole, string> = {
  company: '/company',
  'super-admin': '/super-admin',
  operator: '/operator',
};

export const riskBandLabels = messages.status.risk;
export const caseStatusLabels = messages.status.case;
export const qualityLabels = messages.status.quality;
export const healthLabels = messages.status.health;
export const severityLabels = messages.status.severity;
export const humanDecisionLabels = messages.flow.decision.actions;
export const timelineActionLabels = messages.flow.timeline.actions;
export const workbenchViewLabels = messages.workbench.views;
export const priorityLabels = messages.workbench.priorityValues;
export const evidenceStateLabels = messages.workbench.evidenceValues;
export const nextActionLabels = messages.workbench.nextActionValues;

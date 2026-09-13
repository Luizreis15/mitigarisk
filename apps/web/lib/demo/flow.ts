import { demoCases, demoEvaluations, demoTimelines } from './data';
import type { DemoTimelineEvent, HumanDecision } from './types';

export const humanDecisions: HumanDecision[] = [
  'approve',
  'reject',
  'escalate',
  'request_more_info',
];

export function getEvaluation(id: string) {
  return demoEvaluations.find((item) => item.id === id);
}

export function getCase(id: string) {
  return demoCases.find((item) => item.id === id);
}

export function caseIdForEvaluation(evaluationId: string) {
  return demoCases.find((item) => item.evaluationId === evaluationId)?.id;
}

const openedFromEvaluationIds = new Set(['cs_360', 'cs_361', 'cs_362']);

export function isNewlyOpenedCase(caseId: string) {
  return openedFromEvaluationIds.has(caseId);
}

export function timelineForCase(caseId: string): DemoTimelineEvent[] {
  return demoTimelines
    .filter((item) => item.caseId === caseId)
    .slice()
    .sort((left, right) => left.at.localeCompare(right.at));
}

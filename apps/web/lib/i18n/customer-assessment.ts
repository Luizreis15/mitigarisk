import { messages } from './messages.ts';
import { formatDate, formatDateTime, formatNumber } from './presentation.ts';
import type { CraApproval, CraBandName, CraDdLevel, CraOutcome, CraResult } from '../domain/cra-engine.ts';

// Presentation mapping for a persisted CRA assessment
// (docs/tasks/TASK-035-cursor-customer-assessment-experience.md, "Result
// presentation"). Every value comes from the stored `result` jsonb and the
// stored assessment columns; this module only turns codes into catalog copy.
// It never computes, derives, or re-orders a score, band, DD level, or
// outcome.

const t = messages.customerWorkspace;

export interface AssessmentResultSource {
  result: CraResult;
  nextReviewDue: string;
  policyVersionId: string;
  /** Known only when the assessment used the policy the current form was read from. */
  policyLabel?: string | null;
  assessedAt: string;
  correlationId: string;
}

export interface LabelledCode {
  code: string;
  label: string;
}

export interface CategoryScoreView {
  key: string;
  label: string;
  score: number;
  scoreText: string;
  /** Width of the display bar, the persisted score bounded to 0–100. */
  barPercent: number;
}

export interface ApprovalView extends LabelledCode {
  pending: true;
  actionable: false;
}

export interface AssessmentResultView {
  overallScore: number;
  overallScoreText: string;
  band: CraBandName;
  bandLabel: string;
  ddLevel: CraDdLevel;
  ddLevelLabel: string;
  outcome: CraOutcome;
  outcomeLabel: string;
  isReject: boolean;
  requiresMlroSignOff: boolean;
  categoryScores: CategoryScoreView[];
  overrides: LabelledCode[];
  requiredActions: LabelledCode[];
  approvals: ApprovalView[];
  missingFactors: LabelledCode[];
  reasonCodes: string[];
  reviewMonths: number;
  nextReviewDue: string;
  nextReviewDueText: string;
  policyVersionId: string;
  policyLabel: string | null;
  assessedAtText: string;
  correlationId: string;
}

/** Readable fallback for a code the catalog does not know yet: "OVR_NEW_RULE" → "Ovr new rule". */
export function humanizeCode(code: string): string {
  const words = code.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.length > 0 ? words.charAt(0).toUpperCase() + words.slice(1) : code;
}

function lookup(catalog: Record<string, string>, code: string): string {
  return Object.prototype.hasOwnProperty.call(catalog, code) ? catalog[code] : humanizeCode(code);
}

export function bandLabel(band: CraBandName): string {
  return lookup(t.bands, band);
}

export function ddLevelLabel(ddLevel: CraDdLevel): string {
  return lookup(t.ddLevels, ddLevel);
}

export function ddLevelShortLabel(ddLevel: CraDdLevel): string {
  return lookup(t.ddLevelsShort, ddLevel);
}

export function outcomeLabel(outcome: CraOutcome): string {
  return lookup(t.outcomes, outcome);
}

export function approvalLabel(approval: CraApproval): string {
  return lookup(t.approvals, approval);
}

function boundedPercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, score));
}

export function buildAssessmentResultView(source: AssessmentResultSource): AssessmentResultView {
  const { result } = source;
  return {
    overallScore: result.overall_score,
    overallScoreText: formatNumber(result.overall_score),
    band: result.band,
    bandLabel: bandLabel(result.band),
    ddLevel: result.dd_level,
    ddLevelLabel: ddLevelLabel(result.dd_level),
    outcome: result.outcome,
    outcomeLabel: outcomeLabel(result.outcome),
    isReject: result.outcome === 'REJECT',
    requiresMlroSignOff: result.approvals_required.includes('MLRO'),
    categoryScores: Object.entries(result.category_scores).map(([key, score]) => ({
      key,
      label: lookup(t.categories, key),
      score,
      scoreText: formatNumber(score),
      barPercent: boundedPercent(score),
    })),
    overrides: result.overrides_hit.map((code) => ({ code, label: lookup(t.overrides, code) })),
    requiredActions: result.required_actions.map((code) => ({ code, label: lookup(t.requiredActions, code) })),
    approvals: result.approvals_required.map((code) => ({
      code,
      label: approvalLabel(code),
      pending: true,
      actionable: false,
    })),
    missingFactors: result.missing_factors.map((code) => ({ code, label: lookup(t.factors, code) })),
    reasonCodes: [...result.reason_codes],
    reviewMonths: result.review_months,
    nextReviewDue: source.nextReviewDue,
    nextReviewDueText: formatDate(source.nextReviewDue),
    policyVersionId: source.policyVersionId,
    policyLabel: source.policyLabel ?? null,
    assessedAtText: formatDateTime(source.assessedAt),
    correlationId: source.correlationId,
  };
}

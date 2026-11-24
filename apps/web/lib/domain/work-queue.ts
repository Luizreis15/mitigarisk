import type { Customer } from './customer.ts';
import type { CustomerAssessment } from './customer-assessment.ts';
import type { DecisionState } from './customer-decision.ts';

// Operator (1st line) work queue: every customer on file, placed in the
// stage that says what has to happen next. Derived only from persisted
// customers and their latest assessment; it never computes or alters a
// score, band or outcome.
//
// Stages follow Lucimara's P1/P2 process: an unassessed customer needs a
// CRA (P1.7); a REVIEW_REQUIRED result waits for the compliance decision
// (EDD, MLRO sign-off); a REJECT must not be onboarded; a periodic review
// starts three months before it is due (P2.1).

export type WorkStage =
  | 'do_not_onboard'
  | 'needs_assessment'
  | 'review_due'
  | 'awaiting_compliance'
  | 'cleared';

/** Display and priority order: most urgent first. */
export const WORK_STAGE_ORDER: readonly WorkStage[] = [
  'do_not_onboard',
  'needs_assessment',
  'review_due',
  'awaiting_compliance',
  'cleared',
];

export const REVIEW_LEAD_DAYS = 90;

export interface WorkQueueRow {
  customer: Customer;
  latest: CustomerAssessment | null;
  /** Human decision on the latest assessment, when it required one. */
  decisionState?: DecisionState;
  /** Required actions from the latest transaction check's hits still open (empty when none). */
  triggerActions?: string[];
  /** Codes of the latest assessment's required actions already recorded as done. */
  completedActions?: string[];
}

export interface WorkQueueItem extends WorkQueueRow {
  stage: WorkStage;
  /** Days until next_review_due (negative when overdue); null when unassessed. */
  reviewDueInDays: number | null;
  requiredActions: string[];
}

export interface WorkQueue {
  items: WorkQueueItem[];
  counts: Record<WorkStage, number>;
  /** Items the operator has to act on (everything except cleared). */
  openCount: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Most decisive action first, so the queue row shows what matters: a
// freeze or a report outranks routine identification steps. Unknown codes
// keep their stored order after the known ones.
export const REQUIRED_ACTION_PRIORITY: readonly string[] = [
  'FREEZE_FUNDS_AND_BLOCK_IF_EXISTING',
  'REJECT_IF_PROSPECT',
  'REJECT_OR_TERMINATE',
  'REPORT_TO_MLRO',
  'BLOCK_PENDING_MANUAL_REVIEW',
  'OBTAIN_SOW_SOF_DOCUMENTS',
  'OBTAIN_PURPOSE_AND_NATURE',
  'VERIFY_ID',
  'IDENTIFY_CUSTOMER',
  'ONGOING_SCREENING',
];

export function prioritizeRequiredActions(codes: readonly string[]): string[] {
  const rank = (code: string) => {
    const index = REQUIRED_ACTION_PRIORITY.indexOf(code);
    return index === -1 ? REQUIRED_ACTION_PRIORITY.length : index;
  };
  return codes
    .map((code, position) => ({ code, position }))
    .sort((a, b) => rank(a.code) - rank(b.code) || a.position - b.position)
    .map(({ code }) => code);
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysUntil(isoDate: string, now: Date): number | null {
  const due = Date.parse(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (!Number.isFinite(due)) return null;
  return Math.round((startOfUtcDay(new Date(due)) - startOfUtcDay(now)) / MS_PER_DAY);
}

export function workStageFor(
  latest: CustomerAssessment | null,
  now: Date,
  leadDays = REVIEW_LEAD_DAYS,
  decisionState: DecisionState = 'not_required',
): WorkStage {
  if (!latest) return 'needs_assessment';
  if (latest.outcome === 'REJECT') return 'do_not_onboard';
  if (latest.outcome === 'REVIEW_REQUIRED') {
    // The MLRO (or the board) decides; until then the case waits.
    if (decisionState === 'rejected') return 'do_not_onboard';
    if (decisionState !== 'approved') return 'awaiting_compliance';
  }
  const dueIn = daysUntil(latest.nextReviewDue, now);
  if (dueIn !== null && dueIn <= leadDays) return 'review_due';
  return 'cleared';
}

export function buildWorkQueue(rows: WorkQueueRow[], now: Date = new Date(), leadDays = REVIEW_LEAD_DAYS): WorkQueue {
  const counts = Object.fromEntries(WORK_STAGE_ORDER.map((s) => [s, 0])) as Record<WorkStage, number>;

  const items = rows.map((row): WorkQueueItem => {
    const stage = workStageFor(row.latest, now, leadDays, row.decisionState);
    counts[stage] += 1;
    return {
      ...row,
      stage,
      reviewDueInDays: row.latest ? daysUntil(row.latest.nextReviewDue, now) : null,
      requiredActions: row.latest
        ? prioritizeRequiredActions(
            row.latest.result.required_actions.filter((code) => !(row.completedActions ?? []).includes(code)),
          )
        : [],
    };
  });

  const rank = (stage: WorkStage) => WORK_STAGE_ORDER.indexOf(stage);
  items.sort((a, b) => {
    if (a.stage !== b.stage) return rank(a.stage) - rank(b.stage);
    // Within a stage: soonest review first, then most recently assessed, then name.
    const dueA = a.reviewDueInDays ?? Number.POSITIVE_INFINITY;
    const dueB = b.reviewDueInDays ?? Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    const atA = a.latest ? Date.parse(a.latest.assessedAt) : 0;
    const atB = b.latest ? Date.parse(b.latest.assessedAt) : 0;
    if (atA !== atB) return atB - atA;
    return a.customer.fullName.localeCompare(b.customer.fullName);
  });

  return { items, counts, openCount: items.length - counts.cleared };
}

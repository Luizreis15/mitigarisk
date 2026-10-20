import type { Customer } from './customer.ts';
import type { CustomerAssessment } from './customer-assessment.ts';

/** Company-home KPI snapshot. Counts only — never invents assessments. */
export interface CompanyDashboardSnapshot {
  customerTotal: number;
  bandLow: number;
  bandMedium: number;
  bandHigh: number;
  unassessed: number;
  rejectCount: number;
  /** Assessments with next_review_due on or before the horizon (inclusive). */
  reviewsDueCount: number;
  reviewHorizonDays: number;
}

export interface DashboardCustomerRow {
  customer: Customer;
  latest: CustomerAssessment | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Build dashboard KPIs from persisted customers + latest assessment per row.
 * `now` and `horizonDays` are injected so the pure function stays testable.
 */
export function buildCompanyDashboardSnapshot(
  rows: DashboardCustomerRow[],
  now: Date = new Date(),
  horizonDays = 90,
): CompanyDashboardSnapshot {
  const horizonMs = now.getTime() + horizonDays * MS_PER_DAY;
  let bandLow = 0;
  let bandMedium = 0;
  let bandHigh = 0;
  let unassessed = 0;
  let rejectCount = 0;
  let reviewsDueCount = 0;

  for (const { latest } of rows) {
    if (!latest) {
      unassessed += 1;
      continue;
    }
    if (latest.band === 'LOW') bandLow += 1;
    else if (latest.band === 'MEDIUM') bandMedium += 1;
    else bandHigh += 1;
    if (latest.outcome === 'REJECT') rejectCount += 1;
    const due = Date.parse(latest.nextReviewDue);
    if (Number.isFinite(due) && due <= horizonMs) reviewsDueCount += 1;
  }

  return {
    customerTotal: rows.length,
    bandLow,
    bandMedium,
    bandHigh,
    unassessed,
    rejectCount,
    reviewsDueCount,
    reviewHorizonDays: horizonDays,
  };
}

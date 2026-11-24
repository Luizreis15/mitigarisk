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

/** One assessed customer placed on the 0–100 risk scale. */
export interface PortfolioPoint {
  customerId: string;
  name: string;
  reference: string;
  score: number;
  band: CustomerAssessment['band'];
  ddLevel: CustomerAssessment['ddLevel'];
  /** True when an override rule (PEP, sanctions…) set the band, not the score. */
  overridden: boolean;
  /** Vertical slot so points with close scores stack instead of overlapping. */
  stack: number;
}

/** Policy band thresholds on the score scale (LOW < 36 ≤ MEDIUM < 76 ≤ HIGH). */
export const BAND_THRESHOLDS = { medium: 36, high: 76 } as const;

/**
 * Assessed customers as points on the score scale, stacked in buckets of
 * `bucketWidth` score points. Stored values only: nothing is recomputed.
 */
export function buildPortfolioPoints(rows: DashboardCustomerRow[], bucketWidth = 3): PortfolioPoint[] {
  const assessed = rows
    .filter((row): row is { customer: Customer; latest: CustomerAssessment } => row.latest !== null)
    .map(({ customer, latest }) => ({
      customerId: customer.id as string,
      name: customer.fullName,
      reference: customer.externalReference,
      score: Math.min(100, Math.max(0, Number(latest.overallScore) || 0)),
      band: latest.band,
      ddLevel: latest.ddLevel,
      overridden: latest.result.overrides_hit.length > 0,
    }))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

  const perBucket = new Map<number, number>();
  return assessed.map((point) => {
    const bucket = Math.floor(point.score / bucketWidth);
    const stack = perBucket.get(bucket) ?? 0;
    perBucket.set(bucket, stack + 1);
    return { ...point, stack };
  });
}

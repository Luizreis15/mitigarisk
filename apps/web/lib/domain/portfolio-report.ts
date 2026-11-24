import type { Customer } from "./customer.ts";
import type { CustomerAssessment } from "./customer-assessment.ts";
import { decisionStatusFor, type CustomerDecision, type DecisionState } from "./customer-decision.ts";
import { REVIEW_LEAD_DAYS, daysUntil, workStageFor, type WorkStage } from "./work-queue.ts";

// Portfolio report: one row per customer with the latest persisted result,
// plus counts for the whole company. Built only from stored records:
// nothing is scored here, the bands and outcomes are read as the database
// stored them. Serialised canonically (lib/domain/audit-pack.ts) so its
// SHA-256 is reproducible and can be checked against the audit trail.

export const PORTFOLIO_REPORT_FORMAT = "mitiga.portfolio-report/v1";

export interface PortfolioReportInput {
  generatedAt: string;
  generatedBy: string;
  tenant: { id: string; name: string | null };
  customers: readonly Customer[];
  /** Latest assessment per customer id. */
  latestByCustomer: ReadonlyMap<string, CustomerAssessment>;
  /** Every decision of the tenant; matched to each latest assessment. */
  decisions: readonly CustomerDecision[];
  /** Number of triggers hit in each customer's latest transaction check. */
  triggerHitsByCustomer: ReadonlyMap<string, number>;
  reviewLeadDays?: number;
}

export interface PortfolioReportRow {
  external_reference: string;
  full_name: string;
  nationality: string;
  residence_country: string;
  onboarding_channel: Customer["onboardingChannel"];
  registered_at: string;
  assessed_at: string | null;
  overall_score: number | null;
  band: CustomerAssessment["band"] | null;
  /** True when an override rule set the band, not the score. */
  band_set_by_rule: boolean;
  dd_level: CustomerAssessment["ddLevel"] | null;
  outcome: CustomerAssessment["outcome"] | null;
  decision: DecisionState | null;
  stage: WorkStage;
  next_review_due: string | null;
  /** Days until the next review (negative when overdue); null when not assessed. */
  review_due_in_days: number | null;
  /** Triggers hit in the latest transaction check; null when none was run. */
  transaction_triggers_hit: number | null;
}

export interface PortfolioReportSummary {
  customers: number;
  not_assessed: number;
  band_low: number;
  band_medium: number;
  band_high: number;
  high_by_rule: number;
  dd_simplified: number;
  dd_standard: number;
  dd_enhanced: number;
  awaiting_decision: number;
  approved: number;
  do_not_onboard: number;
  reviews_overdue: number;
  reviews_due_soon: number;
  review_lead_days: number;
  with_transaction_triggers: number;
}

export interface PortfolioReport {
  format: typeof PORTFOLIO_REPORT_FORMAT;
  generated_at: string;
  generated_by: string;
  tenant: { id: string; name: string | null };
  summary: PortfolioReportSummary;
  customers: PortfolioReportRow[];
}

const BAND_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Highest risk first, then highest score, then reference; customers not assessed last. */
function compareRows(a: PortfolioReportRow, b: PortfolioReportRow): number {
  const rank = (row: PortfolioReportRow) => (row.band ? BAND_RANK[row.band] : 3);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if ((b.overall_score ?? -1) !== (a.overall_score ?? -1)) return (b.overall_score ?? -1) - (a.overall_score ?? -1);
  return a.external_reference.localeCompare(b.external_reference);
}

export function buildPortfolioReport(input: PortfolioReportInput): PortfolioReport {
  const now = new Date(input.generatedAt);
  const leadDays = input.reviewLeadDays ?? REVIEW_LEAD_DAYS;

  const rows = input.customers.map((customer): PortfolioReportRow => {
    const latest = input.latestByCustomer.get(customer.id) ?? null;
    const decision = decisionStatusFor(latest, input.decisions).state;
    return {
      external_reference: customer.externalReference,
      full_name: customer.fullName,
      nationality: customer.nationality,
      residence_country: customer.residenceCountry,
      onboarding_channel: customer.onboardingChannel,
      registered_at: customer.createdAt,
      assessed_at: latest?.assessedAt ?? null,
      overall_score: latest?.overallScore ?? null,
      band: latest?.band ?? null,
      band_set_by_rule: latest ? latest.result.overrides_hit.length > 0 : false,
      dd_level: latest?.ddLevel ?? null,
      outcome: latest?.outcome ?? null,
      decision: latest ? decision : null,
      stage: workStageFor(latest, now, leadDays, decision),
      next_review_due: latest?.nextReviewDue ?? null,
      review_due_in_days: latest ? daysUntil(latest.nextReviewDue, now) : null,
      transaction_triggers_hit: input.triggerHitsByCustomer.get(customer.id) ?? null,
    };
  });
  rows.sort(compareRows);

  const count = (test: (row: PortfolioReportRow) => boolean) => rows.filter(test).length;
  const summary: PortfolioReportSummary = {
    customers: rows.length,
    not_assessed: count((row) => row.band === null),
    band_low: count((row) => row.band === "LOW"),
    band_medium: count((row) => row.band === "MEDIUM"),
    band_high: count((row) => row.band === "HIGH"),
    high_by_rule: count((row) => row.band === "HIGH" && row.band_set_by_rule),
    dd_simplified: count((row) => row.dd_level === "SDD"),
    dd_standard: count((row) => row.dd_level === "CDD"),
    dd_enhanced: count((row) => row.dd_level === "EDD"),
    awaiting_decision: count((row) => row.decision === "awaiting_mlro" || row.decision === "awaiting_board"),
    approved: count((row) => row.decision === "approved"),
    do_not_onboard: count((row) => row.stage === "do_not_onboard"),
    reviews_overdue: count((row) => row.review_due_in_days !== null && row.review_due_in_days < 0),
    reviews_due_soon: count(
      (row) => row.review_due_in_days !== null && row.review_due_in_days >= 0 && row.review_due_in_days <= leadDays,
    ),
    review_lead_days: leadDays,
    with_transaction_triggers: count((row) => (row.transaction_triggers_hit ?? 0) > 0),
  };

  return {
    format: PORTFOLIO_REPORT_FORMAT,
    generated_at: input.generatedAt,
    generated_by: input.generatedBy,
    tenant: input.tenant,
    summary,
    customers: rows,
  };
}

/** Columns of the CSV export, in order. */
export const PORTFOLIO_CSV_COLUMNS = [
  "external_reference",
  "full_name",
  "nationality",
  "residence_country",
  "onboarding_channel",
  "registered_at",
  "assessed_at",
  "overall_score",
  "band",
  "band_set_by_rule",
  "dd_level",
  "outcome",
  "decision",
  "stage",
  "next_review_due",
  "review_due_in_days",
  "transaction_triggers_hit",
] as const satisfies readonly (keyof PortfolioReportRow)[];

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (leading
 * =, +, -, @, tab or carriage return) is prefixed with an apostrophe, since
 * names and references come from the company's own files.
 */
function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The customer rows as RFC 4180 CSV (CRLF line ends, header first). */
export function portfolioReportCsv(report: PortfolioReport): string {
  const lines = [PORTFOLIO_CSV_COLUMNS.join(",")];
  for (const row of report.customers) {
    lines.push(PORTFOLIO_CSV_COLUMNS.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

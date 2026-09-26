// CRA engine v2 -- pure, NON-AUTHORITATIVE TypeScript mirror
// (docs/adr/0012-customer-cra-engine-as-mvp-core.md, TASK-032).
//
// The scoring authority is the database: app.evaluate_cra() in
// supabase/migrations/20260926100000_cra_engine_v2.sql. This module
// documents the same algorithm and lets tests detect drift; it reads and
// writes nothing and must never become a second write path. Both are checked
// against the same 24-case casebook (tests/fixtures/cra-casebook-v1.json).
//
// Money-like arithmetic is exact: weights and points are handled as scaled
// BigInt decimals so "half-up to 2 decimals" cannot be perturbed by binary
// floating point.

export type CraBandName = "LOW" | "MEDIUM" | "HIGH";
export type CraDdLevel = "SDD" | "CDD" | "EDD";
export type CraApproval = "MLRO" | "BOARD";
export type CraOutcome = "REJECT" | "REVIEW_REQUIRED" | "PROCEED";

export interface CraFactorTemplate {
  key: string;
  weight: number;
  points: Record<string, number>;
}

export interface CraCategoryTemplate {
  key: string;
  label: string;
  weight: number;
  factors: CraFactorTemplate[];
}

export interface CraOverrideTemplate {
  code: string;
  fact: string;
  in: Array<string | number | boolean>;
  effect: "reject" | "force_high";
  actions?: string[];
  approvals?: CraApproval[];
}

export interface CraBandTemplate {
  band: CraBandName;
  min: number;
  max_exclusive?: number;
  max_inclusive?: number;
  dd_level: CraDdLevel;
  review_months: number;
  approvals: CraApproval[];
  actions: string[];
}

export interface CraTemplate {
  missing_factor_points: number;
  categories: CraCategoryTemplate[];
  overrides: CraOverrideTemplate[];
  bands: CraBandTemplate[];
}

export interface CraResult {
  overall_score: number;
  category_scores: Record<string, number>;
  band: CraBandName;
  dd_level: CraDdLevel;
  outcome: CraOutcome;
  overrides_hit: string[];
  approvals_required: CraApproval[];
  required_actions: string[];
  review_months: number;
  missing_factors: string[];
  reason_codes: string[];
}

export class CraEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CraEvaluationError";
  }
}

// ---- exact decimal helpers (value = n / 10^s) -------------------------------

interface Dec {
  n: bigint;
  s: number;
}

function toDec(x: number): Dec {
  const text = String(x);
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new CraEvaluationError(`Unsupported numeric literal ${text}`);
  }
  const [whole, frac = ""] = text.split(".");
  return { n: BigInt(whole + frac), s: frac.length };
}

// The project targets ES2017, where bigint literals are not allowed, so the
// constants are built with BigInt() calls.
const ZERO = BigInt(0);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const pow10 = (e: number): bigint => BigInt(10) ** BigInt(e);

function mul(a: Dec, b: Dec): Dec {
  return { n: a.n * b.n, s: a.s + b.s };
}

function add(a: Dec, b: Dec): Dec {
  const s = Math.max(a.s, b.s);
  return { n: a.n * pow10(s - a.s) + b.n * pow10(s - b.s), s };
}

function compare(a: Dec, b: Dec): number {
  const s = Math.max(a.s, b.s);
  const l = a.n * pow10(s - a.s);
  const r = b.n * pow10(s - b.s);
  return l < r ? -1 : l > r ? 1 : 0;
}

// round-half-up(num / den) to `outScale` decimals; both operands non-negative.
function divRoundHalfUp(num: Dec, den: Dec, outScale: number): Dec {
  if (den.n <= ZERO) {
    throw new CraEvaluationError("Division by a non-positive weight");
  }
  const top = num.n * pow10(den.s + outScale);
  const bottom = den.n * pow10(num.s);
  return { n: (TWO * top + bottom) / (TWO * bottom), s: outScale };
}

const toNumber = (d: Dec): number => Number(d.n) / 10 ** d.s;

// ---- evaluation -----------------------------------------------------------------

const LOW_BELOW = 30;
const HIGH_FROM = 70;

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function evaluateCra(template: CraTemplate, facts: Record<string, unknown>): CraResult {
  const missingPoints = toDec(template.missing_factor_points);
  const factorReasons: string[] = [];
  const missing: string[] = [];
  const categoryScores: Record<string, number> = {};
  let overall: Dec = { n: ZERO, s: 0 };

  if (template.categories.length === 0) {
    throw new CraEvaluationError("The template has no categories");
  }

  for (const category of template.categories) {
    let num: Dec = { n: ZERO, s: 0 };
    let den: Dec = { n: ZERO, s: 0 };
    for (const factor of category.factors) {
      const value = facts[factor.key];
      const present = value !== undefined && value !== null;
      let points: Dec;
      if (typeof value === "string" && hasOwn(factor.points, value)) {
        points = toDec(factor.points[value]);
        const p = factor.points[value];
        const level = p < LOW_BELOW ? "LOW" : p >= HIGH_FROM ? "HIGH" : "MEDIUM";
        factorReasons.push(`FACTOR_${factor.key.toUpperCase()}_${level}`);
      } else {
        points = missingPoints;
        missing.push(factor.key);
        factorReasons.push(`DATA_MISSING_${factor.key.toUpperCase()}`);
        if (present) {
          factorReasons.push(`INVALID_VALUE_${factor.key.toUpperCase()}`);
        }
      }
      const weight = toDec(factor.weight);
      num = add(num, mul(points, weight));
      den = add(den, weight);
    }
    const categoryScore = divRoundHalfUp(num, den, 2);
    categoryScores[category.key] = toNumber(categoryScore);
    overall = add(overall, mul(categoryScore, toDec(category.weight)));
  }
  const score = divRoundHalfUp(overall, { n: HUNDRED, s: 0 }, 2);

  const inBand = (band: CraBandTemplate): boolean => {
    if (compare(score, toDec(band.min)) < 0) return false;
    if (band.max_exclusive !== undefined) return compare(score, toDec(band.max_exclusive)) < 0;
    if (band.max_inclusive !== undefined) return compare(score, toDec(band.max_inclusive)) <= 0;
    return false;
  };
  let band = template.bands.find(inBand);
  if (!band) {
    throw new CraEvaluationError(`Score ${toNumber(score)} is covered by no band`);
  }

  const hits: string[] = [];
  const overrideActions: string[] = [];
  const overrideApprovals: string[] = [];
  let effect: "reject" | "force_high" | null = null;
  for (const override of template.overrides) {
    const value = facts[override.fact];
    if (isScalar(value) && override.in.some((candidate) => candidate === value)) {
      hits.push(override.code);
      overrideActions.push(...(override.actions ?? []));
      overrideApprovals.push(...(override.approvals ?? []));
      if (override.effect === "reject") effect = "reject";
      else if (effect === null) effect = "force_high";
    }
  }
  if (effect !== null) {
    const high = template.bands.find((candidate) => candidate.band === "HIGH");
    if (!high) {
      throw new CraEvaluationError("The template has no HIGH band for an override");
    }
    band = high;
  }

  const requiredActions: string[] = [];
  for (const action of [...band.actions, ...overrideActions]) {
    if (!requiredActions.includes(action)) requiredActions.push(action);
  }
  const approvalSet = [...overrideApprovals, ...band.approvals];
  const approvals: CraApproval[] = [];
  if (approvalSet.includes("MLRO")) approvals.push("MLRO");
  if (approvalSet.includes("BOARD")) approvals.push("BOARD");

  const outcome: CraOutcome =
    effect === "reject" ? "REJECT" : band.band === "HIGH" ? "REVIEW_REQUIRED" : "PROCEED";

  return {
    overall_score: toNumber(score),
    category_scores: categoryScores,
    band: band.band,
    dd_level: band.dd_level,
    outcome,
    overrides_hit: hits,
    approvals_required: approvals,
    required_actions: requiredActions,
    review_months: band.review_months,
    missing_factors: missing,
    reason_codes: [...hits, ...factorReasons, `BAND_${band.band}`, `DD_${band.dd_level}`],
  };
}

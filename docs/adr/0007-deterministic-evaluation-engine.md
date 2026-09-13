# ADR 0007 — Deterministic evaluation engine: scoring, versioning, reasons, and the decision boundary

- Status: accepted
- Date: 2026-09-13

## Context

TASK-009 asks for the server-side, deterministic domain engine that turns a
versioned risk policy and normalized input facts into an explainable risk
recommendation: pure, typed, framework-independent TypeScript with no
Supabase client calls, no HTTP, and no machine-learning scoring. The
existing database contracts (`supabase/migrations/20260912120200_risk_policy.sql`,
`20260912120300_evaluation.sql`, mirrored in
`apps/web/lib/domain/policy.ts`/`evaluation.ts`) already define
`policy_factors` (`key`, `weight`, `config jsonb`), `policy_thresholds`
(`minScore`, `maxScore`, `decisionBand: 'approve'|'review'|'reject'`), and
`evaluations.decision_band` with the same three-value vocabulary. The task
must reuse these contracts' meaning, not redefine it — but they leave four
things unspecified that a deterministic engine has to decide: how a raw
input value becomes a per-factor risk contribution, how missing data is
handled, exactly what "overlapping/uncovered thresholds" means well enough
to reject it, and what vocabulary a "recommendation" uses.

## Decisions

**Recommendation vocabulary reuses `DecisionBand` (`approve`/`review`/`reject`).**
The task's acceptance criteria mention "review, allow, or decline" as
examples, but the database's `decision_band` columns are constrained to
`approve`/`review`/`reject` and already carry that exact meaning throughout
the codebase. Inventing a second, differently-spelled vocabulary would
force a translation layer for no benefit and risk the two silently
diverging. `EvaluationEngineResult.recommendation` is typed `DecisionBand`,
imported unchanged from `apps/web/lib/domain/policy.ts`.

**Per-factor normalization is linear over an explicit `[min, max]` range
with a declared direction.** Each factor's `config` (previously untyped
`jsonb`) must now validate as `{ min, max, direction: "higher_is_riskier" |
"lower_is_riskier", required: boolean }`
(`apps/web/lib/domain/evaluation-policy-config.ts`). A raw fact value is
clamped into `[min, max]`, mapped linearly onto `[0, 100]`, and inverted
when `direction` is `"lower_is_riskier"`. This is the simplest rule that is
fully deterministic, boundary-testable, and requires no external
statistical model — appropriate for an MVP engine that must be explainable
and reproducible above all else. A future task may add richer per-factor
functions (step curves, categorical lookups); doing so only requires
extending the `config` schema and `normalizeFactorValue`, not this ADR's
other decisions.

**A missing input is scored at a fixed neutral default (50 = the midpoint
of `[0,100]`), never zero, never excluded from the weighted average.**
This is the load-bearing decision behind acceptance criterion 1's
"invariant that data quality does not alter the calculated score"
(`apps/web/lib/domain/evaluation-scoring.ts`, `NEUTRAL_FACTOR_SCORE`).
Excluding missing factors and renormalizing weights over only the present
ones was considered and rejected: it would make the score a function of
*which* factors are missing, not just of the values supplied, and would
have made data quality and score mathematically entangled instead of
independently computed from the same underlying "which factors are
present" facts. Assessing data quality
(`apps/web/lib/domain/evaluation-data-quality.ts`) reads the same presence
information but never feeds back into the score.
`apps/web/tests/domain/evaluation-data-quality.test.ts` proves this
directly: the same present value, scored once through a policy that calls
it required (data quality: `insufficient`) and once through an otherwise
identical policy that does not (data quality: `complete`), produces the
identical score.

**Thresholds must be validated as a strict, contiguous, half-open
partition of `[0, 100]` — this is what "overlapping/uncovered" is defined
to mean.** Sorted by `minScore`, the first must start at 0, the last must
end at 100, and each threshold's `minScore` must equal the previous one's
`maxScore` exactly (no gap, no overlap). Band membership at runtime then
uses `[min, max)` for every threshold except the last, which is `[min,
max]`, so every score in `[0, 100]` matches exactly one band — an exact
boundary value (e.g. a threshold edge at 30) can never ambiguously match
two adjacent bands. This is deliberately stricter than the pre-existing
`resolveDecisionBand()` in `apps/web/lib/domain/policy.ts` (added in
TASK-002), which does a first-match `>=`/`<=` scan over an unvalidated,
caller-ordered array and can double-match an exact boundary. This engine
does not reuse `resolveDecisionBand()` for band resolution — it validates
and resolves independently in
`evaluation-policy-config.ts`/`evaluation-scoring.ts` — but does not modify
or remove `resolveDecisionBand()`, since TASK-009 is explicitly scoped
against changing existing contracts and that function may still be used
elsewhere.

**Reason codes are a fixed, closed set of stable English tokens, derived
per factor plus one for the final band, in policy-factor definition
order.** `FACTOR_INPUT_MISSING`, `FACTOR_LOW_RISK_CONTRIBUTION` /
`_MODERATE_` / `_HIGH_`, and `RECOMMENDATION_APPROVE` / `_REVIEW` /
`_REJECT` (`apps/web/lib/domain/evaluation-reasons.ts`). The
low/moderate/high cut points (30/70) are engine-internal constants for
*explanation* only — independent of a policy's own thresholds, which
govern the recommendation, not the reason narrative. Reason metadata
carries only abstracted values already computed by the engine (factor
key, normalized 0-100 score, weight share, the final score) and never a
raw input fact, satisfying "never emit raw PII or full input values in
reason metadata."

**The engine is a single versioned entry point, `runEvaluation()`, gated by
`EVALUATION_ENGINE_CONTRACT_VERSION`.** `EvaluationEngineInput`/
`EvaluationEngineResult` (`apps/web/lib/domain/evaluation-engine.ts`) are
the "small, versioned internal contract" a future Evaluation API adapter
binds to. The engine receives `policyVersionId` and `correlationId` as
opaque, already-authorized values and passes them through unchanged; it
performs no lookup, no tenant check, and no audit write of its own — those
remain the responsibility of the adapter that will eventually call this
engine with data loaded and authorized through the existing Supabase/RLS
boundary (`apps/web/lib/supabase/**`, unchanged by this task).

**The customer-decision boundary is structural, not a naming convention.**
`EvaluationEngineResult` has no field called `decision` and produces only
a `recommendation`, mirroring
`docs/architecture/PLATFORM-ARCHITECTURE.md`'s invariant that "a
recommendation never silently becomes the customer's final business
decision." Recording an actual decision remains the Cases bounded
context's job (`public.case_decisions`,
`supabase/migrations/20260912120400_cases.sql`), which this task does not
touch. `apps/web/tests/domain/evaluation-engine.test.ts` asserts the result
shape has no `decision`/`finalDecision` field as a regression guard.

## Consequences

- A later API adapter can call `runEvaluation()` with data it has already
  loaded and authorized (a published `policy_versions` row's factors/
  thresholds, an `evaluations` row's `normalized_input`) and get back
  everything it needs to populate `evaluations.score`/`decision_band` and
  a batch of `evaluation_reason_codes` rows — without this engine ever
  importing `@supabase/supabase-js` or performing any I/O.
- Extending the factor normalization model (new `direction`, categorical
  configs, non-linear curves) or the reason-code vocabulary is additive:
  bump `EVALUATION_ENGINE_CONTRACT_VERSION` and extend the relevant
  validator; existing policy configurations and tests are unaffected
  unless they exercise the new shape.
- The neutral-default-for-missing-data design means a policy answers "what
  score would this be with no information at all?" as exactly the
  weighted average of every factor's neutral score — for the two-factor
  fixture used throughout `apps/web/tests/domain/`, that is always 50
  regardless of weights, landing in the `review` band. This is intentional
  (unknown risk defaults to "needs review," never a silent approve) and
  should be validated against real product risk appetite before this
  engine's output is wired into an actual approve/decline UI.

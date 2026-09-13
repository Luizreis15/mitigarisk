# TASK-009 — Claude deterministic evaluation engine

## Objective

Implement the server-side, deterministic evaluation domain engine that turns a
versioned risk policy and normalized input facts into an explainable risk
recommendation. This is the backend foundation for a future real Evaluation
API; it must not make a customer decision.

## Business context

MITIGA evaluates operational risk for online/digital businesses. A result must
be reproducible from its immutable policy version and supplied facts, show why
it was produced, distinguish data quality from risk, and leave the final
business decision to the contracting company.

## In scope

- Work only in `apps/web/lib/domain/**`, `apps/web/tests/**`,
  `supabase/tests/**`, `docs/adr/**`, `docs/security/**`, and this task file.
- Inspect and reuse the existing Risk Policy and Evaluation database contracts;
  do not change their meaning.
- Implement pure, typed TypeScript domain logic for:
  - validating a policy version's factor configuration and score thresholds;
  - normalizing a bounded evaluation input payload;
  - deterministically calculating a score and risk band from factor weights;
  - emitting stable technical reason codes with non-sensitive explanation
    metadata;
  - calculating a separate data-quality result (complete, partial, or
    insufficient) based on required inputs;
  - returning an explicit recommendation such as `review`, `allow`, or
    `decline`, clearly distinct from a human decision.
- Define a small, versioned internal contract/type surface that a later API
  adapter can call. Keep it framework-independent and free of Supabase client
  calls.
- Add exhaustive unit tests, including deterministic repeatability, boundary
  thresholds, invalid policy rejection, missing inputs, reason-code stability,
  and the invariant that data quality does not alter the calculated score.
- Add or update an ADR documenting scoring determinism, policy versioning,
  reason-code stability, and the customer-decision boundary.

## Out of scope

- HTTP routes, UI changes, Supabase RPCs/migrations, hosted migrations,
  database writes, background jobs, AI/LLM scoring, machine learning,
  third-party data calls, browser persistence, email, file upload, billing,
  or changes to RLS/identity contracts.
- Creating or recording a final human decision. This task produces a risk
  recommendation only.

## Security, tenant, and audit requirements

- Do not accept tenant, actor, policy version, or score as trusted client
  authority. This pure engine receives already-authorized inputs; future
  adapters must bind them to authenticated tenant context.
- Never emit raw PII or full input values in reason metadata, test fixtures,
  errors, or logs. Use fictional, market-neutral fixtures only.
- Reason codes must be stable English technical tokens; presentation copy stays
  outside the domain engine.
- The output must carry policy version identity and a correlation-id field or
  explicit required input for later audit linkage, but this task must not write
  an audit event itself.

## Acceptance criteria

1. Same validated policy version and normalized inputs always produce the same
   score, risk band, data-quality state, reasons, and recommendation.
2. Score, reason codes, data quality, and recommendation are separate output
   fields; no output is named or described as a final decision.
3. Invalid factors, duplicate keys, invalid weights, overlapping/uncovered
   thresholds, and malformed inputs fail closed with typed domain errors.
4. Tests cover positive and negative cases plus threshold boundaries and pass
   with `npm test` and `npx tsc --noEmit -p tsconfig.json` from `apps/web`.
5. `./scripts/check-secrets.sh` and `./scripts/verify-web.sh` pass.
6. No credentials, network calls, Supabase imports, migrations, or Portuguese
   runtime copy are introduced.

## Required handoff

Create branch `feat/claude-deterministic-evaluation-engine` from current
`main`. Use Conventional Commits. Do not merge. Append the standard handoff
below with outcome, commits, changed files, checks, security/tenant/audit
impact, migration/rollback notes, limitations, and recommended reviewer.

## Handoff notes (Claude Code)

Outcome: implemented in full, exactly as scoped. Branch created from
current `main` (which already contains TASK-002 and TASK-006's merged
work, per `git merge-base`).

Branch and commits: `feat/claude-deterministic-evaluation-engine`,
`59b37df` (engine implementation), `d841dc6` (57 unit tests), `f9b9dbd`
(ADR 0007), `fbe7dd5` (this handoff, first pass), `0df50f2` (security fix:
runtime validation of `decisionBand` and `contractVersion` — see below).

Files changed (all within the task's declared scope — no other path was
touched):
- `apps/web/lib/domain/evaluation-engine-errors.ts` — typed domain error
  classes (`PolicyConfigurationError` subtypes, `MalformedEvaluationInputError`,
  `MalformedInputPayloadError`).
- `apps/web/lib/domain/evaluation-policy-config.ts` — `validatePolicyConfiguration()`:
  factor/threshold shape, duplicate-key, weight, and normalization-config
  validation; strict contiguous [0,100] threshold-coverage validation.
- `apps/web/lib/domain/evaluation-input.ts` — `normalizeEvaluationInput()`:
  clamps and linearly maps raw facts onto a 0-100 per-factor score;
  distinguishes "absent" from "malformed."
- `apps/web/lib/domain/evaluation-scoring.ts` — `calculateEvaluationScore()`:
  weighted average with a fixed neutral default for missing factors, and
  strict half-open band resolution.
- `apps/web/lib/domain/evaluation-data-quality.ts` — `assessDataQuality()`:
  complete/partial/insufficient, computed independently of scoring.
- `apps/web/lib/domain/evaluation-reasons.ts` — `deriveEvaluationReasons()`:
  fixed English technical reason-code vocabulary with abstracted metadata.
- `apps/web/lib/domain/evaluation-engine.ts` — `runEvaluation()`, the single
  versioned (`EVALUATION_ENGINE_CONTRACT_VERSION`) entry point tying the
  above together; `apps/web/lib/domain/index.ts` barrel updated.
- `apps/web/tests/domain/evaluation-{engine,policy-config,input,scoring,data-quality,reasons}.test.ts`
  and `evaluation-engine-fixtures.ts` (57 tests total across the whole
  domain suite, all new for this task except the pre-existing ones).
- `docs/adr/0007-deterministic-evaluation-engine.md`.

Decisions and assumptions (full rationale in ADR 0007):
- `recommendation` reuses the existing `DecisionBand` type
  (`approve`/`review`/`reject` — the exact values `policy_thresholds`/
  `evaluations.decision_band` already use in
  `supabase/migrations/20260912120200_risk_policy.sql`/`20260912120300_evaluation.sql`)
  rather than the task text's illustrative "review/allow/decline," per the
  instruction to reuse, not change, the existing database contract's
  meaning.
- Per-factor normalization is a linear `[min,max]` clamp with a declared
  `direction`, read out of each factor's (now-typed) `config`. This is a
  deliberate, minimal, fully-deterministic and boundary-testable choice
  for an MVP engine; extending to richer per-factor curves is additive and
  does not require revisiting anything else in this design.
- A missing input is scored at a fixed neutral default (50, the midpoint)
  rather than zeroed or excluded from the weighted average — this is the
  specific mechanism that makes the score mathematically independent of
  the data-quality classification, proven directly in
  `evaluation-data-quality.test.ts`.
- Thresholds must form a strict, contiguous, half-open partition of
  `[0,100]`; this engine does not reuse the pre-existing
  `resolveDecisionBand()` in `apps/web/lib/domain/policy.ts` for band
  resolution (that function's first-match `>=`/`<=` scan can double-match
  an exact boundary) but does not modify or remove it either, since it may
  still be used elsewhere and this task does not touch existing contracts.

Checks run and exact results:
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — no errors.
- `cd apps/web && npm test` (`node --test`) — 57/57 pass (all domain tests
  in the repository, including this task's new suites).
- `./scripts/check-secrets.sh` — "Secret check passed."
- `./scripts/verify-web.sh` (oxlint with CI's ignore patterns, plus
  `vinext build`) — lint clean, build succeeds.

Security/tenant/audit impact: none directly — this task adds no database
access, no Supabase import, no network call, and no audit write of its
own; it is pure computation over caller-supplied, already-authorized
values. `policyVersionId`/`correlationId` are carried through the result
unchanged so a future adapter can bind them to `evaluations`/
`evaluation_reason_codes` rows and the correlation id used for audit
linkage, but this task never performs that write. No fixture contains
real business data, PII, or a credential.

Migration and rollback notes: none — no `supabase/**` file was touched, no
schema or RLS contract changed. Rollback is simply reverting the three
commits above; nothing else in the repository depends on this engine yet.

Known limitations: the engine is not wired to anything — there is no
Evaluation API adapter, no Supabase read/write, and no UI consuming it yet
(all explicitly out of scope). The linear normalization model and the
50/30/70 constants (neutral default; low/moderate/high reason-code cut
points) are engine defaults suitable for an MVP, not yet validated against
real product risk appetite (flagged in ADR 0007's Consequences).

Recommended reviewer: an independent agent or the eventual API-adapter
author, to confirm `EvaluationEngineInput`/`EvaluationEngineResult` is a
contract they can actually build against, and a product owner to confirm
the neutral-default-for-missing-data and linear-normalization choices
before this engine's output reaches real risk decisions.

## Security fix addendum (2026-09-13, Claude Code)

Outcome: fixed. Two fields were trusted at compile time only —
`PolicyThresholdInput.decisionBand` (typed `DecisionBand`) and
`EvaluationEngineInput.contractVersion` (typed as the literal `1`) — with
no runtime check behind either. TypeScript's structural typing gives no
guarantee once a caller that is not itself type-checked hands this engine
a value: a future API adapter deserializing an untrusted policy payload
(from a request body, or a row it read without re-validating) could pass
an arbitrary string as `decisionBand` and have it flow straight through
into `EvaluationEngineResult.recommendation` — the exact field the whole
engine exists to produce correctly — or pass a stale/wrong
`contractVersion` and have the current engine silently evaluate it under
version-1 semantics anyway.

Commit: `0df50f2`.

Changes:
- `apps/web/lib/domain/evaluation-engine-errors.ts`: added
  `InvalidDecisionBandError` (a `PolicyConfigurationError` subtype, so it
  fits the existing `instanceof PolicyConfigurationError` catch surface)
  and `UnsupportedContractVersionError`.
- `apps/web/lib/domain/evaluation-policy-config.ts`: `validateThresholds()`
  now checks every threshold's `decisionBand` against a runtime
  `DECISION_BANDS` literal set (`"approve"`/`"review"`/`"reject"`) and
  throws `InvalidDecisionBandError` on anything else, including on the
  values a JSON payload could produce that TypeScript can't distinguish
  from a real `DecisionBand` at the type level (wrong case, empty string,
  `null`, a number, an object, an array).
- `apps/web/lib/domain/evaluation-engine.ts`: `runEvaluation()` now checks
  `input.contractVersion === EVALUATION_ENGINE_CONTRACT_VERSION` as its
  very first statement — before validating the policy or touching
  `facts` — and throws `UnsupportedContractVersionError` on any mismatch.
- Negative tests added: nine invalid `decisionBand` values in
  `evaluation-policy-config.test.ts` (plus a positive test confirming
  every genuine value still passes), and four invalid `contractVersion`
  values in `evaluation-engine.test.ts` (plus a check that the
  contract-version failure preempts a policy-configuration failure that
  would otherwise also apply to the same input, proving check order).

The engine remains pure: no `@supabase/supabase-js` import, no network
call, no filesystem access was introduced by this fix (verified by
grepping `apps/web/lib/domain/evaluation-*.ts` for `supabase`/`require(`/
`fetch(`/`fs.` — the only hits are pre-existing comments referencing
migration file paths).

Checks run and exact results:
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — no errors.
- `cd apps/web && npm test` — 60/60 pass (57 pre-existing + 3 new: the
  decision-band positive/negative pair adds two tests, the
  contract-version rejection adds one).
- `./scripts/check-secrets.sh` — "Secret check passed."
- `./scripts/verify-web.sh` — lint clean, `vinext build` succeeds.

Security/tenant/audit impact: closes a real fail-open gap in output
integrity for any future caller that is not itself fully type-checked
against this engine's TypeScript types (the exact situation an API
adapter reading JSON from a request or a loosely-typed caller would be
in). No change to tenant isolation, audit behavior, or any Supabase
contract — this task still writes to none of them.

Migration and rollback notes: none — no `supabase/**` file touched.
Rollback is reverting commit `0df50f2` only; it does not depend on, and
nothing depends on, any other commit in this branch.

Known limitations: this fix addresses the two fields explicitly named in
the request. Other fields on `EvaluationEngineInput`/`PolicyFactorInput`
(e.g. `policyVersionId`, `correlationId`, `key`) are still passed through
or format-checked only as documented in ADR 0007 and the original
handoff above — they are intentionally the responsibility of a future
authorized adapter, not this pure engine, per TASK-009's own security
requirements ("this pure engine receives already-authorized inputs;
future adapters must bind them").

Recommended reviewer: same as above — an independent agent or the future
API-adapter author, specifically to confirm no other compile-time-only
field in this contract is reachable by an untrusted, non-type-checked
caller before this engine is wired to anything real.

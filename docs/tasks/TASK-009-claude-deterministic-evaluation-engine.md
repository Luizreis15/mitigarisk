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

_To be completed by Claude Code._

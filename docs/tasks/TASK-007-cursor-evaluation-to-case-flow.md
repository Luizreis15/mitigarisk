# TASK-007 — Cursor evaluation-to-case decision flow

## Objective

Build the English-first frontend prototype flow from a new risk evaluation to
an explainable case and recorded human decision.

## Scope

- Work only in apps/web/app/**, apps/web/components/**, apps/web/lib/i18n/**,
  apps/web/lib/demo/**, and this task file.
- Add a navigable local-fixture flow for:
  - starting an evaluation;
  - showing score, risk band, data quality, reason codes, policy version, and
    recommendation;
  - opening or creating a case from an evaluation;
  - requesting evidence;
  - recording a simulated human decision: approve, reject, escalate, or
    request more information;
  - showing an audit-style timeline for the prototype flow.
- Keep the existing Company and Operator routes functional. Add routes only
  where a dedicated evaluation or case detail view improves the flow.
- Reuse the approved MITIGA design system, responsive layouts, and typed
  English message catalog.

## Out of scope

- Supabase queries, database migrations, authentication, session state,
  real persistence, provider calls, actual file uploads, billing, or changes
  to domain/RLS contracts.

## Acceptance criteria

1. The UI makes clear that score is a recommendation and a human/contracting
   company makes the final decision.
2. Reason codes and data quality remain distinct from the risk score.
3. Decision buttons create local feedback only and never claim to persist.
4. Every visible string is English-first, market-neutral catalog copy.
5. No credentials, network calls, Supabase imports, or Portuguese runtime
   copy are introduced.
6. Desktop and mobile layouts are usable for the entire flow.
7. ./scripts/check-secrets.sh and ./scripts/verify-web.sh pass.

## Required handoff

Commit on feat/cursor-evaluation-case-flow using Conventional Commits. Add the
standard handoff to this file: outcome, commits, changed files, checks,
security/tenant impact, limitations, and a recommended reviewer. Do not merge.

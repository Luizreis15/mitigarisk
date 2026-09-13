# TASK-016 — Cursor entity intake and evaluation-start workflow

## Objective

Build the English-first Company workflow that lets an authorized reviewer
prepare a client/entity record and start a risk evaluation from a structured,
market-neutral intake. This is a frontend prototype contract; it must not
claim persistence or a completed risk decision.

## Context

MITIGA's MVP flow is: Company user records an entity, selects a versioned
policy, submits facts for evaluation, then an operator/case reviewer makes the
human decision. TASK-007 supplies the evaluation-to-case presentation and
TASK-009 supplies the deterministic engine contract. This task defines the
missing intake experience without calling either a database or the engine.

## In scope

- Work only in `apps/web/app/**`, `apps/web/components/**`,
  `apps/web/lib/demo/**`, `apps/web/lib/i18n/**`, and this task.
- Add an English-first Company route for entity/client records and a route for
  creating a new evaluation intake.
- Use fictional Northstar data only. Include a small, market-neutral example
  set with identity/reference, relationship, operational signals, declared
  facts, completeness, provenance, and timestamps in UTC.
- Separate customer-entered facts from derived score/recommendation and from a
  later human decision. Do not show a score during data entry.
- Allow choosing only a local policy-version fixture; explain that policy,
  jurisdiction/locale, and currency are presentation/configuration choices,
  not authorisation.
- Make required fields, data quality/completeness, validation, review, and
  submission acknowledgement accessible and responsive. The acknowledgement
  must say the prototype did not save or send anything.
- Link safely to the existing evaluation detail/new flow and retain all current
  routes.
- Cover empty, loading, error, and denied states. Denied state must state that
  capability is checked by the backend in a real environment; UI visibility is
  not authorization.

## Out of scope

- Supabase/auth imports, API calls, data persistence, evaluation-engine calls,
  policy edits, actual customer data, document upload, file storage, OCR/AI,
  external integrations, billing, emails, Vercel configuration, migrations,
  or RLS changes.

## Guardrails

- All visible copy is English; user-facing text must remain in the typed
  message catalog.
- No real names, email addresses, UUIDs, credentials, or user data in fixtures.
- A score is a recommendation only and never a customer decision.
- Do not use a country-specific document, address, currency, or regulatory
  assumption as a required model field.
- Make no change to the canonical `mitiga-symbol.png` or branding treatment.

## Acceptance criteria

1. A reviewer can understand the path from entity intake to an evaluation
   request without the UI implying a real write.
2. Facts, data-quality status, recommendation, and human decision are visibly
   distinct concepts.
3. The flow is coherent on desktop and mobile and supports keyboard use.
4. Existing Company, Operator, Super Admin, policies, cases, and evaluations
   continue to work.
5. `./scripts/check-secrets.sh`, `./scripts/verify-web.sh`, and
   `npm run verify:vercel` pass.

## Required handoff

Create `feat/cursor-entity-intake-evaluation-workflow` from
`origin/preview/vercel-adapter`. Use Conventional Commits. Do not merge or
deploy. Include outcome, commits, changed files, checks, security/tenant/audit
impact, migration/rollback notes, limitations, screenshots if available, and a
recommended reviewer.

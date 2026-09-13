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

## Handoff notes (Cursor)

Outcome:
English-first Company workflow for fictional Northstar entity records and a
structured evaluation intake. Facts, completeness, recommendation, and human
decision stay visually distinct. The intake never shows a score and the
acknowledgement states that nothing was saved or sent.

Branch and commit:
`feat/cursor-entity-intake-evaluation-workflow` from `origin/preview/vercel-adapter`
(`bbbb7d3`). Commits: `25e8ace` feat(web); this commit docs(task).

Files changed:
- `apps/web/app/entities/page.tsx`
- `apps/web/app/entities/[id]/page.tsx`
- `apps/web/app/evaluations/new/page.tsx`
- `apps/web/app/company/page.tsx`
- `apps/web/components/prototype/app-shell.tsx`
- `apps/web/components/prototype/concept-separation-notice.tsx`
- `apps/web/components/prototype/entity-intake-state.tsx`
- `apps/web/lib/demo/entity-intake.ts`
- `apps/web/lib/demo/session.ts`
- `apps/web/lib/demo/types.ts`
- `apps/web/lib/i18n/messages.ts`
- `docs/tasks/TASK-016-cursor-entity-intake-evaluation-workflow.md`

Decisions and assumptions:
- Entity records live at `/entities` and `/entities/:id` using Northstar
  fixtures only (identity/reference, relationship, operational signals,
  declared facts, completeness, provenance, UTC timestamps).
- `/evaluations/new` is the intake route (retained). It collects facts,
  validates required fields, reviews completeness, then acknowledges a local
  non-write. No score is rendered on that screen.
- Policy choice is limited to a local published Northstar policy-version
  fixture. Locale, currency, and time zone are labelled as presentation, not
  authorization.
- A later human decision is described as a case step; the intake does not
  offer approve/reject. Example evaluation detail links are existing fixtures,
  not engine output from the form.
- Denied copy states backend capability checks in a real environment; UI
  visibility is not authorization (`company.evaluate`).
- Canonical brand mark was not changed.

Checks run and exact results:
- `./scripts/check-secrets.sh` — Secret check passed.
- `./scripts/verify-web.sh` — oxlint clean; `vinext build` succeeded; Web
  verification passed. Routes include `/entities` and `/entities/:id`.
- `npm run verify:vercel` (`apps/web`) — Vercel Build Output API v3
  verification passed (config.json v3, Node.js function with handler,
  static/_next client bundle).

Security/tenant/audit impact:
- No Supabase usage in this change, no API calls, no persistence, no engine
  invocation, no emails, no uploads. Fixtures use `@demo.mitiga.local` and
  technical tokens, not UUIDs or real customer data. Tenant scope is visual
  only.

Migration and rollback notes:
- No migrations. Rollback is revert of this branch. No deploy was made.

Known limitations:
- Completeness is derived locally from form fields, not TASK-009.
- Example results after acknowledgement are separate fixtures (`ev_10510`,
  `ev_10477`, `ev_10461`).
- Screenshots were not captured. Interactive browser click-through was not
  available in this agent session.

Recommended reviewer:
Codex (merge owner), with an independent check that intake copy never implies
a write, score, or human decision.

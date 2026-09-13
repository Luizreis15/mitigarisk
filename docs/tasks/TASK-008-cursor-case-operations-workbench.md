# TASK-008 — Cursor case operations workbench

## Objective

Extend the English-first frontend prototype with a focused operational workbench
for reviewing and triaging risk cases. The goal is to make the case flow useful
for an operator without introducing real persistence or provider integrations.

## Scope

- Work only in `apps/web/app/**`, `apps/web/components/**`,
  `apps/web/lib/i18n/**`, `apps/web/lib/demo/**`, and this task file.
- Add a dedicated `/cases` route with local-fixture case queue views for at
  least: `Open`, `Needs information`, `Escalated`, and `Closed`.
- Include local, client-side filtering/search for case reference, subject, risk
  band, and status. Filtering must be honest UI state and must not suggest a
  server query occurred.
- Add practical work-queue metadata: owner, priority, last activity in UTC,
  risk band, evidence state, and next action.
- Make case-detail navigation return naturally to the queue and preserve the
  selected prototype view when reasonable via query parameters.
- Add an empty-state and a no-results state with clear English-first copy.
- Keep `/company`, `/operator`, `/evaluations/:id`, and `/cases/:id`
  functional; link them into the queue only where it improves navigation.
- Reuse the approved MITIGA design system and ensure mobile usability.

## Out of scope

- Supabase queries, database migrations, authentication/session changes,
  real persistence, networking, realtime subscriptions, email, file uploads,
  billing, or edits to `supabase/**` and domain/RLS contracts.
- Changing a case status, owner, or decision in the fixture source of truth.
  Prototype controls may provide local feedback but must state neither that an
  action was saved nor that another operator was notified.

## Acceptance criteria

1. The workbench separates queue state, risk band, evidence state, and human
   decision; it never turns a model score into a final decision.
2. Search and filters operate entirely on typed local fixtures and have clear,
   accessible labels and no-results behaviour.
3. All visible product copy remains English-first and market-neutral through
   the typed message catalog; no Portuguese runtime copy is added.
4. No credentials, network calls, Supabase imports, browser persistence, or
   provider SDKs are introduced.
5. Case details remain understandable standalone and offer a reliable route
   back to the workbench.
6. Desktop and mobile layouts are usable.
7. `./scripts/check-secrets.sh` and `./scripts/verify-web.sh` pass.

## Required handoff

Create branch `feat/cursor-case-operations-workbench`. Use Conventional
Commits, add a complete handoff below, and do not merge. Include: outcome,
commits, changed files, checks, security/tenant impact, limitations, and a
recommended reviewer.

## Handoff notes (Cursor)

_To be completed by Cursor._

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

```text
Outcome:
English-first case operations workbench on feat/cursor-case-operations-workbench. /cases shows Open, Needs information, Escalated, and Closed queues with local search and filters. Case detail returns to the same view via query parameters. Score, evidence, queue state, and human decision stay separate.

Branch and commit:
feat/cursor-case-operations-workbench
- 9ed0ddb feat(web): add operator case workbench with local queue filters
- (this file) docs(task): record TASK-008 Cursor handoff

Files changed:
apps/web/app/cases/page.tsx, apps/web/app/cases/[id]/page.tsx
apps/web/app/company/page.tsx, apps/web/app/operator/page.tsx, apps/web/app/evaluations/[id]/page.tsx
apps/web/components/prototype/app-shell.tsx, apps/web/components/prototype/workbench-case-card.tsx
apps/web/lib/demo/types.ts, apps/web/lib/demo/data.ts, apps/web/lib/demo/workbench.ts, apps/web/lib/demo/labels.ts
apps/web/lib/i18n/messages.ts, this task file.

Decisions and assumptions:
- Bounded context: Cases operations UI, with Evaluation/Audit only as linked presentation. No domain, RLS, or Supabase files changed.
- Queue views map Open = open|in_review, Needs information = waiting_evidence, Escalated = escalated, Closed = closed.
- Search (reference/subject/id), risk band, and status are URL query state only. Copy states that nothing is queried remotely. No localStorage or sessionStorage.
- Fixture source of truth is not mutated: claim/evidence/decision controls on detail still toast and append in-memory timeline only.
- Empty queue is previewed with ?state=empty. No-results appears when the selected view has fixtures but filters match none.
- Last activity uses existing UTC ISO timestamps and en-US/UTC presentation.

Checks run and exact results:
- ./scripts/check-secrets.sh: Secret check passed.
- ./scripts/verify-web.sh: Web verification passed.
  - oxlint (shadcn ignore patterns): pass, exit 0
  - npm run build: pass; routes include /cases, /cases/:id, /company, /operator, /evaluations/:id

Security/tenant/audit impact:
Fictional Helix Commerce cases only. No secrets, credentials, network calls, or browser persistence. Workbench filters are not authorization. Tenant isolation is not enforced server-side in this prototype.

Migration and rollback notes:
No migrations. Rollback is revert of this branch. Do not merge until Codex review.

Known limitations:
- Search updates the URL on each keystroke; there is no remote index.
- In-memory timeline rows on case detail still reset on refresh.
- Browser interaction was not exercised in this environment; verification is lint + production build.

Recommended reviewer:
Codex merge owner; Claude Code to confirm filters stay local and that the UI does not treat score as a final decision.
```

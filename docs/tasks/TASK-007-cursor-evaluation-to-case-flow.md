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

## Handoff notes (Cursor)

```text
Outcome:
English-first prototype flow from a new evaluation to an explainable case and a simulated human decision on feat/cursor-evaluation-case-flow. Company and Operator lists remain usable and now open dedicated evaluation and case views.

Branch and commit:
feat/cursor-evaluation-case-flow
- 63a8279 feat(web): add evaluation-to-case decision prototype flow
- (this file) docs(task): record TASK-007 Cursor handoff

Files changed:
apps/web/app/company/page.tsx, apps/web/app/operator/page.tsx
apps/web/app/evaluations/new/page.tsx, apps/web/app/evaluations/[id]/page.tsx, apps/web/app/cases/[id]/page.tsx
apps/web/components/prototype/recommendation-notice.tsx, apps/web/components/prototype/evaluation-result.tsx, apps/web/components/prototype/audit-timeline.tsx
apps/web/lib/demo/types.ts, apps/web/lib/demo/data.ts, apps/web/lib/demo/flow.ts, apps/web/lib/demo/labels.ts
apps/web/lib/i18n/messages.ts, this task file.

Decisions and assumptions:
- Bounded contexts touched in the UI only: Evaluation, Cases, Audit presentation. No domain/RLS/Supabase files were changed.
- Dedicated routes /evaluations/new, /evaluations/:id, and /cases/:id exist because list screens cannot show score vs quality vs reasons vs decision without crowding.
- Score, risk band, recommendation, data quality, and reason codes are separate fields and copy. The recommendation notice states that the contracting company records the final decision.
- Starting an evaluation does not run a scoring engine; it opens fixture ev_10510. Creating a case from evaluations without a prior operations case opens fixtures cs_360/cs_361/cs_362.
- Approve, reject, escalate, and request more information only toast and append in-memory timeline rows. Copy never claims persistence.
- Reason codes remain technical tokens (DOC_MISMATCH, etc.). Display labels live in the English catalog.

Checks run and exact results:
- ./scripts/check-secrets.sh: Secret check passed.
- ./scripts/verify-web.sh: Web verification passed.
  - oxlint (shadcn ignore patterns): pass, exit 0
  - npm run build: pass; routes include /, /company, /operator, /super-admin, /evaluations/new, /evaluations/:id, /cases/:id

Security/tenant/audit impact:
Fictional Helix Commerce fixtures only. No secrets, credentials, network calls, or Supabase imports in this change. Timeline rows are demonstration evidence (actor, action token, UTC time, correlation) and are not append-only storage. Tenant isolation is not enforced server-side in this prototype.

Migration and rollback notes:
No migrations. Rollback is revert of this branch. Do not merge until Codex review.

Known limitations:
- Form fields on /evaluations/new are not applied to the result fixture.
- Local timeline events reset on refresh.
- No file upload, email, or real case mutation.
- Browser interaction was not exercised in this environment; verification is lint + production build.

Recommended reviewer:
Codex merge owner; Claude Code to confirm the UI does not present the score as a final decision and that no persistence or provider call leaked in.
```

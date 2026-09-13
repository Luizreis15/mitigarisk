# TASK-010 — Cursor risk policy workbench

## Objective

Build the English-first frontend prototype for browsing and inspecting
versioned risk policies. It must make publication status, immutable history,
factor weighting, thresholds, and policy ownership clear without pretending
to edit or publish a real policy.

## Business context

Risk evaluations are explainable only when their policy version is visible and
immutable after publication. The interface should help a Risk Analyst or
Tenant Admin understand the policy that informed a recommendation, while never
presenting a policy configuration as a final customer decision.

## In scope

- Work only in `apps/web/app/**`, `apps/web/components/**`,
  `apps/web/lib/i18n/**`, `apps/web/lib/demo/**`, and this task file.
- Add a `/policies` workbench with typed local fixtures for at least draft,
  published, and archived/superseded policy versions.
- Add `/policies/:id` detail presentation showing policy identity/version,
  lifecycle status, owner, effective period, factors and weights, thresholds,
  last activity in UTC, and a compact immutable-history/audit presentation.
- Link evaluation detail back to the policy version it references, and link
  appropriate Company/Operator navigation into policy viewing when capabilities
  make the link relevant in the prototype.
- Provide local visual filtering/search by policy name, version/status, and
  lifecycle state. State honestly that results are local fixtures, not remote
  data.
- Include empty and no-results states; preserve selected filters in URL query
  parameters where reasonable.
- Use the approved MITIGA design system and responsive, accessible layouts.

## Out of scope

- Supabase queries, migrations, auth/session changes, persistence, real draft
  editing, policy simulation, publish/unpublish actions, network calls, billing,
  integrations, and changes to the deterministic evaluation engine/domain
  contracts.
- Any interface that claims an evaluation score is a customer decision.

## Acceptance criteria

1. Published policy versions visibly communicate immutability; draft and
   archived/superseded versions have unambiguous, distinct states.
2. Factors, weights, thresholds, reason codes where shown, score bands, data
   quality, recommendation, and human decision are never conflated.
3. Filters/search are typed local state only, URL-addressable, and include
   usable no-results and empty states.
4. All product copy is English-first, market-neutral, and routed through the
   typed message catalog; technical tokens remain distinct from display text.
5. No Supabase import, credential, provider SDK, network call, browser
   persistence, or Portuguese runtime copy is added.
6. Existing evaluation, case, company, and operator routes continue working.
7. `./scripts/check-secrets.sh` and `./scripts/verify-web.sh` pass.

## Required handoff

Create branch `feat/cursor-risk-policy-workbench` from current `main`. Use
Conventional Commits and do not merge. Append the standard handoff below:
outcome, commits, changed files, checks, security/tenant impact, limitations,
and recommended reviewer.

## Handoff notes (Cursor)

```text
Outcome:
English-first risk policy workbench on feat/cursor-risk-policy-workbench. /policies lists draft, published, and archived/superseded versions. /policies/:id shows identity, lifecycle, owner, effective period, factors/weights, recommendation-path thresholds, last activity in UTC, and compact history. Evaluation detail and Company navigation link into the version that informed a recommendation. Published versions are labeled immutable; the UI does not edit or publish.

Branch and commit:
feat/cursor-risk-policy-workbench
- cf199e2 feat(web): add versioned risk policy workbench
- (this file) docs(task): record TASK-010 Cursor handoff

Files changed:
apps/web/app/policies/page.tsx, apps/web/app/policies/[id]/page.tsx
apps/web/app/company/page.tsx, apps/web/app/evaluations/[id]/page.tsx, apps/web/app/denied/page.tsx
apps/web/components/prototype/app-shell.tsx, apps/web/components/prototype/evaluation-result.tsx, apps/web/components/prototype/status-badge.tsx
apps/web/lib/demo/types.ts, apps/web/lib/demo/session.ts, apps/web/lib/demo/policies.ts, apps/web/lib/demo/policy-workbench.ts, apps/web/lib/demo/labels.ts
apps/web/lib/i18n/messages.ts, this task file.

Decisions and assumptions:
- Bounded context: Risk policy presentation only. No domain engine, RLS, or Supabase files were changed.
- Lifecycle fixtures: pol-2026.09.13-v5 draft, pol-2026.09.11-v4 published (matches evaluation policyVersion), pol-2026.08.02-v3 archived/superseded.
- Thresholds map score ranges to a recommendation path (accept path / review / additional evidence), kept distinct from risk score band, data quality, reason codes, and human case decisions.
- Search (name/id/version number) and lifecycle filters are URL query state. Copy states results are local. Empty list uses ?state=empty.
- policy.view was added to the Helix company membership so Company navigation shows the workbench; Operator membership does not include it.
- No publish, simulate, or edit controls; notices state the prototype does not save policy changes.

Checks run and exact results:
- ./scripts/check-secrets.sh: Secret check passed.
- ./scripts/verify-web.sh: Web verification passed.
  - oxlint (shadcn ignore patterns): pass, exit 0
  - npm run build: pass; routes include /policies, /policies/:id, /company, /operator, /evaluations/:id

Security/tenant/audit impact:
Fictional Helix Commerce policy versions only. No secrets, credentials, network calls, or browser persistence. History rows are demonstration evidence (action token, actor, UTC time, correlation), not append-only storage. UI visibility is not authorization.

Migration and rollback notes:
No migrations. Rollback is revert of this branch. Do not merge until Codex review.

Known limitations:
- Filters update the URL on each change; there is no remote index.
- Browser interaction was not exercised in this environment; verification is lint + production build.
- Operators can still open a policy URL directly; the prototype does not enforce server-side denial.

Recommended reviewer:
Codex merge owner; Claude Code to confirm published versions read as immutable and that recommendation paths are not presented as customer decisions.
```

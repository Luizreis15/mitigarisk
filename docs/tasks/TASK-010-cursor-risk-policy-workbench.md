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

_To be completed by Cursor._

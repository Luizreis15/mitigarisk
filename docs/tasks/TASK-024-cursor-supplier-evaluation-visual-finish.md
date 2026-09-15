# TASK-024 — Cursor supplier evaluation visual finish

## Objective

Turn the real authenticated supplier-evaluation slice delivered by TASK-023
into a polished, coherent, client-reviewable MITIGA experience without
changing its domain behavior, authorization, persistence, or database model.

The result must let a Company user understand where they are, create a
fictional supplier, review fictional evidence metadata, run the deterministic
evaluation, and interpret the recommendation with clear separation from the
future Company Admin final decision.

## Required base and branch

- Start from `origin/preview/vercel-adapter` at or after `b5a1dde`, which
  contains the independently security-reviewed TASK-023.
- Create `feat/cursor-supplier-evaluation-visual-finish`.
- Use Conventional Commits.
- Do not merge, deploy, push migrations, or modify hosted services.

## Product truths that must remain explicit

- All demonstration content is fictional.
- The deterministic engine produces a recommendation only: `approve`,
  `review`, or `reject`.
- A recommendation is not the final business decision.
- Only a Company Admin may record the future final decision; this task does
  not implement that mutation.
- Evidence in this slice is metadata only. No file is uploaded or stored.
- Platform administrators have no operational access to tenant supplier or
  evaluation records.

## In scope

- Polish only the real authenticated routes under `/workspace/suppliers` and
  their workspace entry point.
- Improve hierarchy, spacing, responsive layout, form grouping, empty/loading/
  error/success states, keyboard focus, labels, help text, and recommendation
  presentation using the established MITIGA visual language.
- Make the supplier journey legible as a short progression: supplier details,
  evidence readiness, deterministic evaluation, and recommendation.
- Present the score, band, data quality, missing factors, and reason codes in a
  way a non-technical reviewer can understand without hiding the underlying
  deterministic result.
- Keep a persistent and prominent distinction between engine recommendation
  and Company Admin final decision.
- Keep fictional-data and metadata-only evidence notices visible at the point
  where they matter, without overwhelming every screen.
- Externalize all new or changed English copy in the typed message catalog.
- Reuse existing components and design tokens. Add small workspace-only
  presentation components when they materially improve clarity.
- Add or update presentation and source-boundary tests for the changed states.
- Inspect the full journey in a browser at narrow and wide viewport widths,
  capturing screenshots when the environment permits.

## Out of scope

- Any migration, RLS policy, RPC, seed, repository, domain rule, Server Action,
  capability, authentication, tenant-selection, audit-event, evaluation
  algorithm, or idempotency change.
- Final Company decision persistence, cases, assignments, notifications,
  binary evidence upload, storage, external providers, analytics, email, or
  real customer data.
- Changes to prototype routes, Super Admin, Operator, Company demo areas,
  landing/auth routes, or the approved brand mark.
- Hosted Supabase, Vercel, DNS, deploy, secrets, credentials, `.env` files, or
  production configuration.

## Allowed files

- `apps/web/app/workspace/page.tsx`
- `apps/web/app/workspace/suppliers/**` presentation files only; do not change
  `actions.ts`
- `apps/web/components/workspace/**`
- `apps/web/lib/i18n/**`
- `apps/web/tests/app/**`
- `apps/web/tests/domain/**` only for presentation/view-model behavior
- this task file

Do not modify `apps/web/lib/domain/**`, `apps/web/lib/supabase/**`,
`supabase/**`, `apps/web/app/workspace/suppliers/actions.ts`, or
`apps/web/lib/demo/**`.

## Acceptance criteria

1. A reviewer can navigate from `/workspace` to the supplier list, create a
   fictional supplier, open its detail, understand evidence readiness, run an
   evaluation, and interpret the result without losing context.
2. Narrow and wide layouts have no clipped primary actions, unreadable result
   content, broken focus order, or horizontal overflow.
3. Forms have explicit labels, useful validation placement, clear required/
   optional treatment, and accessible focus/error behavior.
4. Empty, configuration-unavailable, unauthorized, read-failure, and action-
   failure states remain truthful and do not imply that an operation succeeded.
5. Recommendation, score, quality, missing factors, and reason codes remain
   faithful to server-provided values and are never recomputed in presentation
   code.
6. The UI never implies that `approve`, `review`, or `reject` is a recorded
   Company decision.
7. No security, tenant-isolation, persistence, audit, or engine behavior from
   TASK-023 changes.
8. All required local checks pass and the branch is clean.

## Required verification

Run and report exact results for:

```text
cd apps/web && npm test
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npm run verify:vercel
./scripts/check-secrets.sh
./scripts/verify-web.sh
git diff --check
```

Browser review is required when browser tooling is available:

- wide viewport: `/workspace`, supplier list, create form, supplier detail,
  evidence state, and completed evaluation state;
- narrow viewport around 375 px for the same critical journey;
- keyboard traversal through forms and primary actions;
- verify the fictional-data, metadata-only evidence, and recommendation-not-
  decision disclosures;
- use only fictional records and do not access hosted production services.

If authenticated local browser states cannot be reached without credentials or
hosted mutations, do not weaken the boundary or request secrets. Document the
exact limitation and inspect all safely reachable states with test fixtures or
component-level evidence.

## Security, tenant, privacy, audit, and rollback impact

- Tenant isolation and authorization: unchanged; all real data continues to
  come through TASK-023 server boundaries.
- Privacy: only fictional demonstration records are permitted.
- Auditability: unchanged; this task introduces no business mutation.
- Engine integrity: unchanged; presentation consumes persisted results only.
- Migration: none.
- Rollback: revert the task commits; no hosted state exists to undo.

## Required handoff

Append a complete handoff to this file containing outcome, branch/base and
commits, files changed, decisions and assumptions, exact check results,
browser routes and viewport results, screenshots when available, accessibility
notes, security/tenant/privacy/audit impact, migration/rollback notes, known
limitations, and recommended reviewer. Do not merge or deploy.

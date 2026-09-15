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

## Handoff

**Outcome:** The authenticated supplier evaluation slice now presents a coherent four-step journey from supplier details through evidence readiness and deterministic recommendation to a visibly pending Company Admin decision. Wide tables have dedicated card layouts at narrow widths, forms are grouped and labelled, empty and error states remain truthful, and fictional-data plus metadata-only boundaries are shown where they matter.

**Branch, base, and commits:** `feat/cursor-supplier-evaluation-visual-finish`, based on `origin/preview/vercel-adapter@84c9686` (including TASK-023 integration `b5a1dde`).

- `958b974` — `feat(web): polish supplier evaluation journey`
- `4b10831` — `docs(task): record TASK-024 handoff`
- `db2279d` — `fix(web): present supplier evaluation states truthfully`
- review-correction documentation commit recorded separately after this update

**Files changed:**

- `apps/web/app/workspace/suppliers/[supplierId]/page.tsx`
- `apps/web/components/workspace/supplier-create-form.tsx`
- `apps/web/components/workspace/supplier-evaluation-panel.tsx`
- `apps/web/components/workspace/supplier-evidence-form.tsx`
- `apps/web/components/workspace/supplier-evidence-list.tsx`
- `apps/web/components/workspace/supplier-journey.tsx`
- `apps/web/components/workspace/supplier-list.tsx`
- `apps/web/components/workspace/supplier-summary.tsx`
- `apps/web/components/workspace/workspace-real-entry.tsx`
- `apps/web/components/workspace/workspace-real-frame.tsx`
- `apps/web/lib/i18n/messages.ts`
- `apps/web/tests/app/workspace-component-boundary.test.ts`
- `docs/tasks/TASK-024-cursor-supplier-evaluation-visual-finish.md`

**Decisions and assumptions:**

- The four-step progress display is presentational only. It marks details, evidence presence, and a completed evaluation from server-provided props; the Company decision is always pending because this task does not implement it.
- The engine recommendation and persisted score are displayed verbatim. Presentation code does not calculate scores, thresholds, decision bands, quality, missing factors, or reason codes.
- The Company Admin decision boundary is always visible, including before an evaluation runs, and the completed result repeats that its recommendation is not a business decision.
- Desktop tables remain available from the `sm` breakpoint; below it, supplier and evidence records use non-scrolling cards to avoid horizontal overflow around 375 px.
- New and changed English copy is externalized in the typed message catalog.

**Checks run and exact results:**

- `cd apps/web && npm test` — passed after review corrections: 216 tests, 0 failed, 0 skipped.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — passed with no diagnostics.
- `cd apps/web && npm run verify:vercel` — passed; generated and validated genuine Vercel Build Output API v3 output.
- `./scripts/check-secrets.sh` — passed: `Secret check passed.`
- `./scripts/verify-web.sh` — passed: oxlint clean and vinext production build complete; supplier list and detail routes present.
- `git diff --check` — passed with no whitespace errors.

**Browser routes and viewport results:** Browser review of authenticated states was not safely available. Starting the local runtime automatically detected an existing ignored local environment file, so the process was stopped immediately before opening a browser; no environment value was displayed or inspected. Because `/workspace/suppliers` is intentionally protected, the wide and 375 px authenticated journey could not be reached without using that configuration and a real session. No screenshots were captured. Responsive behavior is covered by explicit narrow/wide source-boundary assertions and the successful production builds.

**Accessibility notes:** Heading and landmark relationships are explicit; progress uses an ordered list with a navigation label; forms retain programmatic labels and native required semantics while adding visible required/optional treatment; supporting disclosure text is connected through `aria-describedby`; action errors retain live alert semantics; decorative icons are hidden from assistive technology; keyboard focus rings are explicit on custom links; narrow cards preserve document order and minimum action height.

**Security, tenant, privacy, audit, and engine impact:** Unchanged. No action, domain, repository, Supabase, migration, capability, tenant-selection, audit-event, or evaluation-engine file changed. Real reads and writes remain behind TASK-023 server boundaries. Platform administrators retain no operational tenant access. Only fictional demonstration records are permitted. Evidence remains metadata-only with no file input or storage. No hosted service, credential, secret, or customer data was accessed.

**Migration and rollback:** No migration and no hosted state. Rollback is a revert of the two TASK-024 commits.

**Known limitations:** Authenticated browser interaction, keyboard traversal in a live session, and visual screenshots remain pending for an approved non-production test environment that can be used without reading local secrets. Action success continues to use the existing server redirect behavior; no new success mutation or toast was introduced.

**Recommended reviewer:** Codex merge owner for scope and visual acceptance, with a final authenticated 375 px/wide click-through in an approved isolated test environment before deployment.

### Independent-review corrections

All three P2 findings from the independent review were corrected within the TASK-024 presentation boundary:

1. Persisted `pending` and `failed` evaluations now render distinct, truthful states. Neither state claims that no evaluation has run, and neither presents a recommendation.
2. The journey and evidence count now describe evidence as recorded metadata, never as ready. A rejected metadata entry therefore cannot be presented as evidence readiness.
3. Narrow evidence cards apply `min-w-0` to the flex container and display-name item plus safe word breaking, preventing a 200-character or unbroken name from forcing horizontal overflow beside the status badge.

Regression coverage asserts both persisted non-completed evaluation branches, the absence of readiness language in the journey, and the mobile overflow classes. No domain, repository, action, Supabase, migration, or hosted-service behavior changed. All required checks were rerun after these corrections with the results recorded above.

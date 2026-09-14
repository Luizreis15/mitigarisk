# TASK-020 — Cursor product and experience audit

## Objective

Perform an independent, evidence-based audit of MITIGA's current product and
frontend implementation at the frozen audit baseline. Produce findings and a
prioritized remediation backlog without changing application code.

## Audit baseline

- Audit the exact commit identified by the annotated Git tag
  `audit-baseline-2026-09-13-r2`.
- Record the resolved commit SHA at the beginning of the report.
- If the tag is missing or resolves to a different base than the task contract,
  stop and report the discrepancy. Do not silently audit another revision.

## In scope

- Read the repository instructions, architecture, governance, accepted ADRs,
  every task contract and handoff, frontend source, tests, scripts, and package
  manifests relevant to the current web product.
- Inventory every route and classify it as real, demo/fixture, mixed,
  incomplete, inaccessible, or documentation-only.
- Audit product flow coherence across sign-in, workspace, Platform Super
  Admin, Company, Operator/Auditor, entities, evaluations, policies, cases,
  memberships, invitation, and onboarding.
- Audit whether visible copy truthfully distinguishes real authentication,
  local-only prototype behavior, recommendations, human decisions,
  persistence, notifications, support access, and tenant boundaries.
- Review responsive behavior, keyboard navigation, focus, semantics, form
  states, empty/loading/error/denied states, and obvious accessibility risks.
- Review English-first/message-catalog compliance, market neutrality, approved
  brand-mark usage, navigation consistency, and duplicated or dead UI paths.
- Review test coverage and build evidence for frontend behavior. Run the
  required local checks and record exact results.
- Identify conflicts, regressions, stale assumptions, and unfinished handoffs
  across TASK-001 through TASK-019.
- Produce a severity-ranked finding register and a sequenced remediation
  backlog suitable for the remaining 35-day delivery window.

## Out of scope

- Any source-code correction, refactor, formatting change, dependency update,
  migration, Supabase/Vercel/hosted access, `.env` reading, credential request,
  real-user action, deployment, merge, or production recommendation presented
  as already approved.

## Allowed files

- Read-only: the whole repository except ignored environment/credential files.
- Write only:
  - `docs/audits/2026-09-13-cursor-product-experience-audit.md`
  - this task file, solely to append the handoff.

## Finding standard

Every finding must include:

- stable ID `CUR-###`;
- severity: critical, high, medium, low, or observation;
- confidence: high, medium, or low;
- affected route/file with line reference when applicable;
- observed evidence, not an assumption;
- user/business impact;
- recommended remediation and acceptance evidence;
- dependency or owner: Cursor, Claude Code, Codex, or human decision;
- classification: release blocker, pre-MVP, post-MVP, or accepted limitation.

Do not report a preference as a defect. Clearly separate verified facts,
inferences, and items that require browser or human confirmation.

## Required verification

Run and report exact results for:

```text
cd apps/web && npm test
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npm run build
cd apps/web && npm run verify:vercel
./scripts/check-secrets.sh
./scripts/verify-web.sh
```

If browser access is available, inspect representative routes at narrow and
wide viewport widths without authenticating as a real user or mutating hosted
state. If unavailable, state that limitation; do not fabricate screenshots.

## Acceptance criteria

1. The report covers every current route and all completed/pending task
   contracts through TASK-019.
2. Real, fixture, and mixed behavior are explicitly distinguished.
3. Findings are evidence-backed, deduplicated, severity-ranked, and actionable.
4. Accessibility, responsive, copy, navigation, market-neutrality, privacy,
   tenant-boundary representation, and regression risks are covered.
5. The report contains a recommended 35-day frontend/product sequence but does
   not make protected business decisions for the human owner.
6. No application code or external system is changed.

## Required handoff

Create `audit/cursor-product-experience-2026-09-13` from the tagged baseline.
Use Conventional Commits, do not merge or deploy, and append the standard
handoff to this file. Include report path, audited SHA, exact checks, finding
counts by severity, limitations, security/tenant/privacy impact, rollback, and
recommended reviewer. The recommended reviewer is Codex.

## Handoff notes (Cursor)

Outcome:
Independent product/experience audit completed for the frozen baseline.
No application code, migrations, hosted systems, or secrets were changed.
No merge or deploy was made.

Branch and commit:
`audit/cursor-product-experience-2026-09-13` from annotated tag
`audit-baseline-2026-09-13-r2` (`93d02fd8b206e0dea2b36af0dec9f1e91847196a`).
Commits: `fe949ee` docs(audit); this commit docs(task).

Report path:
`docs/audits/2026-09-13-cursor-product-experience-audit.md`

Audited SHA:
`93d02fd8b206e0dea2b36af0dec9f1e91847196a` (confirmed via
`git rev-parse 'audit-baseline-2026-09-13-r2^{commit}'`).

Files changed:
- `docs/audits/2026-09-13-cursor-product-experience-audit.md`
- `docs/tasks/TASK-020-cursor-product-experience-audit.md`

Finding counts by severity:
critical 0, high 4, medium 9, low 4, observation 6 (CUR-001–CUR-023).

Decisions and assumptions:
- Annotated tag object SHA differs from the commit SHA; the peeled commit
  matches the contract, so the audit proceeded.
- ADR 0010’s ungated demo is treated as an accepted limitation except where
  `/workspace` deep-links into fixture “Signed in as” identity (CUR-001).
- TASK-019 remains unimplemented; that is a planned gap, not a TASK-018
  regression.
- Browser inspection was unavailable; a11y/responsive items that need a
  headed pass are labeled as such.

Checks run and exact results:
- `cd apps/web && npm test` — 106 tests, 0 fail.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — passed, no diagnostics.
- `cd apps/web && npm run build` — vinext build succeeded; `/workspace` present.
- `cd apps/web && npm run verify:vercel` — genuine Vercel Build Output API v3.
- `./scripts/check-secrets.sh` — Secret check passed.
- `./scripts/verify-web.sh` — oxlint clean; vinext build succeeded; Web
  verification passed.
- Browser inspection and screenshots: unavailable.

Security/tenant/audit impact:
Documentation only. Tenant isolation unchanged. `.env` not read. Hosted
Supabase/Vercel not accessed. No credentials requested.

Migration and rollback notes:
No migrations. Rollback is revert of the documentation commits on this
branch.

Known limitations:
No headed browser pass. TASK-015 Development checklist not re-run. Depth of
RLS/cookies deferred to TASK-021.

Recommended reviewer:
Codex.

# TASK-021 — Claude architecture and security audit

## Objective

Perform an independent, broad architecture and security audit of MITIGA at the
frozen audit baseline. Produce evidence-backed findings, threat assessment,
and a prioritized remediation backlog without changing application code,
database definitions, or hosted systems.

## Audit baseline

- Audit the exact commit identified by the annotated Git tag
  `audit-baseline-2026-09-13-r2`.
- Record the resolved commit SHA at the beginning of the report.
- If the tag is missing or resolves to a different base than the task contract,
  stop and report the discrepancy. Do not silently audit another revision.

## In scope

- Read the repository instructions, architecture, governance, all accepted
  ADRs, every task contract/handoff, application/domain code, tests, migrations,
  local SQL verification, scripts, deployment adapters, and manifests.
- Audit bounded-context integrity, modular-monolith boundaries, dependency
  direction, domain invariants, error contracts, versioning, idempotency, and
  rollback posture.
- Audit authentication/session handling, cookie behavior, password-reset
  privacy, server/client Supabase boundaries, configuration failure behavior,
  and the deferred session-refresh middleware risk.
- Audit tenant isolation and authorization across application code, RLS,
  membership lifecycle, capability checks, platform-admin behavior, and all
  client-controlled tenant/role/capability inputs.
- Audit evaluation determinism, contract-version validation, policy
  immutability assumptions, reason/data-quality evidence, recommendation versus
  human-decision separation, and future persistence hazards.
- Audit append-only evidence/audit design, correlation IDs, minimization,
  sensitive logging, retention assumptions, integrations, notifications,
  secrets posture, dependency/build risks, and deployment-environment
  separation.
- Run required local checks and all repository-provided local SQL/security tests
  that do not require hosted access. Record exact commands and results.
- Identify contradictions and incomplete dependencies across TASK-001 through
  TASK-019 and accepted ADRs.
- Produce a severity-ranked finding register, threat summary, release gates,
  and a sequenced remediation backlog for the remaining 35-day window.

## Out of scope

- Any code/schema/document correction outside the report and task handoff,
  destructive testing, `.env` reading, credential request, hosted Supabase or
  Vercel access, external scanning, real customer/user data, migration
  execution against a remote database, deployment, merge, vendor/policy/legal
  approval, or exploit attempts against public systems.

## Allowed files

- Read-only: the whole repository except ignored environment/credential files.
- Write only:
  - `docs/audits/2026-09-13-claude-architecture-security-audit.md`
  - this task file, solely to append the handoff.

## Finding standard

Every finding must include:

- stable ID `CLA-###`;
- severity: critical, high, medium, low, or observation;
- confidence: high, medium, or low;
- affected boundary/file with line reference when applicable;
- threat or failure scenario and concrete repository evidence;
- tenant, privacy, auditability, integrity, availability, and rollback impact
  where relevant;
- recommended remediation and acceptance tests;
- dependency or owner: Cursor, Claude Code, Codex, or human decision;
- classification: release blocker, pre-MVP, post-MVP, or accepted limitation.

Do not claim a vulnerability without evidence. Clearly separate exploitable
conditions, defense-in-depth improvements, design debt, and items requiring
hosted/manual confirmation.

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

Also run repository-provided local Supabase/SQL tests only when their documented
local prerequisites are already available. Do not install services, read `.env`,
request credentials, or access a hosted project. Report unavailable checks as
limitations rather than weakening the restriction.

## Acceptance criteria

1. The report covers architecture, authentication, authorization, tenancy,
   RLS/schema posture, evaluation integrity, auditability, privacy, secrets,
   deployment boundaries, tests, and rollback.
2. Every completed/pending task contract through TASK-019 is reconciled with
   implementation evidence and accepted ADRs.
3. Findings are evidence-backed, deduplicated, severity-ranked, and include
   concrete remediation acceptance tests.
4. The report distinguishes current vulnerabilities from future-integration
   hazards and documented limitations.
5. The report contains explicit release blockers and a recommended 35-day
   security/backend sequence without crossing protected human decisions.
6. No application code, schema, migration, secret, or external system changes.

## Required handoff

Create `audit/claude-architecture-security-2026-09-13` from the tagged baseline.
Use Conventional Commits, do not merge or deploy, and append the standard
handoff to this file. Include report path, audited SHA, exact checks, finding
counts by severity, limitations, security/tenant/privacy/audit impact,
rollback, and recommended independent reviewer. The recommended reviewer is
Codex, with human review for protected decisions.

## Handoff (Claude Code, 2026-09-14)

**Outcome:** Audit complete. No code, schema, or hosted system was changed.
No merge, no deploy.

**Report path:** `docs/audits/2026-09-13-claude-architecture-security-audit.md`.

**Audited baseline:** annotated tag `audit-baseline-2026-09-13-r2`, resolved
and verified to commit `93d02fd8b206e0dea2b36af0dec9f1e91847196a`
(`docs(audit): advance baseline after TASK-018 integration`) via
`git rev-parse audit-baseline-2026-09-13-r2^{commit}` and
`git rev-list -n 1 audit-baseline-2026-09-13-r2`, both matching the checked-out
`HEAD`. No discrepancy between the task contract's stated baseline and the
actual tag. Confirmed before implementing (per the operator's explicit
instruction) that the base contains TASK-018 integrated: its merge commit is
an ancestor of this baseline and `apps/web/components/workspace/**` exists
with real content.

**Branch and commits:** `audit/claude-architecture-security-2026-09-13`
(created from the tag), `56fa79d` `docs(audit): add architecture and
security audit for 2026-09-13 baseline`, plus this handoff commit.

**Files written (exactly the two paths this task's contract allows):**
- `docs/audits/2026-09-13-claude-architecture-security-audit.md` (new report).
- `docs/tasks/TASK-021-claude-architecture-security-audit.md` (this handoff).

No other file was created, edited, or deleted. `git status --short` shows
only these two paths across the task's two commits.

**Methodology:** full read of the repository instructions, architecture and
governance docs, all ten accepted ADRs, every task contract/handoff
TASK-001–TASK-021 (including both TASK-005 files), all `docs/security/*.md`,
`.cursor/rules/*.mdc`, `SECURITY.md`, `CONTRIBUTING.md`, the complete
`apps/web/lib/domain/**`, `apps/web/lib/supabase/**`, `apps/web/lib/i18n/**`,
`apps/web/app/**`, `apps/web/components/auth/**`,
`apps/web/components/workspace/**`, the newest `apps/web/components/prototype/**`/
`apps/web/lib/demo/**` fixture routes, all twelve `supabase/migrations/*.sql`
in order, `supabase/seed.sql`, all three `supabase/tests/*.sql` suites,
`apps/web/vite.config.ts`, `apps/web/vercel.json`,
`apps/web/scripts/verify-vercel-build.mjs`, `.github/workflows/quality.yml`,
`.githooks/pre-commit`, and every test file under `apps/web/tests/**`. Four
parallel read-only evidence-gathering passes were used to cover this volume
(task-contract/ADR reconciliation; auth/session/authorization; database/RLS/
tenant isolation; evaluation-engine/new-routes/deployment); every finding in
the report was independently spot-verified by direct file reads before being
recorded — exact line numbers and quotes were re-read personally, not taken
on trust from a single pass. One finding (CLA-002) was caught only by this
personal re-verification: the evidence-gathering pass reported the middleware
comment issue at the file level, but re-reading the exact lines revealed the
file contradicts *itself* (an accurate top-of-file comment vs. a stale,
false inline comment), which is a stronger and more precisely evidenced
finding than "a comment is wrong."

**Exact checks run and results (from a clean state, at this commit):**
```text
$ cd apps/web && npm test
ℹ tests 106 / pass 106 / fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — zero diagnostics)

$ cd apps/web && npm run build
Build complete. Route (app) lists all 21 routes.

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment.

$ ./scripts/check-secrets.sh
Secret check passed.

$ ./scripts/verify-web.sh
oxlint clean; vinext build succeeded; Web verification passed.
```
Supplementary (not required, run for additional evidence):
`npm audit --omit=dev --audit-level=high` → 0 vulnerabilities;
`./supabase/tests/run-local-verification.sh` (disposable local PostgreSQL,
no Docker, no hosted project) → all checks passed, all three numbered SQL
suites (010/020/030) passed in full.

**Finding counts by severity:** 0 critical, 2 high (CLA-001, CLA-003), 2
medium (CLA-002, CLA-010), 7 low (CLA-004, CLA-005, CLA-006, CLA-009,
CLA-011, CLA-012, CLA-014), 3 observation (CLA-007, CLA-008, CLA-013). 14
findings total. No currently-exploitable cross-tenant data leak, secret
exposure, or authentication bypass was found in shipped code.

**Limitations (also detailed in the report):** no hosted Supabase/Vercel
access was used or requested; the manual Development test checklist
(`docs/security/TASK-015-manual-test-checklist.md`) was not executed and is
reported as pending, per the task contract's explicit instruction not to
weaken the restriction; no browser was available, so frontend/accessibility
observations are from source reading only (TASK-020 owns interactive
verification); RLS/immutability/idempotency claims about production
behavior are verified only against the local disposable PostgreSQL harness,
not the hosted project; no exploit was attempted against any finding — every
threat scenario in the report is a traced code-path analysis.

**Security/tenant/privacy/audit impact of this task itself:** none. No
application code, schema, migration, secret, or external system was
changed. No `.env*` file was read (only file *names* were referenced when
confirming gitignore coverage). No hosted Supabase or Vercel project was
accessed. No credential was requested or handled.

**Rollback:** trivial — revert the two commits on this branch (the report
and this handoff). Nothing else in the repository depends on this branch;
no migration, schema, or hosted state exists to roll back.

**Recommended reviewer:** Codex, for consolidation with TASK-020's parallel
product/experience audit and remediation-ordering decisions, per
`docs/audits/README.md`. Human review is required specifically for the two
release-gating items that are protected decisions, not engineering work:
CLA-010 (role → capability matrix ratification) and confirming CLA-001's
resumed TASK-019 scope before it proceeds.

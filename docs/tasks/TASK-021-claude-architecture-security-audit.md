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

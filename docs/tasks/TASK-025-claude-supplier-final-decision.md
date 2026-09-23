# TASK-025 — Claude supplier final decision

## Objective

Complete the first real supplier-risk workflow by allowing an authenticated
Company Admin to record one explicit final business decision — `approve`,
`review`, or `reject` — after reviewing a completed deterministic supplier
evaluation. Preserve the recommendation and final decision as separate,
immutable, auditable facts.

## Human-approved product decisions

- The deterministic engine produces a recommendation only.
- The final outcome is chosen by the Company Admin from `approve`, `review`,
  or `reject`.
- Development and demonstration data must remain entirely fictional.
- Platform administrators, analysts, operators, auditors, and browser claims
  must never gain final-decision authority implicitly.

## Required base and branch

- Start from `origin/preview/vercel-adapter` at or after `83abe92`.
- Create `feat/claude-supplier-final-decision`.
- Use Conventional Commits.
- Do not merge, deploy, run hosted migrations, or modify hosted services.

## In scope

- Add the smallest forward-only database migration and tenant-scoped model
  needed to record a final supplier-evaluation decision.
- Require an active `tenant_admin` membership at the database boundary. Do not
  authorize through a role label supplied by the browser, a generic UI
  capability, platform-admin status, or RLS alone.
- Accept only `approve`, `review`, or `reject` at runtime and in database
  constraints; reject every other value with stable typed domain errors.
- Require a same-tenant completed evaluation. Pending, failed, missing,
  malformed, and cross-tenant evaluation identifiers fail closed without
  disclosing record existence.
- Keep the engine recommendation unchanged and store the final decision in a
  separate immutable record linked to the evaluation, policy version,
  supplier, tenant, verified actor, UTC timestamp, correlation/idempotency
  identifier, and optional concise rationale.
- Derive actor identity from `auth.uid()` at the database boundary.
- Record the decision and append-only audit event atomically or write neither.
- Define replay behavior: the same correlation identifier returns the same
  result or a stable conflict; it must never create a duplicate silently.
- Prevent direct authenticated table inserts/updates/deletes; expose only a
  narrowly authorized RPC or equivalent trusted database boundary.
- Add a request-scoped repository, Server Action, typed domain validation,
  and minimal integration into the real supplier detail route.
- Present the latest engine recommendation beside a clearly separate Company
  Admin decision form/result. Users without authority receive a truthful
  read-only state, not a disabled control that implies authorization.
- Externalize English copy and add domain, repository, action-boundary,
  component-boundary, and positive/negative SQL tests.
- Add a manual local/Development browser verification checklist using only
  fictional records.

## Initial decision fields

- `id`, `tenant_id`, `supplier_id`, `evaluation_id`, `policy_version_id`;
- `decision` constrained to `approve|review|reject`;
- optional `rationale`, trimmed and length-bounded, containing no personal or
  sensitive evidence data;
- `correlation_id` with tenant-scoped idempotency semantics;
- database-pinned `decided_by` and UTC `decided_at`;
- immutable creation metadata required by existing audit conventions.

## Out of scope

- Changing the deterministic score, thresholds, policy, reason codes, or
  recommendation; automatic conversion of recommendation into decision;
- decision reversal, reopening, amendment, deletion, approval chains, dual
  control, case assignment, SLA, notifications, email, or exports;
- evidence file upload, Storage, third-party screening, real customer data, or
  changes to prototype routes;
- platform support access, impersonation, role redesign, membership
  administration, billing, analytics, or unrelated audit remediation;
- hosted Supabase, Vercel, secrets, credentials, `.env` files, deploy, or
  production configuration.

## Allowed files and bounded contexts

- new forward migrations under `supabase/migrations/**`;
- `supabase/tests/**`;
- `apps/web/app/workspace/suppliers/**`;
- `apps/web/components/workspace/**`;
- narrowly scoped files under `apps/web/lib/domain/**` and
  `apps/web/lib/supabase/**` for this decision boundary;
- `apps/web/lib/i18n/**`;
- `apps/web/tests/**`;
- `docs/adr/**`, `docs/security/**`, and this task file.

Do not modify `apps/web/lib/demo/**`, existing prototype routes, existing
migrations, or the evaluation engine contract.

## Security, tenant, privacy, audit, and integrity requirements

- Authorization is verified server-side and again in the database.
- Only an active same-tenant `tenant_admin` may decide.
- Platform administrators have no operational bypass.
- Actor, tenant, supplier, evaluation, recommendation, policy version, audit
  action, and timestamps cannot be forged by browser input.
- Direct PostgREST writes are denied even to otherwise capable callers.
- The final decision is immutable in this task. No update/delete grants.
- Audit data contains stable identifiers, action, actor, UTC time, outcome,
  and correlation only; do not log rationale, registration identifiers,
  cookies, tokens, or evidence declarations.
- Recommendation and decision may differ. Store and display both truthfully;
  do not label disagreement as an engine failure.
- No service-role key may be requested, read, printed, used, or referenced in
  browser code.

## Acceptance criteria

1. An active tenant Admin can record exactly one final decision for a completed
   same-tenant supplier evaluation.
2. `risk_analyst`, `operator`, `auditor`, platform admin, inactive membership,
   missing membership, and cross-tenant callers are denied at the database
   boundary and through the application boundary.
3. Invalid decision values, malformed identifiers, pending/failed evaluations,
   direct inserts, forged actor/tenant, and duplicate/conflicting replays have
   explicit negative tests.
4. The decision and matching audit event are atomic and immutable.
5. The persisted engine recommendation remains unchanged and separately
   visible from the final Company decision.
6. A page reload returns the same persisted final decision.
7. Users without decision authority see the result read-only and cannot submit
   a decision form.
8. No hosted system or real customer record is touched.

## Required verification

Run and report exact results for:

```text
./supabase/tests/run-local-verification.sh
cd apps/web && npm test
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npm run build
cd apps/web && npm run verify:vercel
./scripts/check-secrets.sh
./scripts/verify-web.sh
git diff --check
```

Run direct database tests proving every denied identity and forged-input case,
plus atomic audit creation, immutability, idempotency, and recommendation/
decision separation. If safe authenticated browser access is unavailable, do
not request credentials or inspect ignored environment files; document the
limitation precisely.

## Required independent review

Before integration, an agent other than the implementation author must review
the SQL authorization boundary, actor provenance, tenant isolation,
idempotency, immutability, audit atomicity, and recommendation/decision
separation. High or medium findings block integration until corrected and
re-reviewed.

## Migration and rollback

- Forward-only local migration during implementation.
- No hosted migration without separate human approval.
- Document a safe rollback/remediation path that preserves previously written
  audit evidence; do not propose destructive production rollback.

## Required handoff

Append the complete standard handoff to this file: outcome, branch/base and
commits, files changed, decisions and assumptions, exact checks and database
assertions, browser verification, security/tenant/privacy/audit impact,
migration and rollback/remediation, known limitations, and recommended
independent reviewer. Do not merge or deploy.

## Handoff — 2026-09-15

### Outcome

Implemented the database-first supplier final-decision boundary. An active
same-tenant `tenant_admin` can record exactly one immutable `approve`, `review`,
or `reject` decision for a completed supplier evaluation. The database derives
tenant, supplier, policy version, actor, and timestamps from trusted persisted
state; the decision and its audit event are atomic. Recommendation and final
decision remain separate persisted and presented facts.

The implementation and all local checks pass. An independent review reported
one blocking P1 (a dual-role platform administrator could satisfy the active
tenant-admin check). Commit `046a1aa` closes it explicitly at every database
surface and adds direct regression coverage. Independent re-review remains an
integration gate; this branch is not merged or published.

### Branch, base, and commits

- Branch: `feat/claude-supplier-final-decision`
- Base: `origin/preview/vercel-adapter` at `206d373`, which is after required
  TASK-024 integration `83abe92` and includes this contract.
- Implementation: `c907b0e feat(suppliers): add immutable final decision boundary`
- Security correction: `046a1aa fix(suppliers): deny dual-role platform administrators`
- Documentation: recorded by the commit containing this handoff.

### Files changed

- New forward migration: `supabase/migrations/20260915120000_supplier_final_decisions.sql`.
- New direct database suite: `supabase/tests/050-supplier-final-decision.sql`.
- New domain contract: `apps/web/lib/domain/supplier-final-decision.ts` and
  export from `apps/web/lib/domain/index.ts`.
- New request-scoped repository:
  `apps/web/lib/supabase/supplier-final-decisions-repository.ts`.
- Extended supplier Server Actions and detail route under
  `apps/web/app/workspace/suppliers/**`.
- New `supplier-final-decision-panel.tsx`; updated evaluation panel and journey.
- Externalized English copy in `apps/web/lib/i18n/messages.ts`.
- Domain, repository, action, component, and existing presentation tests under
  `apps/web/tests/**`.
- Manual checklist: `docs/security/TASK-025-manual-test-checklist.md`.

No demo module, prototype route, existing migration, evaluation-engine
contract, hosted configuration, or external service was changed.

### Decisions and assumptions

- A dedicated `supplier_final_decisions` record was used instead of the older
  case-decision model because TASK-025 is linked directly to a supplier
  evaluation and permits no case-workflow expansion.
- Authority is the active `tenant_admin` role checked by
  `app.is_active_tenant_admin()`, not `case.decide`, UI state, or platform-admin
  status. The application performs membership and platform-admin checks, while
  the database is independently authoritative.
- Rationale is optional, trimmed, and limited to 500 characters. It is never
  copied into audit metadata.
- A tenant/evaluation advisory transaction lock serializes concurrent attempts.
  An identical correlation replay returns the original row; changed payload or
  a second correlation for the same evaluation returns stable SQLSTATE `23505`.
- Users with `evaluation.view` may read a persisted decision. Only the active
  tenant admin receives a form; all other authorized readers receive truthful
  read-only presentation.

### Checks and exact results

- `./scripts/run-local-verification.sh` — not present in this repository
  (`exit 127`). The established credential-free equivalent documented and used
  since TASK-002 was run instead:
  `./supabase/tests/run-local-verification.sh` — passed; every migration, seed,
  and SQL suite completed with `==> all checks passed`.
- TASK-025 SQL suite: 26 positive/negative assertions passed, covering pinned
  actor, trimmed rationale, unchanged recommendation, atomic audit creation,
  rationale exclusion from audit, admin authority, identical replay, duplicate
  prevention, conflicting replay, one decision per evaluation, direct-write
  denial, update/delete immutability, pending/missing non-disclosure, five
  unauthorized identities, explicit dual-role platform-admin authority/read/
  write denial, and inactive-admin denial.
- `cd apps/web && npm test` — 223 passed, 0 failed, 0 skipped.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — passed with no diagnostics.
- `cd apps/web && npm run build` — passed; supplier list/detail routes built.
- `cd apps/web && npm run verify:vercel` — passed; Vercel Build Output API v3
  output validated.
- `./scripts/check-secrets.sh` — `Secret check passed.`
- `./scripts/verify-web.sh` — oxlint and vinext build passed;
  `Web verification passed.`
- `git diff --check` — passed with no whitespace errors.

### Browser verification

Not executed. Safe authenticated browser access was unavailable without using
ignored environment configuration or hosted services, both prohibited by the
task. No credential or environment file was inspected. The manual checklist
documents the isolated fictional-data walkthrough for a later authorized
environment.

### Security, tenant, privacy, audit, and integrity impact

- Tenant isolation: every decision carries tenant ID and composite same-tenant
  foreign keys; unauthorized and cross-tenant references fail closed.
- Least privilege: no platform-admin bypass and no generic capability can grant
  mutation authority. Direct authenticated insert/update/delete is denied.
- Provenance: `decided_by = auth.uid()` and server/database UTC timestamps are
  not RPC parameters.
- Audit: the RPC inserts the immutable decision and append-only audit event in
  one transaction. Audit contains stable IDs, action, recommendation, decision,
  outcome, actor, time, and correlation; it excludes rationale and evidence.
- Integrity: the completed evaluation and its recommendation are read only and
  never modified or recomputed by this task.
- Privacy: only fictional test data was used; no personal or hosted data was
  accessed.

### Migration and rollback/remediation

The migration is forward-only and has not been applied to a hosted project.
For a deployed rollback, revoke execute access and stop application calls in a
forward remediation migration. Preserve the decisions table and append-only
audit evidence; do not destructively drop previously written business records.

### Known limitations and blocker

- Authenticated browser walkthrough remains pending in an approved isolated
  environment.
- Independent review found one P1 and it was corrected. A separate confirmation
  that the P1 is closed remains required before integration.

### Recommended independent reviewer

A fresh security reviewer other than the implementation author, focused on SQL
authorization, actor provenance, tenant isolation, concurrency/idempotency,
immutability, audit atomicity, and recommendation/decision separation. High or
medium findings must be corrected and re-reviewed before integration.

### Independent-review correction — 2026-09-15

The review identified that `app.is_active_tenant_admin()` alone did not reject
an identity that was also present in `platform_admins`. The database boundary
now requires `not app.is_platform_admin()` in all three relevant places:

1. the `supplier_final_decisions_select` RLS policy;
2. `public.can_record_supplier_final_decision()`;
3. `public.record_supplier_final_decision()` before evaluation lookup.

The SQL suite creates a deliberate dual-role fixture — platform administrator
plus active `tenant_admin` membership in the same tenant — and proves that it
cannot resolve write authority, cannot read the operational decision, and
cannot record one. A source-boundary application test prevents accidental
removal of both explicit write checks. All required checks were rerun after the
correction: 26 TASK-025 SQL assertions, 223 application tests, TypeScript,
build, Vercel output verification, secrets scan, web verification, and
`git diff --check` all passed.

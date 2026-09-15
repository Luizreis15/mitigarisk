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
./scripts/run-local-verification.sh
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

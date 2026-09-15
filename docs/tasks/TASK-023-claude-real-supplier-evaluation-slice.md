# TASK-023 — Claude real supplier evaluation slice

## Objective

Deliver the first real, authenticated, tenant-scoped operational workflow in
MITIGA: a Company user records a fictional supplier, registers fictional
evidence metadata, runs the deterministic evaluation engine against an
immutable published policy, persists the evaluation and reason codes, and
reads the result back from the authenticated workspace.

This is one vertical product slice. It is not a new foundation project and
must end in a browser-demonstrable outcome within 72 hours of implementation
start.

## Human-approved product decisions

The human owner approved on 2026-09-14:

- Claude Code is the primary implementation owner, Cursor is the product
  finisher after integration, and Codex is the merge and release owner.
- Only one operational product slice may be active at a time.
- The first real workflow is supplier evaluation.
- All development and demonstration records must be entirely fictional.
- The initial role matrix is approved in principle.
- The deterministic engine returns only `approve`, `review`, or `reject` as a
  recommendation.
- Only the Company Admin records the final business decision. A recommendation
  must never become a final decision automatically.

For this slice, the existing role keys are authoritative bundles:

- `tenant_admin` represents Company Admin and may create suppliers, run and
  view evaluations, and later record the final case decision.
- `risk_analyst` represents Company Analyst and may create suppliers and run
  or view evaluations, but must not record the final case decision.
- `operator` may view evaluations and manage cases, but must not record the
  final Company decision.
- `auditor` remains read-only.
- `platform_super_admin` governs the platform and receives no implicit access
  to tenant operational supplier or evaluation data.

If the current capability seed contradicts the approved final-decision rule,
add the smallest forward migration that removes `case.decide` from
`risk_analyst`. Do not rename existing role keys or introduce the future
Operator Manager / Operator Analyst role split in this task.

## Business scenario and fictional reference record

Use this fictional record only in local tests, local seed data, or a dedicated
development fixture. Never insert it into production as part of this task.

- Display name: `Atlas Components Ltd.`
- Supplier reference: `SUP-ATLAS-001`
- Registration country: `MT`
- Registration identifier: `C-FICTIONAL-1042`
- Industry: `industrial_components`
- Operating countries: `MT`, `IT`
- Relationship purpose: `Supply of replacement components for operational equipment.`
- Estimated annual exposure: `EUR 240000.00`, represented as `24000000`
  integer minor units plus ISO 4217 currency code `EUR`
- Onboarding channel: `assisted`
- Website domain: `atlas-components.example`
- All names, identifiers, facts, documents, domains, and amounts are fictional.

## Initial supplier fields

Persist only the minimum fields needed by the first evaluation:

- `id`, `tenant_id`, tenant-unique `reference`, `display_name`;
- `relationship_type`, fixed to or validated as `supplier` for this flow;
- `registration_country_code` using ISO 3166-1 alpha-2 semantics;
- `registration_identifier`, treated as country-configured text rather than a
  Brazil-specific document;
- `industry_code` as a stable product code;
- `operating_country_codes` as validated country codes;
- `relationship_purpose`;
- `annual_exposure_minor` and `annual_exposure_currency`;
- `onboarding_channel`;
- optional normalized `website_domain`, never a trusted identity signal;
- `status` with an intentionally small lifecycle (`draft`, `ready`,
  `evaluated`, `archived`);
- verified actor provenance and UTC timestamps.

Do not collect personal documents, phone numbers, personal addresses, bank
credentials, beneficial-owner personal details, or production customer data.

## Initial fictional evidence manifest

For the first slice, evidence is a tenant-scoped metadata manifest. Binary
upload and Supabase Storage are explicitly deferred so the 72-hour workflow is
not blocked by a second security boundary.

Supported evidence types:

- `incorporation_record`;
- `ownership_declaration`;
- `address_confirmation`;
- `bank_account_confirmation`;
- `compliance_questionnaire`.

Each evidence entry stores only:

- tenant and supplier linkage;
- stable evidence type;
- fictional display name;
- issuer country code when applicable;
- declared issue date when applicable;
- verification state (`provided`, `reviewed`, `rejected`);
- SHA-256 test digest of a fictional local fixture or canonical fictional
  declaration, never secret material;
- verified recording actor and UTC timestamps.

No external file, email, provider call, malware scanning claim, or hosted
storage mutation is permitted in this task. The UI must say that evidence files
are not uploaded in this first operational slice.

## Initial policy proposal

Create or reuse one immutable published test policy called
`Supplier onboarding policy`, version `1`. The deterministic score is a
0–100 risk score where a higher score means higher risk.

The normalized numeric factors and weights are:

| Factor key | Weight | Required | Meaning of 0 | Meaning of 100 |
|---|---:|---|---|---|
| `identity_integrity_risk` | 20 | yes | registration and domain facts are consistent | material inconsistency or unverifiable identity |
| `geographic_risk` | 15 | yes | configured low-risk footprint | configured high-risk footprint |
| `ownership_transparency_risk` | 15 | yes | ownership declaration complete and reviewed | ownership information absent or materially opaque |
| `integrity_screening_risk` | 25 | yes | no fictional screening indicators | severe fictional sanctions, PEP, adverse-media, or fraud indicator |
| `financial_exposure_risk` | 10 | yes | exposure at or below the configured floor | exposure at or above the configured ceiling |
| `evidence_quality_risk` | 15 | yes | all required evidence reviewed | evidence materially incomplete or rejected |

All factors must use the existing engine configuration contract with
`min = 0`, `max = 100`, `direction = higher_is_riskier`, and the required flag
above. The adapter derives these bounded numeric facts from the validated
supplier and evidence record. It must not pass arbitrary browser-provided
factor scores directly to the engine.

Initial recommendation thresholds:

- `approve`: score `0 <= x < 35`;
- `review`: score `35 <= x < 70`;
- `reject`: score `70 <= x <= 100` under the engine's existing terminal-bound
  semantics.

The implementation must reuse the engine's existing threshold resolution
rather than inventing alternate inclusive/exclusive behavior.

## In scope

- Add the smallest domain and database model needed for tenant-scoped supplier
  records and fictional evidence manifests.
- Add forward-only local migrations, RLS policies, constraints, indexes, and
  positive/negative SQL tests.
- Pin insert and update actor provenance to `auth.uid()` at the database
  boundary; never trust `created_by`, `updated_by`, or actor identity from a
  browser form.
- Add request-scoped Supabase repositories and server actions for create/read
  supplier, create/read evidence metadata, run evaluation, and read the
  resulting evaluation.
- Reuse `requireAuthenticatedIdentity()`, the server-validated tenant context,
  `resolveAuthorizedTenantContext()`, the published-policy schema, and
  `runEvaluation()`.
- Enforce capabilities server-side. Supplier creation uses the smallest new
  capability if the current schema has no suitable entity capability;
  evaluation execution requires `evaluation.run`; evaluation read requires
  `evaluation.view`.
- Persist one evaluation, normalized input evidence, immutable policy version,
  correlation ID, verified actor, score, recommendation, quality state, and
  reason codes atomically or fail without a partial completed evaluation.
- Make replay behavior explicit. The same tenant and idempotency/correlation
  identifier must return the existing outcome or fail with a stable typed
  conflict, never create a second evaluation silently.
- Connect the real authenticated `/workspace` to a minimal supplier list,
  supplier creation form, evaluation action, and result view. Reuse approved
  design language and externalized English copy.
- Keep existing prototype routes visibly fictional and separate from this real
  workflow.
- Add domain, repository, server-action, component-boundary, and SQL tests.
- Add a manual local/Development browser verification checklist.

## Out of scope

- Final business decision persistence, case workflow, assignment, SLA, notes,
  escalation, or notifications;
- binary evidence upload, Supabase Storage, antivirus processing, OCR, external
  company registries, sanctions providers, adverse-media providers, credit
  bureaus, bank validation, webhooks, background workers, or email;
- real customer or Lucimara data;
- hosted Supabase migration, hosted seed, Vercel configuration, production
  deployment, production test account creation, or secret access;
- converting the existing `/entities`, `/evaluations`, `/cases`, `/policies`,
  Company, Operator, or Super Admin prototype routes into real routes;
- redesigning the approved frontend, broad responsive polish, the Operator role
  split, membership administration, or unrelated audit remediation.

## Allowed files and bounded contexts

- `supabase/migrations/**` for new forward migrations only;
- `supabase/tests/**` and `supabase/seed.sql` only when a local fictional seed is
  necessary;
- `apps/web/app/workspace/**`;
- new real route handlers or server actions under
  `apps/web/app/workspace/suppliers/**` only;
- `apps/web/components/workspace/**`;
- `apps/web/lib/domain/**` for supplier/evaluation adapter contracts only;
- `apps/web/lib/supabase/**` for request-scoped repositories only;
- `apps/web/lib/i18n/**` for externalized workspace copy only;
- `apps/web/tests/**`;
- `docs/adr/**`, `docs/security/**`, and this task file.

Do not modify `apps/web/lib/demo/**` or any existing prototype route.

## Security, tenant, audit, and privacy requirements

- Every supplier, evidence, and evaluation row carries `tenant_id`.
- Identity comes from verified `auth.getUser()` through the existing request
  boundary. Browser claims, role labels, hidden controls, query parameters,
  form tenant IDs, and decoded-but-unverified tokens are not authorization.
- Tenant context is revalidated on every request. RLS is defense in depth, not
  the only control.
- Platform administrators receive no operational bypass through the real
  workspace.
- Cross-tenant supplier IDs, evidence IDs, policy IDs, and evaluation IDs fail
  closed without confirming whether another tenant's record exists.
- `actor_id`, `created_by`, and equivalent provenance are database-pinned to the
  authenticated actor for user-initiated writes.
- The engine remains pure and free of Supabase, storage, network, clock, and
  random-number dependencies.
- A published policy and completed evaluation remain immutable.
- Recommendation and Company Admin decision remain separate fields, concepts,
  permissions, and UI copy. This task does not create the decision field.
- No raw registration identifier, evidence declaration, SQL error, access
  token, cookie, or personal data is placed in logs. Use correlation IDs and
  stable typed error codes.
- No service-role key is requested, read, printed, used, or referenced from
  browser code.

## Acceptance criteria

1. A verified active Company user can create `Atlas Components Ltd.` or an
   equivalent fictional supplier only inside a server-validated active tenant.
2. The supplier persists with country-neutral identifiers, ISO country and
   currency semantics, integer monetary minor units, UTC timestamps, and
   database-pinned actor provenance.
3. Fictional evidence metadata can be recorded and read for that supplier;
   binary upload is absent and clearly disclosed.
4. A user with `evaluation.run` can trigger exactly one deterministic
   evaluation against the same tenant's immutable published supplier policy.
5. The adapter derives bounded factor facts from persisted validated data; the
   browser cannot submit final factor scores, recommendation, actor, tenant,
   policy status, or result fields.
6. The completed evaluation persists score, `approve|review|reject`
   recommendation, data quality, missing required factors, immutable reason
   codes, policy version, normalized input, input hash, correlation ID, and
   verified actor without a partial completed state.
7. Repeating the same operation is idempotent or returns a stable conflict and
   never creates a duplicate completed evaluation.
8. `risk_analyst` cannot record a final case decision; `tenant_admin` remains
   the Company Admin bundle authorized for the future decision flow.
9. No platform administrator, inactive membership, stale tenant selection,
   malformed ID, missing capability, cross-tenant reference, unpublished
   policy, incompatible engine contract, repository failure, or partial write
   produces a successful result or leaks another tenant's data.
10. The authenticated workspace displays the real supplier and evaluation
    result while every existing prototype route remains clearly fictional.
11. A browser demonstration can show: sign in, choose an authorized tenant,
    create the fictional supplier, register evidence metadata, run the
    evaluation, reload the page, and read the same persisted result.
12. All required automated checks pass and the handoff contains exact evidence.

## Required verification

Run and report exact results for:

```text
supabase db reset
supabase test db
cd apps/web && npm test
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npm run build
cd apps/web && npm run verify:vercel
./scripts/check-secrets.sh
./scripts/verify-web.sh
git diff --check
```

Also complete the task's manual browser checklist against local Supabase. A
hosted Development check may be proposed only after Codex integrates and the
human owner separately authorizes the hosted migration. Do not request or read
credentials to complete local verification.

## Execution and handoff

- Create `feat/claude-real-supplier-evaluation-slice` from the latest integrated
  base containing TASK-022 and this contract.
- Use Conventional Commits.
- Keep one branch and one outcome. Do not create companion foundation tasks.
- Send a short progress update when the database boundary passes, when the
  first evaluation persists, and when browser verification passes. Do not wait
  until the end to expose blockers.
- Do not merge, push hosted migrations, deploy, or modify hosted provider
  configuration.
- Append the standard handoff to this file with outcome, base, commits, files,
  decisions, exact checks, browser evidence, tenant/security/privacy/audit
  impact, migration and rollback notes, limitations, and recommended reviewer.
- Recommended reviewer: Codex for migration, actor provenance, authorization,
  idempotency, real/demo separation, and integration readiness. Cursor reviews
  and finishes the visual experience only after Codex integrates the functional
  slice.

## 72-hour proof gate

Within 72 hours of implementation start, the branch must demonstrate a real
tenant-scoped supplier surviving reload and producing a persisted deterministic
evaluation result. If it cannot, stop expanding scope and report the single
blocking condition. Codex will then reduce the implementation stream to one
builder plus merge owner until the slice is stable.

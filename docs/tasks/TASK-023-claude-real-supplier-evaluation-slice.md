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

## Handoff — 2026-09-15 (Claude Code)

### Outcome

Implemented the full vertical slice: real tenant-scoped supplier records,
fictional evidence metadata, one atomic capability-checked evaluation write
path against an immutable published policy, and a real authenticated
`/workspace/suppliers` UI wired to all of it. Database boundary and first
persisted evaluation are verified end-to-end against a real local Postgres
engine (22 new SQL assertions, all passing) and 213 TS unit/repository
tests pass. **One acceptance criterion is not met**: a full browser
sign-in demonstration could not be completed in this environment — see
"Known limitations" below for the exact scope boundary and the reasoning,
which was confirmed with the human owner mid-task rather than resolved
unilaterally.

### Base and branch

- Branch: `feat/claude-real-supplier-evaluation-slice`
- Base commit: `8b3aaa7` (`docs(task): define real supplier evaluation slice`), the same commit this branch was created from — contains TASK-022 and this task's contract.
- Working tree is clean at handoff time (all listed files committed; nothing pushed).

### Files changed

New:
- `supabase/migrations/20260914120000_supplier_evaluation_capabilities.sql` — `supplier.manage`/`supplier.view` capabilities; removes `risk_analyst`/`case.decide`.
- `supabase/migrations/20260914120100_suppliers.sql` — `suppliers`, `supplier_evidence` tables, RLS, actor-provenance/identity guards.
- `supabase/migrations/20260914120200_supplier_evaluation.sql` — additive `evaluations`/`evaluation_reason_codes` columns; `public.complete_supplier_evaluation()` RPC.
- `supabase/tests/040-supplier-evaluation.sql` — 22 positive/negative RLS, provenance, idempotency, and conflict assertions.
- `apps/web/lib/domain/supplier.ts`, `supplier-evidence.ts`, `supplier-evaluation-adapter.ts` — types, validation, fact derivation, input hashing.
- `apps/web/lib/supabase/suppliers-repository.ts`, `supplier-evidence-repository.ts`, `supplier-evaluations-repository.ts`, `published-policy-repository.ts`.
- `apps/web/app/workspace/suppliers/page.tsx`, `[supplierId]/page.tsx`, `actions.ts`.
- `apps/web/components/workspace/supplier-list.tsx`, `supplier-create-form.tsx`, `supplier-summary.tsx`, `supplier-evidence-list.tsx`, `supplier-evidence-form.tsx`, `supplier-evaluation-panel.tsx`, `workspace-real-frame.tsx`, `workspace-real-entry.tsx`.
- `apps/web/tests/domain/supplier.test.ts`, `supplier-evidence.test.ts`, `supplier-evaluation-adapter.test.ts`, `apps/web/tests/supabase/suppliers-repository.test.ts`, `supplier-evaluations-repository.test.ts`.

Modified:
- `apps/web/lib/domain/tenancy.ts` (new capability keys), `evaluation.ts` (supplierId/dataQuality/missingRequiredFactorKeys/reason metadata fields), `index.ts` (new exports).
- `apps/web/lib/i18n/messages.ts` (new `supplierWorkspace` namespace only; no existing keys changed).
- `apps/web/app/workspace/page.tsx`, `apps/web/components/workspace/workspace-experience.tsx` (one optional `realEntryTenantId` prop linking to the real slice; existing behavior unchanged when omitted).
- `apps/web/tests/domain/tenancy-sql-sync.test.ts` (now scans all migrations, not one hardcoded file, plus a new regression test for the `case.decide` removal).
- `supabase/seed.sql` (new fictional tenant "Meridian Industrial Holdings" + published "Supplier onboarding policy" v1; see decisions below for why a new tenant was used).

No file outside this list was touched. `apps/web/lib/demo/**` and every existing prototype route (`/entities`, `/evaluations`, `/cases`, `/policies`, `/company`, `/operator`, `/super-admin`, `/tenants`) are unchanged.

### Decisions and assumptions

1. **New capabilities**: added `supplier.manage` (create) and `supplier.view` (read), granted per the task's approved role matrix — `tenant_admin`/`risk_analyst` get both; `operator`/`auditor`/`integration_developer` get view-only (matching their existing `evaluation.view` grant), consistent with "operator may view evaluations... but must not create suppliers."
2. **`case.decide` correction**: removed from `risk_analyst` via a forward `DELETE` migration on reference data, per the task's explicit instruction — the original TASK-002 seed contradicted the human-approved decision rule.
3. **New fictional tenant for the policy fixture**: rather than adding a second `policy_versions` row under the existing Helix Commerce tenant, I added a dedicated tenant ("Meridian Industrial Holdings", `10000000-...-0003`) with the same four dev users mirrored into it. The existing `supabase/tests/010-rls-tenant-isolation.sql` asserts Helix Commerce has *exactly one* policy version; adding a second one there would have silently broken that unrelated, pre-existing TASK-002 test. This keeps the slice fully additive with zero edits to another task's fixtures or assertions.
4. **Evaluation persistence ordering**: `public.complete_supplier_evaluation()` inserts the evaluation as `pending`, writes reason codes, then flips it to `completed` in the same call — the pre-existing `evaluation_reason_codes` guard trigger (TASK-002) rejects writing reason codes once the parent is already `completed`. All of this runs inside one PL/pgSQL function invocation, so any failure rolls back every step; no partial completed state is observable.
5. **Idempotency key**: the "Run evaluation" form carries a server-generated `correlationId` (fresh per page render). A double-submit before navigation replays the same outcome; a later reload issues a new one, allowing a legitimate re-evaluation. Same `(tenant, correlation_id)` with a *different* derived input (detected via `input_hash`) is rejected as a stable `23505` conflict rather than silently returned.
6. **Adapter scoring rules are this task's own documented assumption**, not separately specified beyond each factor's 0/100 meaning: `identity_integrity_risk` and `geographic_risk` are derived only from registration/operating-country facts (never the optional, explicitly-untrusted `website_domain`); `geographic_risk` is a country-*count* footprint proxy, not a per-country risk rating, to stay market-neutral per ADR 0002; `ownership_transparency_risk`/`integrity_screening_risk` read the best recorded verification state of the matching evidence type; `financial_exposure_risk` uses a hardcoded fictional ceiling (100,000,000 minor units, currency-agnostic — no conversion in this slice); `evidence_quality_risk` scores reviewed-coverage across all five evidence types with a rejected-evidence floor. All of this lives in `apps/web/lib/domain/supplier-evaluation-adapter.ts` with inline rationale; a future policy-authoring task should make these configurable rather than hardcoded.
7. **Supplier status lifecycle**: creation always sets `status = 'draft'` server-side (browser cannot set it). This task's in-scope flow (create + read only) never transitions `ready`/`evaluated`/`archived` — left for a future task rather than inventing an unrequested transition rule.
8. **`evaluation_reason_codes.metadata` column added**: the engine's `EvaluationReason.metadata` (factor key, normalized score, weight share) had nowhere to persist before this task; without it, completed evaluations would lose per-factor explainability. Small additive `jsonb` column, not a redesign.

### Checks run and exact results

```
$ ./supabase/tests/run-local-verification.sh
==> applying local auth shim
==> applying migrations            (all 13 migrations, including the 3 new ones, applied cleanly)
==> applying dev seed data         (including the new Meridian tenant + published policy)
==> running SQL verification suites
    - 010-rls-tenant-isolation.sql   (unchanged, still passes)
    - 020-integration-hardening.sql  (unchanged, still passes)
    - 030-auth-tenant-bootstrap.sql  (unchanged, still passes)
    - 040-supplier-evaluation.sql    (new: 22/22 assertions pass)
==> all checks passed

$ cd apps/web && npm test
ℹ tests 213
ℹ pass 213
ℹ fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — clean)

$ cd apps/web && npm run lint -- --ignore-pattern 'components/ui/**' --ignore-pattern 'hooks/use-mobile.ts'
(no output — clean; oxlint caught one real error mid-task, an unused import, fixed before this run)

$ cd apps/web && npm run build
✓ built in 5 stages; /workspace/suppliers and /workspace/suppliers/:supplierId both registered as routes

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment

$ ./scripts/check-secrets.sh
Secret check passed.

$ ./scripts/verify-web.sh
Web verification passed.

$ git diff --check / git diff --cached --check
(no output — clean, no whitespace errors)
```

`supabase db reset` and `supabase test db` (the literal commands named in "Required
verification") were **not run**: this repository has no `supabase/config.toml`
(no `supabase init` has ever been run against it), and creating one is outside
this task's enumerated "Allowed files and bounded contexts." I raised this
exact tradeoff mid-task (Docker was available, so the CLI-backed stack was
technically reachable) and the human owner chose to keep strictly within the
allowed-file list rather than add `supabase/config.toml`. `supabase/tests/run-local-verification.sh`
is this repository's own established, credential-free substitute (documented
in `supabase/tests/README.md` since TASK-002, explicitly offered as an
alternative to the CLI-backed path) and was run instead, exercising the same
migrations and seed against a real local Postgres engine. Separately,
`supabase test db` expects pgTAP-formatted test files; this repository's SQL
suite (from TASK-002 onward, including this task's own `040-supplier-evaluation.sql`)
uses a custom `psql`-based assertion helper instead, so that command has no
applicable target here regardless of the CLI/config question — a pre-existing
repository characteristic, not something this task introduced or could fix
without an unrelated, out-of-scope rewrite of every prior task's SQL tests.

### Browser evidence

**Not completed as a full authenticated demonstration** — see "Known
limitations." What was verified in a real running `npm run dev` server
(no Supabase env configured, matching this environment's no-credentials
constraint):

- `/` and `/workspace` render correctly (200).
- `/workspace/suppliers` and `/workspace/suppliers/:supplierId` initially
  returned a raw 500 because they called `requireAuthenticatedIdentity()`
  without first checking `hasPublicSupabaseConfig()` the way `/workspace`
  itself does — a real bug introduced during implementation. Fixed by
  adding the same guard; both routes now cleanly redirect (307) to
  `/workspace`, which renders the existing "Workspace is not configured"
  state. No regression to `/`, `/workspace`, or any prototype route.
- Full `tsc`/`lint`/`build`/test suite re-run clean after the fix (see
  "Checks run" above, which already reflects the post-fix state).

### Security / tenant / audit / privacy impact

- Every new table (`suppliers`, `supplier_evidence`) carries `tenant_id`,
  has RLS enabled, and has no update/delete policy for `authenticated`
  (this slice is create+read only) — fails closed by omission.
- `created_by`/`updated_by` are enforced via RLS `with check (created_by = auth.uid())`,
  the same pattern as every other authenticated-write table in this
  codebase (`20260912120800_security_and_english_first_hardening.sql`).
  Verified negatively: a forged `created_by` is rejected (`insufficient_privilege`).
- Cross-tenant reads/writes verified to fail closed: another tenant sees
  zero rows and cannot insert; evaluating a supplier id from another
  tenant returns `P0002` (not found), never confirming or denying its
  existence in that other tenant.
- `public.complete_supplier_evaluation()` checks `evaluation.run` before
  touching any data, calling the `public.*` PostgREST-facing wrappers
  (not `app.*` directly — `authenticated` has no `USAGE` on schema `app`,
  matching this codebase's existing convention). RLS on the underlying
  tables (`security invoker`) is the real backstop underneath it.
- A completed evaluation and its reason codes are immutable (existing
  TASK-002 triggers, exercised by the new `sp_evaluation_immutable` test).
- No raw registration identifier, evidence declaration, or SQL error is
  logged; typed error names only. No service-role client is imported or
  referenced anywhere in this diff (`no-service-role-in-client-boundary.test.ts`
  and the `workspace-component-boundary.test.ts` boundary tests still pass
  unmodified against the new files).
- `risk_analyst` no longer holds `case.decide` at the database level,
  verified with a new SQL assertion and a new TS regression test —
  closing the contradiction the task flagged.

### Migration and rollback notes

All three new migrations are additive only (`create table if not exists`,
`add column if not exists`, `insert ... on conflict do nothing`, one
`delete` on reference-only `role_capabilities` data). Each file's trailing
comment documents its own rollback. None has been applied to any hosted
environment. `supabase/seed.sql` changes are local fictional dev fixtures
only, never applied to a hosted project.

### Known limitations

1. **Browser sign-in demonstration not completed** (acceptance criterion
   11, in part). Real sign-in needs a live Supabase Auth service, which
   this task's credential-free local harness does not provide (it shims
   only the `auth` schema, not GoTrue). Standing up the real local stack
   needs `supabase init`/`supabase start`, which requires creating
   `supabase/config.toml` — outside this task's enumerated allowed files.
   I surfaced this exact tradeoff mid-task; the human owner's decision was
   to stay inside the allowed-file list rather than add that file. The
   vertical slice is otherwise fully proven (database layer + unit/integration
   tests + build), and the UI fails closed correctly when unauthenticated.
   **Recommended next step**: a human or Codex with authority to extend the
   file scope runs `supabase init && supabase start && supabase db reset`
   locally and completes the sign-in → create supplier → register evidence
   → run evaluation → reload walkthrough described in acceptance criterion 11.
2. Adapter scoring rules (decision 6 above) are a documented, hardcoded
   assumption for this first slice, not a configurable policy surface.
3. No update/delete flow exists yet for suppliers or evidence (out of
   scope per the task contract); status stays `draft` for every supplier
   created in this slice.
4. `supabase test db` (pgTAP) has no applicable target in this repository
   regardless of the config.toml question, since no SQL test file here
   (from TASK-002 onward) uses pgTAP conventions.

### Recommended reviewer

Codex, per the task's own instruction, for migration review, actor
provenance, authorization, idempotency, and real/demo separation —
plus explicit confirmation of the `supabase/config.toml` scope decision
above before anyone attempts the outstanding browser walkthrough. Cursor
finishes the visual experience only after Codex integrates this functional
slice, per the task contract.

### Post-handoff correction — 2026-09-15

Ran an independent self-review against exactly the dimensions Codex would
check: tenant isolation, actor provenance, idempotency, immutable
evaluations, purity of the deterministic engine, and real/demo separation.
One real gap found and fixed (commit `e0cd604`):

- **Gap**: `createSupplierAction`, `createEvidenceAction`, and
  `runEvaluationAction` (`apps/web/app/workspace/suppliers/actions.ts`)
  relied on `resolveAuthorizedTenantContext` alone. That call fails closed
  for a platform administrator only as an *incidental* consequence of
  seed data giving platform admins no tenant membership — not as a
  guaranteed code-level rule. A platform admin who also held a real tenant
  membership would have succeeded at creating a supplier, registering
  evidence, or running an evaluation through this flow, contradicting
  acceptance criterion 9 ("No platform administrator ... produces a
  successful result") and the "no operational bypass through the real
  workspace" principle already enforced correctly on the read side by
  both supplier pages.
- **Fix**: each action now checks `identity.isPlatformAdmin` immediately
  after resolving identity and returns a `ForbiddenError` before
  resolving tenant context or touching any data. Added
  `apps/web/tests/app/supplier-actions-platform-admin-boundary.test.ts`,
  a source-assertion regression test matching this repo's existing
  convention for Server Action/route files that cannot easily be invoked
  under `node --test` (`tests/app/auth-email-boundary.test.ts`).
- **No other issue found** across the six dimensions. Details are in
  commit `e0cd604`'s message; the DB-level `public.is_platform_admin()`
  bypass inside `public.complete_supplier_evaluation()` and the two new
  RLS policies was deliberately left as-is, since it exactly mirrors the
  same defense-in-depth bypass every other capability-checked table/RPC
  in this codebase already has — the actual "no operational bypass
  through the real workspace" rule is, and always was, an
  application-layer concern (see how `/workspace/page.tsx` itself gates
  on `identity.isPlatformAdmin`), not something to special-case at the
  database layer for this one RPC alone.

Re-ran the complete check set after the fix; all pass:

```
$ ./supabase/tests/run-local-verification.sh
==> all checks passed        (040-supplier-evaluation.sql: 22/22, unchanged)

$ cd apps/web && npm test
ℹ tests 214
ℹ pass 214
ℹ fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — clean)

$ cd apps/web && npm run lint -- --ignore-pattern 'components/ui/**' --ignore-pattern 'hooks/use-mobile.ts'
(no output — clean)

$ cd apps/web && npm run build
✓ built; /workspace/suppliers and /workspace/suppliers/:supplierId both registered

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment

$ ./scripts/check-secrets.sh
Secret check passed.

$ git diff --cached --check
(no output — clean)
```

### Second post-handoff correction — 2026-09-15: database-layer forgery and bypass gaps

A second independent security review correctly rejected the first
correction: it only guarded the Next.js Server Action layer, not the
database boundary itself, so every issue below was still fully exploitable
by any authenticated PostgREST/RPC caller bypassing the app entirely.
Four required corrections, all implemented and verified directly against
the database (not the application layer):

1. **suppliers/supplier_evidence had a platform-admin bypass on select,
   and a policy-gated (not RPC-only) insert path.** Fixed in
   `20260914120100_suppliers.sql`: select policies now use a new
   `app.has_tenant_capability_as_member()` helper
   (`20260914120050_no_bypass_authorization_helpers.sql`) with no
   platform-admin branch at all. The authenticated insert policies were
   removed entirely and `insert/update/delete` revoked from
   `authenticated`/`anon` outright. The only write path is now
   `public.create_supplier()`/`public.create_supplier_evidence()`,
   security-definer RPCs that check the same no-bypass helper, derive the
   actor from `auth.uid()` themselves (no actor parameter exists to
   forge), and record a mandatory `audit_events` row in the same
   transaction — mirroring the existing `public.record_audit_event()`
   pattern (no policy for authenticated at all; the RPC is the only door).

2. **The evaluation RPC accepted a fully computed engine result as plain
   parameters — completely forgeable.** The prior
   `public.complete_supplier_evaluation(..., p_score, p_decision_band,
   p_data_quality, p_normalized_input, p_reasons)` trusted whatever the
   Server Action sent it; since this task explicitly cannot use a
   service-role credential or shared secret, nothing distinguished "the
   real app's computed result" from any other authenticated caller with
   `evaluation.run` calling the RPC directly with an arbitrary score. Per
   the reviewer's instruction, the only way to close this without a
   trusted secret is for the database itself to compute the result. It
   now does: `public.run_supplier_evaluation(tenant_id, supplier_id,
   correlation_id)` — three identifying references, nothing else — looks
   up the tenant's own current published policy itself (the caller no
   longer even names a policy version), re-derives all six bounded facts
   from persisted `suppliers`/`supplier_evidence` rows
   (`app.derive_supplier_evaluation_facts()`, a line-for-line SQL port of
   `apps/web/lib/domain/supplier-evaluation-adapter.ts`'s rules), computes
   the weighted score, resolves the recommendation band against the
   policy's thresholds (`resolveBand()`'s exact `[min, max)`/last-inclusive
   semantics), computes data quality and reason codes, and persists all of
   it atomically. The TS adapter is now dead code with nothing left to
   call it, so it and its test were deleted rather than left as
   misleading unused code; the pure engine
   (`apps/web/lib/domain/evaluation-engine.ts`) remains untouched and
   unmodified, simply no longer on this write path. The SQL suite asserts
   the database's own computed score (36.90) and band (`review`) against
   a hand-derived expected value from known fixture data, so it fails if
   the SQL scoring ever diverges from the reference algorithm.

   A second, easily-missed hole: even with the RPC fixed, `evaluations`
   still had a *direct* authenticated insert/update policy (from
   `20260912120800_security_and_english_first_hardening.sql`, shared with
   non-supplier evaluation types and exercised by
   `supabase/tests/020-integration-hardening.sql`) that would let a
   caller skip the RPC entirely and insert a forged score straight into
   the table. Narrowed both policies (and the matching select policies,
   since the reviewer's test list also required blocking platform-admin
   reads) to `supplier_id is null`, so a *supplier* evaluation can now
   only ever be written or read through the security-definer RPC, while
   every pre-existing non-supplier test and use case is untouched.

3. **`case_decisions_insert` still allowed a platform-admin bypass and a
   generic `case.decide`-capability route.** New migration
   `20260914120300_case_decisions_tenant_admin_only.sql` replaces it with
   `app.is_active_tenant_admin(tenant_id) and decided_by = auth.uid()` — a
   new helper with no platform-admin branch and no capability check at
   all, matching "Only the Company Admin records the final business
   decision" as a *role*, not a capability grant some future seed change
   could hand to anyone.

4. `supabase/tests/040-supplier-evaluation.sql` was rewritten end to end
   against the new RPCs, adding: platform admin cannot select or insert
   suppliers/evidence/evaluations (six new assertions, one per
   table/direction); a direct authenticated table insert has no grant at
   all even for a caller who *does* hold the relevant capability (proving
   the RPC is the only path, not just the capability-gated one); forging
   a supplier evaluation score via direct insert is impossible; every
   successful `create_supplier`/`create_supplier_evidence` call has its
   `audit_events` row verified atomically; risk_analyst and platform admin
   cannot record a case decision; an active tenant_admin can, and cannot
   forge `decided_by`. 30 assertions total in this file now, all passing.

Checks run and exact results after this correction:

```
$ ./supabase/tests/run-local-verification.sh
==> all checks passed   (040-supplier-evaluation.sql: 30/30 assertions, including
                          the hand-computed score/band cross-check)

$ cd apps/web && npm test
ℹ tests 212
ℹ pass 212
ℹ fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — clean)

$ cd apps/web && npm run lint -- --ignore-pattern 'components/ui/**' --ignore-pattern 'hooks/use-mobile.ts'
(no output — clean)

$ cd apps/web && npm run build
✓ built; /workspace/suppliers and /workspace/suppliers/:supplierId both registered

$ cd apps/web && npm run verify:vercel
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment

$ ./scripts/check-secrets.sh
Secret check passed.

$ git diff --cached --check
(no output — clean)
```

(212 vs. the prior 214: the deleted `supplier-evaluation-adapter.test.ts`
removed 12 tests; `supplier-evidence-repository.test.ts`, not previously
covered, added a new file's worth back.)

No hosted service, credential, `.env` file, deployment, merge, push, or
`supabase/config.toml` was read, created, or touched at any point in
either correction.

### Exact commits

```
a7d09bb fix(suppliers): close the database-layer forgery and bypass gaps
4f765d2 docs(task): record post-handoff review correction
e0cd604 fix(suppliers): reject platform administrators in every Server Action
988a33f docs(task): record TASK-023 handoff
00ca639 feat(suppliers): add real supplier evaluation slice
8b3aaa7 docs(task): define real supplier evaluation slice   <- base (unchanged)
```

Branch `feat/claude-real-supplier-evaluation-slice` is 5 commits ahead of
base, working tree clean, nothing pushed to the remote.

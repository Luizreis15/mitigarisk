# TASK-034 — Apply Lucimara's decisions and expose the assessment form (backend)

Owner: Claude Code · Reviewer: orchestrator (Claude, Cowork) · Approver/merge: Edu
Status: **Approved — 6 Oct 2026 (Edu)**
Branch: `feat/cra-lucimara-decisions`, created from `feat/customer-assessment` (PR #5, not merged yet). Once #3, #4 and #5 are merged, rebase onto `origin/main`.

## Objective

Make the CRA engine, the seed and the tests match the compliance lead's answers from Oct 2026 (Q1–Q5, Q7). Make the demo tenant usable locally end to end. Give the UI a safe way to know which facts an assessment needs.

Backend and docs only. TASK-035 (Cursor) builds the customer UI in parallel and consumes the RPC defined here.

## Inputs

- `docs/orquestracao/LUCIMARA-Q1-Q8-ANSWERS-2026-10.md`: the answers and their impact. Copy it to `docs/product/decisions/LUCIMARA-Q1-Q8-ANSWERS-2026-10.md`.
- `docs/produto/03-CRA-and-Due-Diligence-Policy-Template-v1.md` and `docs/produto/02-Product-Direction-and-MVP-25.md`: already updated by the orchestrator.
- The worktree already contains **uncommitted orchestrator edits** to:
  - `apps/web/tests/fixtures/cra-casebook-v1.json` and `cra-template-v1-draft.json`;
  - `docs/product/PRODUCT-DIRECTION-MVP-25.md`;
  - `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md`.

  They are part of this task. Review them and commit them. Right now they make 2 unit tests fail, because `seed.sql` and `090-cra-engine-v2.sql` still embed the old JSON.
- Decisions that are **still open** (do not block):
  - Q6 (high-net-worth individual): keep `OVR_HNWI`, marked provisional;
  - Q8 (mandatory fields): keep the current strict intake rule from TASK-033.

## In scope

1. **Approvals (Q7).** The Board is no longer an automatic approval: MLRO is mandatory for EDD, and the Board only signs off when the MLRO escalates.
   - The template now has `OVR_PEP.approvals = ["MLRO"]` and `HIGH.approvals = ["MLRO"]`. The casebook `approvals_required` no longer contains `BOARD`.
   - Re-embed the template in `supabase/seed.sql` and the casebook in `supabase/tests/090-cra-engine-v2.sql`, byte-identical to the fixtures. The existing unit tests enforce this.
   - Keep `BOARD` as an allowed approval value in the publish validator; the future escalation flow needs it.
   - All 24 casebook cases must still pass in SQL, TypeScript and the TASK-033 replay suite (`100`).
2. **Provisional override (Q6).** `OVR_HNWI` carries `"status": "provisional_pending_Q6"` in the template JSON. Confirm that the seed loader and the publish validator ignore unknown keys. If either one does not, stop and report it. Do not change the evaluator for this.
3. **Naming (Q2).** Replace every reference to "C2D" and "Project Now" in tracked docs (`rg -il "c2d|project now"`, excluding the lockfile) with MITIGA wording. Rename the template to "MITIGA EU Payments & Gaming CRA". The seed's policy `label` follows the same name.
4. **Local demo policy published (dev seed only).** Today the demo tenant's `cra_v2` policy is DRAFT, so `run_customer_assessment` returns `P0003` locally and the UI has nothing to assess.
   - In `seed.sql`, publish the demo tenant's Template v1, still labelled as a demo, so the local stack and Vercel previews work end to end.
   - **Never apply `seed.sql` to hosted Supabase.**
   - The suite-100 `P0003` negative uses Meridian; confirm it still holds. Adjust any affected assertion and justify it in writing.
5. **Assessment form RPC.** The operator role has no `policy.view` and must not get it. Add a migration with `public.get_customer_assessment_form(p_tenant_id uuid) returns jsonb`:
   - security definer, fixed `search_path`;
   - requires `assessment.run` through `app.has_tenant_capability_as_member` (D1/D2 apply);
   - reads the tenant's latest published `cra_v2` version, and raises `P0003` if there is none;
   - returns **only** what the form needs, with **no weights and no points** (this prevents gaming the score):

   ```json
   {
     "policy_version_id": "uuid",
     "policy_label": "MITIGA EU Payments & Gaming CRA",
     "categories": [
       { "key": "customer_profile", "position": 1,
         "factors": [ { "key": "occupation", "position": 1, "values": ["employed", "self_employed", "..."] } ] }
     ],
     "overrides": [
       { "fact_key": "pep_status", "values": ["confirmed", "self_declared", "none"], "negative_value": "none", "provisional": false }
     ]
   }
   ```

   - Factor `values` are the keys of each factor's points map, in a stable order.
   - Override `values` and `negative_value` follow **exactly** TASK-033's fact-schema derivation rule, so the form and `run_customer_assessment` can never disagree.
   - `provisional` is true when the template marks the override as provisional.
   - The audit trail is not needed (read-only).
   - Grant `execute` to `authenticated` only.
6. **Server-side TypeScript.** Add `getCustomerAssessmentForm(client, tenantId)` to `lib/supabase/customer-assessments-repository.ts`, with a typed `CustomerAssessmentForm` domain type and the same SQLSTATE→typed error mapping. Add unit tests.
7. **SQL test `supabase/tests/110-assessment-form.sql`:**
   - the shape and exact content for the seeded demo policy;
   - no `weight` or `points` key anywhere in the output;
   - every override's `values` equals the set that `run_customer_assessment` accepts (prove it by submitting every listed value successfully and one unlisted value rejected with 22023);
   - authorization for every role: auditor denied, D1 platform admin denied, D2 suspended tenant denied, an outsider denied, and a tenant with no published policy gets `P0003`.

## Out of scope

- Tenant policy authoring: customisable weights (Q1) and tenant-scored lists (Q3) are planned for TASK-036.
- The approval chain and Board escalation.
- Trigger rules, the UI, the HTTP API and hosted services.

## Acceptance criteria

1. The casebook passes 24/24 in suites 090 and 100 and in the TypeScript tests, with `BOARD` absent from every expected result.
2. No tracked doc mentions C2D or Project Now.
3. On a fresh local reset, `run_customer_assessment` on a seeded demo customer succeeds.
4. Suite 110 passes. Suites 010–100 pass, and any change to them is justified in writing.
5. Full gates pass with exit codes preserved (SQL, npm ci, test, tsc, lint, build, the Vercel build/verify, secrets, diff).

## Rules

- Forward-only migration; do not edit earlier migrations.
- No `.env`, no hosted services, no push or merge.
- Conventional Commits in English. You are the author, not the reviewer.
- Stop and report any conflict with ADR 0012, the casebook or Lucimara's answers.

## Expected handoff

The standard template, plus:
- the RPC signature and an example output for the demo tenant;
- per-suite counts;
- the casebook result;
- the list of files where C2D/Project Now was replaced;
- the SHA.

## Handoff

**Outcome:** Implemented. Template v1, the dev seed and every CRA test now match Lucimara's Oct 2026 answers: MLRO-only approvals for `OVR_PEP` and the HIGH band (no automatic `BOARD`, Q7), `OVR_HNWI` marked provisional (Q6), and MITIGA naming everywhere (Q2). The demo tenant's `cra_v2` policy is published in the dev seed and `run_customer_assessment` succeeds on a seeded demo customer after a fresh reset. The UI now has a safe read path, `public.get_customer_assessment_form()`, that returns the facts and allowed values with no weights and no points. Its override values come from the same SQL helper that `run_customer_assessment` validates against, so the form and the assessment cannot disagree. Backend and docs only.

**Branch and commits:** `feat/cra-lucimara-decisions`, created from `feat/customer-assessment` (PR #5, not merged yet).

```text
feaeb16 docs(task): add TASK-034 contract
c335161 docs(product): record Lucimara's Oct 2026 CRA decisions and MITIGA naming
c2e7060 feat(cra): apply Lucimara Q6/Q7 to Template v1 and rename the demo policy
8975372 feat(cra): add the customer assessment form RPC
0cd5885 test(cra): add the assessment form SQL suite
c34a1de feat(cra): add getCustomerAssessmentForm server-side repository call
```
The next commit records this handoff; the branch tip at delivery is reported in the reply (a commit cannot contain its own hash).

**Files changed:**
- `apps/web/tests/fixtures/cra-template-v1-draft.json`, `cra-casebook-v1.json`: the orchestrator's edits, reviewed and committed unchanged (`OVR_PEP`/HIGH approvals `["MLRO"]`, `OVR_HNWI` `"status": "provisional_pending_Q6"`, new `status_note`; 12 casebook cases lose `BOARD` from `approvals_required`, and the file gains a trailing newline).
- `supabase/seed.sql`: Template v1 re-embedded byte-for-byte; policy label `MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)`; the override loader also sets the new `provisional` column.
- `supabase/tests/090-cra-engine-v2.sql`: casebook re-embedded byte-for-byte; label assertion updated; one new assertion (`BOARD` still allowed at publish).
- `supabase/tests/100-customer-assessment.sql`: casebook re-embedded byte-for-byte (no assertion changed).
- `supabase/migrations/20261006100000_customer_assessment_form.sql` (new).
- `supabase/tests/110-assessment-form.sql` (new, 45 assertions).
- `apps/web/lib/domain/customer-assessment.ts` (+`CustomerAssessmentForm` and its parts), `apps/web/lib/supabase/customer-assessments-repository.ts` (+`getCustomerAssessmentForm`), `apps/web/tests/supabase/customer-assessments-repository.test.ts` (+7 tests).
- `docs/product/decisions/LUCIMARA-Q1-Q8-ANSWERS-2026-10.md` (copied in), `docs/product/PRODUCT-DIRECTION-MVP-25.md`, `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md` (orchestrator edits plus the naming fixes below).

No dependency or lockfile change. No UI, no HTTP API. Hosted Supabase untouched.

### RPC signature

```sql
public.get_customer_assessment_form(p_tenant_id uuid) returns jsonb
-- security definer, search_path = public, pg_temp; read-only (no audit event).
-- 42501 unless app.has_tenant_capability_as_member(p_tenant_id, 'assessment.run')
--   (so D1 platform admins and D2 suspended tenants are denied);
-- P0003 if the tenant has no published cra_v2 version;
-- execute granted to authenticated only (revoked from public and anon).
```

Content rules:
- `categories`: `key`, `label`, `position`, ordered by position. Each category has `factors` (`key`, `position`, `values`), also ordered by position. A factor's `values` are its points-map keys, sorted by byte order (`collate "C"`), so the order does not reveal the points.
- `overrides`: one entry per distinct `fact_key`, ordered by the fact's first override position. `values` and `negative_value` come from `app.cra_override_allowed_values()` / `app.cra_override_negative_value()`, which is TASK-033's rule extracted unchanged: the union of `match_values` across every override that shares the fact key, plus the negative value. The negative value is `false` if any match value is a JSON boolean, `"none"` otherwise. `provisional` is true if any override for that fact is marked provisional.
- Never included: weights, points, effects, actions, approvals, override codes, bands, `missing_factor_points`. Suite 110 checks this against a whitelist of keys.

Example output for the demo tenant (fresh local reset, any `assessment.run` member; suite 110 asserts this exact document):

```json
{
  "policy_version_id": "20000000-0000-0000-0000-000000000020",
  "policy_label": "MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)",
  "categories": [
    {"key": "customer", "label": "Customer", "position": 1, "factors": [
      {"key": "purpose", "position": 1, "values": ["ecommerce", "gambling", "multipurpose"]},
      {"key": "employment_status", "position": 2, "values": ["employed", "retired", "self_employed", "student", "unemployed"]},
      {"key": "occupation_risk", "position": 3, "values": ["cash_intensive", "high_risk", "standard"]},
      {"key": "adverse_media_non_material", "position": 4, "values": ["multiple", "none", "single"]},
      {"key": "prior_str", "position": 5, "values": ["none", "one_or_more"]}]},
    {"key": "geography", "label": "Geography", "position": 2, "factors": [
      {"key": "residence_country_risk", "position": 1, "values": ["high_risk_third_country", "higher", "standard"]},
      {"key": "nationality_risk", "position": 2, "values": ["high_risk_third_country", "higher", "standard"]},
      {"key": "sow_country_risk", "position": 3, "values": ["high_risk_third_country", "higher", "standard"]}]},
    {"key": "product_payment", "label": "Product / Service / Payment", "position": 3, "factors": [
      {"key": "payment_method", "position": 1, "values": ["bank_transfer", "card", "cash"]},
      {"key": "product_type", "position": 2, "values": ["closed_loop", "open_loop"]}]},
    {"key": "channel", "label": "Delivery channel", "position": 4, "factors": [
      {"key": "channel", "position": 1, "values": ["face_to_face", "non_face_to_face"]}]},
    {"key": "transactions", "label": "Transactions", "position": 5, "factors": [
      {"key": "affordability", "position": 1, "values": ["above_limit", "near_limit", "not_observed", "within"]},
      {"key": "behaviour_change", "position": 2, "values": ["moderate", "none", "not_observed", "significant"]},
      {"key": "high_value_transactions", "position": 3, "values": ["no", "not_observed", "yes"]}]}
  ],
  "overrides": [
    {"fact_key": "sanctions_match", "values": ["confirmed", "inconclusive", "none"], "negative_value": "none", "provisional": false},
    {"fact_key": "blacklisted_country_link", "values": [true, false], "negative_value": false, "provisional": false},
    {"fact_key": "pep_status", "values": ["confirmed", "self_declared", "none"], "negative_value": "none", "provisional": false},
    {"fact_key": "adverse_media_material", "values": ["material", "potential", "none"], "negative_value": "none", "provisional": false},
    {"fact_key": "hnwi", "values": [true, false], "negative_value": false, "provisional": true}
  ]
}
```

TypeScript: `getCustomerAssessmentForm(client, tenantId): Promise<CustomerAssessmentForm>` (camelCase: `policyVersionId`, `policyLabel`, `categories[].factors[]`, `overrides[].factKey/values/negativeValue/provisional`). `P0003` maps to `NoPublishedCraPolicyError`, `42501` to `ForbiddenError("assessment.run")`, and anything else to `CustomerAssessmentReadError`. A payload that does not match the documented shape is rejected with `CustomerAssessmentReadError`. Only documented fields are copied, so an unexpected `weight`/`points` key could never reach the UI.

### Per-suite SQL counts

`./supabase/tests/run-local-verification.sh`: **SQL=0**.

| Suite | Assertions | Failures |
|---|---:|---:|
| 010–080 | 16/21/18/43/26/28/40/26 (unchanged) | 0 |
| 090-cra-engine-v2 | 121 (120 + 1 new) | 0 |
| 100-customer-assessment | 71 (unchanged) | 0 |
| 110-assessment-form (new) | 45 | 0 |
| **Total** | **455** | **0** |

110 covers:
- grants: authenticated only; helpers not callable; both functions use the shared helper (3);
- the operator has no `policy.view` yet gets the form, and the form is deterministic (2);
- exact content for the demo policy (1), factor values equal the points-map keys for all 14 factors (1), each override fact listed once (1);
- no weight/points, whitelisted keys only, and no scoring key names in the serialized form (3);
- a demo customer assessed from a facts document built only from the form (1); each of the 13 listed override values accepted (13), each fact's unlisted value rejected with 22023 and nothing stored (5), each listed fact required (absent gives 22023) (5), accepted-count check (1);
- authorization: tenant_admin and risk_analyst allowed, auditor, outsider, D1 dual-role, D1 with no membership, D2 suspended and anon denied, Meridian `P0003` (9).

### Casebook result

**24/24** in all three places, with `BOARD` absent from every expected result: `app.evaluate_cra` (suite 090), `run_customer_assessment` with the exact persisted result (suite 100), and the TypeScript mirror (`npm test`). The byte-for-byte drift guards for `seed.sql` and `090` pass again (they were the 2 failing unit tests).

### C2D / Project Now replaced

- `docs/product/PRODUCT-DIRECTION-MVP-25.md`: template name "MITIGA EU Payments & Gaming CRA" and "MITIGA gambling-industry default" (orchestrator edits), plus the inputs line "Project Now Ruleset" changed to "gambling-industry transaction trigger ruleset".
- `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md`: source line, §3.1, §6 and §8 (orchestrator edits), plus the product-facing name set to "MITIGA EU Payments & Gaming CRA".

`git ls-files | xargs rg -il "c2d|project now"` (excluding `package-lock.json`) now matches only:
- this contract, whose instructions quote the two terms (left verbatim);
- two PNGs (`apps/web/public/prototype/company-desktop.png`, `docs/design/11-operador.png`), where the match is random bytes in compressed image data, not text.

No other code or seed file mentioned either term.

### Checks and exact results (Node v24.11.1, npm 11.6.2)

| Check | Result |
|---|---|
| `./supabase/tests/run-local-verification.sh` | **SQL=0** (455 assertions) |
| `npm ci` | **CI=0** |
| `npm test` | **TEST=0**: 292 passed (285 + 7 new), 0 failed |
| `npx tsc --noEmit -p tsconfig.json` | **TSC=0** |
| `npm run lint` | **LINT=0** |
| `npm run build` | **BUILD=0** |
| `npm run build:vercel && npm run verify:vercel` | **VERCEL=0**: genuine Vercel Build Output API v3 |
| `./scripts/check-secrets.sh` | **SECRETS=0** |
| `git diff --check` | **DIFF=0** |

### Decisions and deviations, justified in writing

- **The demo policy was already published.** The contract says the demo tenant's `cra_v2` policy is DRAFT. In fact, since TASK-032 the seed has set it to `status = 'published'`; only its label said "v1 DRAFT". No publish change was needed. The label is now `MITIGA EU Payments & Gaming CRA — v1 DRAFT (demo)`: MITIGA name, still a demo, and still DRAFT because Q6/Q8 are open. Suite 110 proves that a fresh reset assesses a seeded demo customer successfully.
- **Suite 100's `P0003` negative still holds unchanged.** It uses Meridian, which has only a `weighted_v1` policy. No assertion in 100 changed; only the embedded casebook bytes did.
- **Suite 090 changed in two places:**
  - its seed-label assertion follows the new label (required by Q2);
  - one new positive assertion proves `BOARD` is still accepted by the publish validator on both a band and an override (required by in-scope item 1).
- **New column `public.policy_overrides.provisional boolean not null default false`.** The template's `"status"` key was never stored: the seed loader names only the keys it maps, and the publish validator reads table columns only. Both therefore ignore unknown keys (confirmed, so no stop). Without storage, the form could not report `provisional`. The seed loader now sets the flag when the override's `status` starts with `"provisional"`. `app.evaluate_cra` and the publish validator are unchanged and do not read it. Adding a column fires no row trigger, so published versions are not mutated.
- **One shared derivation.** `public.run_customer_assessment` is redefined (`create or replace`) in the new migration with the same body. The only difference is that the inline allowed-values expression now calls `app.cra_override_allowed_values()`, which the form also uses. All of suite 100 still passes unchanged, which shows the behavior is identical. The earlier migration was not edited.
- **Category `label` is included** in the form beyond the contract's example shape. It does not affect scoring and the UI needs it for section titles. Factors have no label column, so none is returned.
- **Factor values are sorted by byte order, not by points,** so the order does not reveal relative risk.

**Security/tenant/audit impact:**
- The new RPC is read-only and tenant-scoped. It checks `assessment.run` through `app.has_tenant_capability_as_member` (D1/D2 apply) and is not executable by `anon`. It returns no weights, points, effects, actions, approvals or codes; suite 110 checks this with a key whitelist.
- The operator still has no `policy.view` (verified in 110).
- The helpers are not executable by `authenticated`/`anon`.
- No capability, RLS policy or grant on any existing table changed. No secret, `.env` or hosted service was touched.

**Migration and rollback:** forward-only. Rollback steps are in the migration's trailing comment: drop the RPC, re-apply `run_customer_assessment` from `20260927100000_customer_assessment.sql`, drop the two helpers, drop the `provisional` column.

**Known limitations:**
- Q6 (HNWI) and Q8 (mandatory intake fields) are still open. `OVR_HNWI` is still evaluated (marked provisional), and the strict TASK-033 intake rule is unchanged.
- Tenant weight customisation (Q1) and tenant-scored lists (Q3) are TASK-036.
- The form returns the latest published version. A UI that holds a form across a policy publish could submit against a newer version, and `run_customer_assessment` would then validate against the newer schema, failing closed with 22023 if the values differ.
- `supabase/tests/README.md` still lists only the original suites (it was already behind before this task).

**Recommended reviewer:** the orchestrator (Claude, Cowork).

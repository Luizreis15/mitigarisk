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

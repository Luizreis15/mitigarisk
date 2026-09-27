# TASK-033 — Customer subject and persisted CRA assessment (backend)

Owner: Claude Code · Reviewer: orchestrator (Claude, Cowork) · Approver/merge: Edu
Status: **Approved — 27 Sep 2026 (Edu)**
Branch: `feat/customer-assessment`, created from `feat/cra-engine-v2`. Once 030 and 032 are merged, it is created from `origin/main` instead.

## Objective

Add the customer as the assessed subject and a trusted, persisted, audited CRA assessment. It uses the TASK-032 evaluator and follows the supplier slice patterns: security-definer RPCs with explicit authorization, atomic audit, immutable evidence and idempotency. This task is backend only. The UI comes in a later Cursor task.

## Inputs

- ADR 0012, the product direction, the CRA template doc and TASK-032 (`app.evaluate_cra`).
- `docs/reviews/REVIEW-TASK-032.md` (copy it from `/Users/samiragouvea/Desktop/Mitiga/docs/orquestracao/REVIEW-TASK-032.md`): the fail-open finding that this task must close.
- The reference pattern: `create_supplier`, `run_supplier_evaluation` and `record_supplier_final_decision`.

## In scope

1. **Capabilities** (migration): `customer.view`, `customer.manage` and `assessment.run`, granted as follows:
   - tenant_admin: all three;
   - risk_analyst: all three;
   - operator: view + manage + run (1st line submits and assesses, per the product direction);
   - auditor: view only.

   Every check uses `app.has_tenant_capability_as_member`, which already applies D1/D2.
2. **`public.customers`** (tenant-scoped, minimal personal data, synthetic data only in the repo):
   - `external_reference`, unique per tenant;
   - `full_name`;
   - `date_of_birth`;
   - `country_of_birth`, `nationality`, `residence_country` (ISO 3166-1 alpha-2);
   - `onboarding_channel` ∈ {face_to_face, non_face_to_face};
   - `status`;
   - audit columns.

   RLS allows select with `customer.view`. There is **no** direct write grant. Writes only go through the `public.create_customer(...)` RPC, which is security definer, checks `customer.manage`, pins created_by to `auth.uid()`, writes an atomic audit event `customer.created` and is idempotent on `(tenant, external_reference)`.
3. **`public.customer_assessments`** (append-only, immutable):
   - tenant, customer_id, policy_version_id;
   - `facts jsonb` (the validated input snapshot);
   - `result jsonb` (the exact `app.evaluate_cra` output);
   - denormalised overall_score, band, dd_level, outcome;
   - `next_review_due` (date = assessed_at + review_months);
   - correlation_id, unique per tenant;
   - input_hash, assessed_by, assessed_at.

   RLS allows select with `customer.view`. There is no direct write grant, and an update/delete trigger blocks mutation.
4. **`public.run_customer_assessment(p_tenant_id, p_customer_id, p_facts jsonb, p_correlation_id)`**, security definer, fixed search_path:
   - requires `assessment.run`;
   - the customer must belong to the tenant, otherwise P0002 with no disclosure;
   - selects the tenant's latest **published `cra_v2`** version, otherwise P0003;
   - **strict intake validation (closes the REVIEW-032 finding).** Build the allowed fact schema from the published policy:
     - factor keys → allowed values = the keys of their points map;
     - override fact keys → allowed values = the union of their `match_values`, **plus the explicit negative value**: `"none"` for the string overrides and `false` for the boolean ones. Derive the negative value from the template JSON convention, and state the rule in the handoff.
     - Reject with **22023** and store nothing when: an unknown key is present; a value has the wrong JSON type; a value is not allowed; or an **override fact is absent or null** (screening results must be explicit).
     - Factor facts may be absent or null. The evaluator then applies the missing-data semantics.
   - calls `app.evaluate_cra`; persists the assessment and writes the audit event `customer.assessed` (metadata: band, dd_level, outcome, overrides_hit, policy_version_id; **no personal data**) atomically;
   - idempotent: the same correlation id with the same input hash returns the existing row, a different hash raises 23505; takes an advisory lock like TASK-026.
5. **Seed:** the demo tenant gets fictional members (a tenant_admin and an operator), the same pattern as the other seed users, plus 3 fictional customers. **Nothing in the hosted database.**
6. **Server-side TypeScript:** domain types, `lib/supabase/customers-repository.ts` and `customer-assessments-repository.ts` (thin RPC callers with SQLSTATE→typed error mapping), and unit tests. No UI.
7. **SQL test `supabase/tests/100-customer-assessment.sql`:**
   - **all 24 casebook cases replayed through `run_customer_assessment`**, with the persisted `result` equal to the casebook `expected`. The casebook facts already include every override fact explicitly; if any case does not, report it;
   - strict validation negatives: an unknown key; `"hnwi":"true"`; `"pep_status":"Confirmed"`; `"sanctions_match":1`; a missing override fact; a null override fact. Each must give 22023 and zero rows;
   - authorization: all roles (positive and negative); D1 dual-role and platform admin with no membership denied; D2 suspended tenant denied; cross-tenant customer gives P0002;
   - immutability (update/delete blocked), idempotency (replay and conflict), audit atomicity, and an audit metadata check (no name or date of birth);
   - `authenticated` has no direct insert/update on either table.

## Out of scope

UI, HTTP API, trigger rules, approval chain and final decision, audit-pack export, the supplier flow, and hosted services.

## Acceptance criteria

1. The 24 casebook cases replay through the RPC with the exact result persisted.
2. Every strict-validation negative is rejected with 22023 and stores nothing.
3. Every authorization and isolation negative holds; suites 010–090 are unchanged.
4. Full gates pass with exit codes preserved.

## Rules

- Forward-only migration.
- No personal data beyond the fictional seed.
- No `.env`, no hosted services, no push or merge.
- Conventional Commits in English.
- Stop and report any conflict between the contract and ADR 0012 or the casebook.
- You are the author, not the reviewer.

## Expected handoff

The standard template, plus:
- the schema;
- the RPC signatures;
- the capability matrix;
- the fact-schema derivation rule;
- per-suite counts;
- the casebook replay result;
- the SHA.

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

## Handoff

**Outcome:** Implemented. The customer is now a real, tenant-scoped subject with a trusted, persisted, audited CRA assessment path on top of TASK-032's `app.evaluate_cra`. The strict intake validation closes `docs/reviews/REVIEW-TASK-032.md`'s fail-open finding: an override fact that is absent, null, or has the wrong type/case/value is rejected with `22023` before any computation, storing nothing. All 24 casebook cases replay through the RPC with the exact persisted result. Backend only, no UI, no HTTP API; the supplier flow is untouched.

**Branch and commits:** `feat/customer-assessment`, created from `feat/cra-engine-v2` (neither TASK-030 nor TASK-032 was in `origin/main` yet).

```text
99d71e8 docs(task): add TASK-033 contract and TASK-032 review report
cb8d227 feat(cra): add customer subject and persisted CRA assessment
8b494ad test(cra): avoid a membership fixture collision from the new dev seed
6916f0d test(cra): add the customer assessment SQL suite
ab03a3a feat(cra): add server-side TypeScript for the customer assessment slice
```
The next commit records this handoff; the branch tip at delivery is reported in the reply (a commit cannot contain its own hash).

**Files changed:**
- `supabase/migrations/20260927100000_customer_assessment.sql` (new) — capabilities, `customers`, `customer_assessments`, `create_customer`, `run_customer_assessment`.
- `supabase/seed.sql` (appended) — two fictional demo-tenant memberships (tenant_admin, operator) and three fictional customers.
- `supabase/tests/100-customer-assessment.sql` (new) — 71 assertions.
- `supabase/tests/090-cra-engine-v2.sql` (one line) — `ON CONFLICT DO NOTHING` added to its own membership fixture insert, justified below.
- `docs/tasks/TASK-033-claude-customer-assessment.md` (contract + this handoff) and `docs/reviews/REVIEW-TASK-032.md` (copied in, per the contract).
- `apps/web/lib/domain/customer.ts`, `customer-assessment.ts` (new); `ids.ts` (+`CustomerId`, `CustomerAssessmentId`); `index.ts` (+2 exports); `tenancy.ts` (+3 capability keys, keeps the SQL/TS sync test passing).
- `apps/web/lib/supabase/customers-repository.ts`, `customer-assessments-repository.ts` (new).
- `apps/web/tests/domain/customer.test.ts`, `tests/supabase/customers-repository.test.ts`, `tests/supabase/customer-assessments-repository.test.ts` (new, 27 tests total).

No UI, HTTP API, dependency or lockfile change. Hosted Supabase untouched.

### Schema

`public.customers` (tenant-scoped, RLS select-only via `customer.view`, no write grant): `external_reference` (unique per tenant), `full_name`, `date_of_birth` (must be in the past), `country_of_birth`/`nationality`/`residence_country` (ISO alpha-2 shape), `onboarding_channel` (`face_to_face`|`non_face_to_face`), `status` (`active`|`archived`), provenance columns. Identity/provenance frozen after insert (`app.guard_customer_identity`, security invoker — self-row only, no TASK-029 exposure).

`public.customer_assessments` (append-only, `app.forbid_mutation` trigger): `customer_id`/`policy_version_id` (composite FKs), `facts jsonb` (the validated snapshot), `result jsonb` (the exact `app.evaluate_cra` output), denormalized `overall_score`/`band`/`dd_level`/`outcome`, `next_review_due date`, `correlation_id` (unique per tenant), `input_hash`, `assessed_by`/`assessed_at`. RLS select-only via `customer.view`, no write grant.

### RPC signatures

```sql
public.create_customer(
  p_tenant_id uuid, p_external_reference text, p_full_name text, p_date_of_birth date,
  p_country_of_birth text, p_nationality text, p_residence_country text, p_onboarding_channel text
) returns public.customers
-- security definer; checks customer.manage; idempotent on (tenant_id, external_reference):
-- identical replay returns the existing row, a mismatched replay is 23505.

public.run_customer_assessment(
  p_tenant_id uuid, p_customer_id uuid, p_facts jsonb, p_correlation_id uuid
) returns public.customer_assessments
-- security definer; checks assessment.run; customer must belong to the tenant (P0002);
-- selects the tenant's latest published cra_v2 version (P0003 if none); strict
-- fact-schema validation (22023, nothing stored); calls app.evaluate_cra(); persists
-- atomically with a PII-free audit event; advisory-lock idempotent on correlation_id
-- (namespace 2, distinct from run_supplier_evaluation's 1 and
-- record_supplier_final_decision's 0).
```

### Capability matrix

| Role | customer.view | customer.manage | assessment.run |
|---|:---:|:---:|:---:|
| tenant_admin | ✓ | ✓ | ✓ |
| risk_analyst | ✓ | ✓ | ✓ |
| operator | ✓ | ✓ | ✓ |
| auditor | ✓ | — | — |

Every check is `app.has_tenant_capability_as_member`, which already denies a platform administrator (dual-role or not) and a suspended tenant (D1/D2).

### Fact-schema derivation rule (implemented exactly as the contract's Amendment-free text specifies)

For the tenant's current published `cra_v2` version:
- **allowed keys** = its `policy_category_factors.factor_key`s ∪ its `policy_overrides.fact_key`s. Any other key in `p_facts` → `22023`.
- **override fact keys** must be present and JSON non-null. Allowed values = the union of `match_values` across every override row sharing that `fact_key` (e.g. `sanctions_match` unions `OVR_SANCTIONS_CONFIRMED`'s and `OVR_SANCTIONS_INCONCLUSIVE`'s), **plus the explicit negative value** — `false` if any of that union's elements is a JSON boolean, `"none"` otherwise (Template v1's own convention: verified none of its seven overrides' `match_values` already lists `false`/`"none"`, and every one of the casebook's 24 cases already supplies every override fact explicitly, confirmed by script before implementing). Membership is checked by `jsonb` containment (`@>`) on the exact JSON value, which is type- **and** case-sensitive by construction — this is what closes the review finding (`"true"`, `1`, `"Confirmed"` are all simply not equal to any allowed element, so they are rejected, not silently ignored).
- **factor keys**, if present, are passed through unvalidated: `app.evaluate_cra` already treats an absent, null, or unmapped factor value as missing data (`DATA_MISSING_*`/`INVALID_VALUE_*`), which is required behavior, not a gap — casebook CB-19/CB-20 depend on it. A test proves this explicitly (section 2 of the SQL suite).

### Per-suite SQL counts

`./supabase/tests/run-local-verification.sh`, `set -o pipefail`: **SQL=0**.

| Suite | Assertions | Failures |
|---|---:|---:|
| 010–080 | 16/21/18/43/26/28/40/26 (all unchanged) | 0 |
| 090-cra-engine-v2 | 120 | 0 |
| 100-customer-assessment (new) | 71 | 0 |
| **Total** | **409** | **0** |

100's 71 assertions cover: casebook count (1); 24 casebook replays through the RPC with exact `result`/denormalized-column/`next_review_due` checks, plus a persisted-row count (26); 6 strict-validation negatives each with a zero-rows proof (12) plus the lenient-factor positive check (1); role-based positive/negative authorization, D1 (dual-role + no-membership), D2, outsider, cross-tenant `P0002`, no-published-policy `P0003` (14); immutability of both tables including identity freeze (5); idempotency, conflict, audit atomicity, and two no-PII checks (5); `create_customer` idempotency, conflict, and no-PII audit (3).

### Casebook replay result

**24/24**, via `public.run_customer_assessment` (not just `app.evaluate_cra` directly) — every persisted `result` column, plus `overall_score`/`band`/`dd_level`/`outcome`/`next_review_due`, matches the casebook's `expected` object exactly.

### Checks and exact results (Node v24.11.1, npm 11.6.2)

| Check | Result |
|---|---|
| `./supabase/tests/run-local-verification.sh` | **SQL=0** |
| `npm ci` | exit 0 |
| `npm test` | **TEST=0** — 285 passed (223 baseline + 35 TASK-032 + 27 TASK-033), 0 failed |
| `npx tsc --noEmit` | **TSC=0** |
| `npm run lint` (project exclusions) | **LINT=0** |
| `npm run build` | **BUILD=0** |
| `npm run build:vercel && npm run verify:vercel` | **VERCEL=0** — genuine Vercel Build Output API v3 |
| `./scripts/check-secrets.sh` | **SECRETS=0** |
| `git diff --check` | **DIFF=0** |

### Decisions and one test justified in writing

- **090's membership fixture collided with the new dev seed.** TASK-033's seed now grants tenant_admin (002) an active membership in the demo tenant — the same membership `090-cra-engine-v2.sql`'s own privilege-probe section inserted itself, causing a unique-constraint violation. Fixed by adding `ON CONFLICT (tenant_id, user_id) DO NOTHING` to that one insert; the auditor (005) membership it also adds is still new and unaffected. No behavior change: the exact same active `tenant_admin` membership exists either way, and 090's own assertions are unchanged and still pass (120/120).
- **`customer_assessments.next_review_due`** is computed as `current_date + review_months` (whole months, not calendar-precise to the day of assessment) — matches the contract's own formula (`assessed_at + review_months`) at month granularity; verified in every casebook assertion.
- **No conflict found** between the contract and either ADR 0012 or the casebook: verified before implementing (script-checked) that every casebook case supplies every override fact explicitly and non-null, and that no override's `match_values` already contains the derived negative value.

**Security/tenant/audit impact:** additive only. Two new tenant-scoped, RLS-protected, RPC-only-write tables; the only capability changes are the three new keys and their role grants. `run_customer_assessment`'s audit metadata is verified (by test) to exclude `full_name` and `date_of_birth` and to never contain the customer's actual name string. No existing table, function, or policy was altered. No secret, credential, or hosted service was touched.

**Migration and rollback:** forward-only; every object is new (no existing object is redefined). Rollback notes are in the migration's own trailing comment.

**Known limitations:** no UI or HTTP API (explicitly out of scope); the demo tenant's `cra_v2` policy is still DRAFT (unsigned by the compliance lead); no update path exists yet for a customer's own fields (not required by this task); override match values are validated by scalar JSON equality only — a match_values entry that were itself an array or object (none exist in Template v1) would need `@>`'s semantics re-checked, noted for a future policy author task.

**Recommended reviewer:** the orchestrator (Claude, Cowork).

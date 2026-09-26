# TASK-032 — CRA engine v2 (policy structure + database evaluator)

Owner: Claude Code · Reviewer: orchestrator (Claude, Cowork) · Approver/merge: Edu
Status: **Approved — 26 Sep 2026 (Edu)**
Branch: `feat/cra-engine-v2`, created from `docs/foundation-alignment-cra` (TASK-030). Once TASK-030 is merged, it is created from `origin/main` instead.

## Objective

Make the engine able to express the compliance lead's CRA methodology, following ADR 0012 and `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md`. The engine must support:
- override rules;
- weighted categories with sub-factors and value→points maps;
- bands mapped to SDD/CDD/EDD;
- required actions, approvals and review interval per band.

Evaluation is a **pure, deterministic database function over a facts document**. This task does not touch the subject (customer), the UI, the API or triggers.

## Inputs (read in full)

- `docs/adr/0012-customer-cra-engine-as-mvp-core.md`, `docs/product/PRODUCT-DIRECTION-MVP-25.md`, `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md`
- `/Users/samiragouvea/Desktop/Mitiga/docs/produto/cra/template-v1-draft.json`: the machine-readable Template v1. **This is the normative source for weights, maps, overrides and bands.**
- `/Users/samiragouvea/Desktop/Mitiga/docs/produto/cra/casebook-v1.json`: 23 synthetic cases with expected outputs. **This is the acceptance oracle.**
- `/Users/samiragouvea/Desktop/Mitiga/docs/produto/cra/reference_engine.py`: the orchestrator's reference implementation, which produced the expected outputs. Read it for semantics; do not commit it.
- The existing engine: `supabase/migrations/2026091412020*`, `20260922130000*`, `20260922140000*`; `apps/web/lib/domain/evaluation-*`.

## Semantics (normative, matching the reference engine)

1. **Factor points.** If the fact is present and its value is in the map, the factor scores the mapped points and emits the reason code `FACTOR_<KEY>_{LOW|MEDIUM|HIGH}` (LOW < 30, HIGH ≥ 70). If the fact is absent, the factor scores `missing_factor_points` (50) and emits `DATA_MISSING_<KEY>`. If the value is not in the map, it is also treated as missing, with an additional `INVALID_VALUE_<KEY>`.
2. **Category score** = Σ(points × factor weight) / Σ(factor weight), rounded half-up to 2 decimals.
3. **Overall score** = Σ(category score × category weight) / 100, rounded half-up to 2 decimals. Category weights sum to 100.
4. **Band** by score: LOW [0,36), MEDIUM [36,76), HIGH [76,100].
5. **Overrides** are evaluated on facts in template order. Every hit is reported. The effect is `reject` if any `reject` override hits, otherwise `force_high` if any hits. Either effect sets the band to HIGH (EDD). The score is still computed and reported.
6. **Outcome:**
   - `REJECT` when a reject override hits;
   - `REVIEW_REQUIRED` when the band is HIGH;
   - `PROCEED` otherwise.
   This is a recommendation, not a decision.
7. **Required actions** = the band's actions, then the actions of the override hits, de-duplicated in order. **Approvals** = the union of the band's and the overrides' approvals, ordered MLRO then BOARD. **Review months** come from the band.
8. **Reason code order:** override codes, then factor/data codes in template order, then `BAND_*` and `DD_*`.

## In scope

1. **Forward migration** (timestamp after `20260923100000`):
   - A policy **engine kind** on `policy_versions`: `'weighted_v1'` (existing, default) or `'cra_v2'`. Existing rows and the supplier flow are unaffected.
   - New policy child tables, each tenant-scoped with composite FKs to `policy_versions`:
     - `policy_categories` (key, label, weight, position);
     - `policy_category_factors` (category_key, factor_key, weight, position, `points jsonb`);
     - `policy_overrides` (code, position, fact_key, `match_values jsonb`, effect ∈ {reject, force_high}, `actions jsonb`, `approvals jsonb`);
     - `policy_cra_bands` (band ∈ {LOW, MEDIUM, HIGH}, min, max, max_inclusive, dd_level ∈ {SDD, CDD, EDD}, review_months, `actions jsonb`, `approvals jsonb`);
     - a `missing_factor_points` setting.
   - Every child table gets:
     - the existing `app.forbid_children_when_not_draft` immutability trigger;
     - RLS read access via `app.has_tenant_capability_as_member(tenant_id,'policy.view')`;
     - **no write grants to `authenticated`**, since templates are loaded by migration/seed or superuser for now (policy authoring UI is post-MVP).
   - **Publish-time validation** for `cra_v2`. It fails with `22023` and blocks publishing when:
     - category weights do not sum to 100;
     - factor weights within a category do not sum to 100;
     - a points map is empty or has values outside 0–100;
     - the bands are not contiguous over [0,100];
     - any override has an unknown effect.
   - **`app.evaluate_cra(p_tenant_id uuid, p_policy_version_id uuid, p_facts jsonb) returns jsonb`.** It is pure and deterministic (`stable`), implements the semantics above, and returns exactly the `expected` shape used in the casebook: overall_score, category_scores, band, dd_level, outcome, overrides_hit, approvals_required, required_actions, review_months, missing_factors, reason_codes. It is `security definer`, `set search_path`, and **`EXECUTE` is revoked from `authenticated`/`anon`**, so only future RPCs call it. It raises `22023` if the version is not `cra_v2` or does not belong to the tenant.
2. **Demo policy.** A seed (`supabase/seed.sql`, dev only) that loads Template v1 **exactly from the JSON** into the existing demo tenant as a published `cra_v2` version labelled "EU Payments & Gaming CRA — v1 DRAFT". Do not touch the hosted database.
3. **SQL test** `supabase/tests/090-cra-engine-v2.sql`:
   - all 23 casebook cases must match exactly, compared as jsonb equality of the whole expected object;
   - publish validation negatives, one per rule;
   - a published `cra_v2` policy is immutable (child insert, update and delete are blocked);
   - `authenticated` cannot execute `app.evaluate_cra` or write the child tables;
   - cross-tenant: evaluating with another tenant's version raises `22023`.
   Load the casebook by embedding it in the test as a jsonb literal. Keep it byte-identical to the JSON file and write a short comment on how it was generated.
4. **TypeScript reference.** `apps/web/lib/domain/cra-engine.ts` is a pure, non-authoritative mirror (ADR 0012), with `apps/web/tests/domain/cra-engine.test.ts` running the same 23 cases from `apps/web/tests/fixtures/cra-casebook-v1.json` and `cra-template-v1-draft.json`. It writes nothing.
5. Handoff in `docs/tasks/TASK-032-claude-cra-engine-v2.md`.

## Out of scope

- The customer subject, assessment persistence, RPCs for users, UI, API, trigger rules, approval chain and audit pack. Those are later tasks (033+).
- Changes to the supplier flow or `run_supplier_evaluation` behaviour.
- Editing applied migrations.
- The hosted Supabase project.

## Acceptance criteria

1. 23/23 casebook cases pass in SQL **and** in TypeScript, with identical outputs.
2. All existing suites 010–080 and 223 app tests still pass. The supplier flow is unaffected.
3. Publish validation rejects each invalid structure with `22023`, and no partial publish happens.
4. `app.evaluate_cra` is not executable by `authenticated`/`anon`; the child tables are not writable by them.
5. Full gates pass with exit codes preserved: SQL harness, `npm ci`, `npm test`, `tsc`, lint, build, `build:vercel`/`verify:vercel`, `check-secrets` and `git diff --check`.

## Rules

- Forward-only migration with rollback notes.
- No secrets, no `.env` reads, no hosted services.
- No push or merge.
- Conventional Commits in English, with no agent names.
- If a semantic in this contract conflicts with the reference engine or the casebook, **stop and report it**. Do not choose silently.
- You are the author, not the reviewer.

## Expected handoff

The standard template, plus:
- the schema summary;
- the function signature;
- per-suite SQL counts;
- the casebook results (SQL and TS);
- the SHA.

## Amendment 1 — 26 Sep 2026 (orchestrator, approved by Edu)

Transcribed from the orchestrator's message to the implementer: the source contract file did not yet contain this section when the task started. The reference engine and casebook files were confirmed updated (24 cases; the reference reproduces all 24).

1. **Required actions are fully de-duplicated:** the band's actions plus the actions of the override hits, with no repetition, keeping the first occurrence. `reference_engine.py` had a bug (it only de-duplicated against the band) and was fixed. The casebook now has **24 cases**; CB-24 is material adverse media plus blacklisted country, with `REPORT_TO_MLRO` listed once. **Acceptance becomes 24/24** (wherever this contract says 23, read 24).
2. **`public.run_supplier_evaluation` may be redefined in a new migration with exactly one change:** select the current published policy with `engine_kind = 'weighted_v1'`. A regression test is required: a tenant with a published `cra_v2` still evaluates suppliers with its `weighted_v1` policy. The Template v1 seed goes into a **new** tenant, "EU Payments Demo Ltd." (fixed UUID, slug `eu-payments-demo`), not an existing one. Before adding it, check whether any suite from 010 to 080 counts tenants; if one does, report it and adjust with a written justification.
3. **`null` counts as absent** for a fact.
4. **`effect` is validated only at publish time** (no CHECK on the table); `band` and `dd_level` keep their CHECK constraints.

## Handoff

**Outcome:** CRA engine v2 implemented: policy structure, publish-time validation, immutability, a pure database evaluator, a dev seed of Template v1 DRAFT, a SQL suite and a non-authoritative TypeScript mirror. **24/24 casebook cases pass in SQL and in TypeScript with identical outputs.** No customer subject, persistence, user RPC, UI, API, trigger rules, approval chain or audit pack was added. All required gates pass.

**Branch and commits:** `feat/cra-engine-v2`, created from `docs/foundation-alignment-cra` (TASK-030 was not yet merged into `origin/main`), tip `9a7d0ca` at creation. The commits below are on top of it.

```text
docs(task): add TASK-032 CRA engine v2 contract and amendment 1
feat(cra): add CRA policy structure and database evaluator
test(cra): add the CRA engine v2 SQL suite
feat(cra): add the non-authoritative TypeScript CRA engine mirror
docs(task): record TASK-032 handoff        <- the handoff commit; tip reported in the reply
```

**Files changed:**
- `supabase/migrations/20260926100000_cra_engine_v2.sql` (new) — schema, validators, evaluator, the one-line `run_supplier_evaluation` fix, rollback notes.
- `supabase/seed.sql` (appended) — dev-only tenant "EU Payments Demo Ltd." and Template v1 DRAFT loaded from the embedded JSON.
- `supabase/tests/090-cra-engine-v2.sql` (new) — 120 assertions.
- `apps/web/lib/domain/cra-engine.ts` (new) — pure exact-decimal TS mirror.
- `apps/web/tests/domain/cra-engine.test.ts` (new) — 35 tests.
- `apps/web/tests/fixtures/cra-casebook-v1.json`, `cra-template-v1-draft.json` (new) — byte-identical copies of the normative inputs (verified with `cmp`).
- `docs/tasks/TASK-032-claude-cra-engine-v2.md` — the contract, the transcribed Amendment 1, and this handoff.

No UI, dependency, lockfile or earlier-migration change. `reference_engine.py` was not committed.

### Schema summary

`public.policy_versions` gains three columns: `engine_kind text not null default 'weighted_v1'` (CHECK `weighted_v1|cra_v2`), `label text`, `missing_factor_points numeric` (CHECK 0–100). Existing rows keep `weighted_v1`.

| Table | Columns (besides id, tenant_id, policy_version_id, created_at) | Notes |
|---|---|---|
| `policy_categories` | key, label, weight, position | unique (version, key) and (version, position) |
| `policy_category_factors` | category_key, factor_key, weight, position, `points jsonb` | FK to the category; factor_key unique per version |
| `policy_overrides` | code, position, fact_key, `match_values jsonb`, effect, `actions jsonb`, `approvals jsonb` | **no CHECK on effect** (validated at publish only, per amendment) |
| `policy_cra_bands` | band (CHECK LOW/MEDIUM/HIGH), min_score, max_score, max_inclusive, dd_level (CHECK SDD/CDD/EDD), review_months, `actions jsonb`, `approvals jsonb` | a score s is in a band when min_score ≤ s and (s < max_score, or s ≤ max_score if max_inclusive) |

Every child has composite FKs to `policy_versions(id, tenant_id)`, the existing `app.forbid_children_when_not_draft` trigger, RLS with `select` through `app.has_tenant_capability_as_member(tenant_id,'policy.view')`, no write policy, and `insert/update/delete` revoked from `authenticated` (all revoked from `anon`).

**Publish-time validation** (`trg_policy_versions_cra_publish_validation`, security definer, `cra_v2` only, `22023`, aborts the whole statement so nothing is partially published): category weights sum to 100; each category's factor weights sum to 100; each points map is a non-empty object of numbers in [0,100]; bands contiguous over [0,100] (start 0, each next starts where the previous exclusive one ends, last ends at 100 inclusive); every override effect is `reject` or `force_high`. Additional checks I added (see decisions): `missing_factor_points` set; a HIGH band exists; each band/override `actions` and `approvals` are string arrays with approvals in {MLRO, BOARD}; `match_values` is a non-empty array.

### Function signature

```sql
app.evaluate_cra(p_tenant_id uuid, p_policy_version_id uuid, p_facts jsonb) returns jsonb
-- language plpgsql, STABLE, SECURITY DEFINER, set search_path = public, pg_temp
-- revoke all ... from public, authenticated, anon
-- 22023: version is not cra_v2 / not this tenant's / not found / facts not an object / structurally unusable
```
Returns exactly the casebook `expected` shape: `overall_score, category_scores, band, dd_level, outcome, overrides_hit, approvals_required, required_actions, review_months, missing_factors, reason_codes`.

### Results

**Casebook (24 cases):** SQL 24/24 (whole-object `jsonb` equality, one assertion per case); TypeScript 24/24 (`assert.deepStrictEqual`). Extra check outside the repo, not committed: a differential run on **3,000 random fact sets** (missing, null, unmapped values, rare overrides; 579 LOW, 1,589 MEDIUM, 832 HIGH; 247 REJECT) gave **0 mismatches** for SQL × reference engine and TypeScript × reference engine.

**SQL suites** (`run-local-verification.sh`, `set -o pipefail`, **SQL=0**): 010=16, 020=21, 030=18, 040=43, 050=26, 060=28, 070=40, 080=26 (all unchanged) and **090=120**; total **338**, 0 failures. Suite 090 covers: seed structure; the 24 cases; null/invalid/array/extra-fact semantics; 19 publish negatives, each with proof of no partial publish, plus a positive control; immutability (insert/update/delete on all four children, plus label/engine_kind/missing_factor_points on the version); `authenticated`/`anon` cannot execute `evaluate_cra` or write the children; member/auditor read, outsider/platform-admin/anon do not; cross-tenant, weighted_v1 and nonexistent versions raise 22023; the supplier regression.

**Application:** `npm ci` exit 0; `npm test` exit 0, **258 tests, 258 pass** (223 previous + 35 new; 24 are the casebook); `tsc` exit 0; lint exit 0; `build` exit 0; `build:vercel` exit 0; `verify:vercel` exit 0; `check-secrets` exit 0; `git diff --check` exit 0.

### Decisions, deviations and things to confirm

1. **Amendment 1 was not in the contract file on disk** when I started; I transcribed it from the orchestrator's message into the repo copy, and marked it as transcribed. The reference engine and casebook were confirmed updated (24 cases, the reference reproduces all 24).
2. **`run_supplier_evaluation`: exactly one change**, proved by `diff` of the old and new function text: `where tenant_id = p_tenant_id and status = 'published'` → `... and engine_kind = 'weighted_v1'`. Regression in suite 090: Meridian publishes a newer `cra_v2` and its supplier evaluation still uses the `weighted_v1` policy.
3. **Tenant count check (as instructed):** no suite from 010 to 080 counts tenants in a way the new tenant can change (only `count = 0` as `anon` and `>= 2` as platform admin). No existing suite needed adjusting. The demo tenant has **no memberships** in the seed, so no existing user-scoped assertion is affected; suite 090 adds the memberships it needs inside its own rolled-back transaction.
4. **Column names:** the contract says band `min`/`max`; I used `min_score`/`max_score`, consistent with `policy_thresholds`. The `missing_factor_points` setting and a `label` (the contract requires a label, and the table had none) are columns on `policy_versions`.
5. **Published-policy immutability was extended:** `app.forbid_published_policy_version_mutation()` compared specific columns on the archive transition and would have let an archive also rewrite the new columns. I redefined it (body otherwise unchanged) to compare `engine_kind`, `label` and `missing_factor_points`. Beyond the literal contract; needed for "a published cra_v2 policy is immutable".
6. **Extra publish validations** (HIGH band exists, string-array actions/approvals with approvals ⊆ {MLRO, BOARD}, non-empty `match_values`, `missing_factor_points` set) go beyond the five listed rules. They only reject structures the evaluator could not evaluate correctly; reviewer to confirm they are welcome.
7. **`evaluate_cra` does not require the version to be published** (the contract lists only "not cra_v2 or not this tenant's"). It fails closed with 22023 on structurally unusable versions. The future RPCs that call it should require `published`.
8. **Fact semantics I had to pin down** (all match the reference engine, none contradict the contract): `null` = absent (confirmed); only a JSON string in the map counts as mapped (a number, boolean or array is missing + invalid); an override fact must be a scalar and matches by exact equality (an array fact never hits).
9. **Seed:** the JSON is embedded once in `seed.sql` (byte-identical to the fixture; a unit test enforces it) and every row is derived from it with jsonb functions. The seed is idempotent-guarded on the policy id.

**Security/tenant/audit impact:** additive. New tables are tenant-scoped, RLS-read-only, not writable by client roles; `evaluate_cra` and the validator helpers are not executable by `authenticated`/`anon`; the only change to existing behaviour is the supplier policy selection filter and the stricter archive check on published policy versions. No secret, credential or hosted service was touched.

**Migration and rollback:** forward-only; rollback notes are in the migration header (drop the trigger, helper functions, four tables, three columns and `app.evaluate_cra`; restore the prior bodies of the two redefined functions from `20260912120200` and `20260922140000`). No existing row is modified.

**Known limitations:** no policy-authoring path for tenants yet (children are written by migration/seed/superuser only); the demo tenant has no members, so it cannot be used in the UI until a later task adds them; a tenant holding both engine kinds is now safe for suppliers, but nothing yet chooses which engine a *customer* assessment uses (task 033+); the TypeScript mirror validates nothing about the template (structural validation is the database's publish-time job).

**Recommended reviewer:** the orchestrator (Claude, Cowork).

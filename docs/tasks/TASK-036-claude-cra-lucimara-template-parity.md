# TASK-036 — CRA template v1.1 parity with Lucimara spreadsheets (backend)

Owner: Claude Code · Reviewer: orchestrator · Approver/merge: Edu  
Status: **Ready for implementation — not implemented as of 24 Nov 2026: no branch, migration or merge commit for this contract exists in the repository**  
Branch: `feat/cra-lucimara-template-v1-1` from `origin/main`

## Objective

Bring the production CRA policy model in line with the compliance lead’s operational spreadsheets (Feb/Mar 2025, delivered 16 Oct 2026), without running Excel in production. Ship a list-resolved template, dual assessment modes (onboarding / ongoing), score map 90/65/25, expanded factors, corrected hard-rule semantics, and a parity casebook that reproduces the spreadsheet’s cached HIGH scenario (76.61).

This task is **backend + policy fixtures + SQL/TS tests**. UI list authoring remains TASK-040. Trigger *computation* from the ledger remains TASK-039 (this task only accepts the resulting facts).

## Inputs (already prepared by orchestrator)

| Path | Role |
|---|---|
| `docs/produto/cra/lists-from-lucimara-v0/` | Extracted starter lists (27 JSON files) |
| `docs/produto/cra/template-v1.1-draft.json` | Proposed policy shape |
| `docs/produto/cra/casebook-lucimara-parity-v0.json` | 6 parity cases (LP-01…LP-06) |
| `docs/produto/cra/reference_engine_v1_1.py` | Offline parity evaluator (must stay green) |
| `docs/produto/cra/GAP-DIFF-LUCIMARA-VS-TEMPLATE-V1.md` | Factor-level gap analysis |
| `docs/insumos-lucimara/2026-10-16/ANALISE-PLANILHAS-CRA-LUCIMARA.md` | Senior analysis of the workbooks |

Drive mirror: `13 — Insumos Lucimara / Arquivos enviados pela Lucimara/`.

**Still open with Lucimara (do not block the structural work; gate publication):**
- Q6 HNWI numeric threshold → keep `OVR_HNWI` with `status: pending_Q6_threshold`
- Gambling window 30 vs 180 days → keep both options documented on the factor; default **do not hard-code** until answered
- Confirm missing-data = 0 (spreadsheet) vs previous mid-penalty 50
- Q8 Required/Optional marks on `intake-fields-q8.json`
- Whether `OVR_STR_SUBMITTED` and `OVR_VIRTUAL_ASSETS_PAYMENT` ship in the first published v1.1 (include in template as inactive or behind status flags if unsure)

## In scope

1. **Reference package in repo (canonical).**  
   Ensure the files under `docs/produto/cra/` above are also mirrored into the platform repo paths used by CI (`docs/product/...` and/or `apps/web/tests/fixtures/` — follow existing TASK-032/034 convention). Byte-stable where tests assert identity.

2. **Policy document model for `cra_v2`.**  
   Extend what `app.evaluate_cra` / the publish validator accept so a published version may include:
   - `score_map` (or equivalent points resolution via list refs);
   - `assessment_modes` with category weights for `onboarding` and `ongoing`;
   - factors that reference **lists** (`list_ref` + value key) **or** inline `points` maps (backward compatible with v1 draft);
   - overrides evaluated as **priority / MAX** (reject > force_high); never sum override points.

3. **List resolution at evaluate time.**  
   - Resolve `fact → list item → risk → score_map points`.  
   - Country factors accept ISO2.  
   - Unknown list key → `INVALID_VALUE_*` (strict intake unchanged).  
   - Absent factor → points from `not_available` (0 under v1.1 draft).  
   - Starter lists from `lists-from-lucimara-v0` are embedded in the **demo / template seed** for local + demo tenant only. Hosted apply only via the normal migration/publish path with Edu approval.

4. **Assessment mode.**  
   - `run_customer_assessment` accepts an optional mode (default `ongoing`) **or** derives it from a fact `assessment_mode`. Pick one approach; document it; cover both modes in SQL tests.  
   - Onboarding omits the `transactions` category and uses the onboarding weight set.

5. **Parity casebook.**  
   - Port `casebook-lucimara-parity-v0.json` into the SQL/TS fixture pipeline.  
   - **LP-01 must score 76.61 / HIGH / REVIEW_REQUIRED** with category scores matching the reference engine.  
   - LP-02…LP-06 must pass.  
   - Keep the existing 24-case v1 casebook green **either** by keeping a published v1 template for those tests **or** by migrating expectations — do not silently break TASK-032/033/034 coverage. Prefer dual fixtures: `casebook-v1` against template v1, `casebook-lucimara-parity-v0` against template v1.1.

6. **Hard rules from the spreadsheet (template only).**  
   Add override entries (even if provisional):
   - `OVR_STR_SUBMITTED`
   - `OVR_VIRTUAL_ASSETS_PAYMENT`  
   Do **not** implement periodic-review CDD quality overrides in this task (defer).

7. **`get_customer_assessment_form`.**  
   Return list values (keys) for the active mode’s factors, still **without weights or points**. Country factors may return a capped hint (e.g. “iso2”) rather than 245 labels if payload size is an issue — if so, document and keep a separate countries endpoint or embed countries in the published policy blob server-side only.

8. **Tests.**  
   - Python: `reference_engine_v1_1.py casebook-lucimara-parity-v0.json` exits 0 (add a CI step or document as pre-merge check).  
   - SQL suite extension (new file `12x-cra-lucimara-parity.sql` or extend 090/100): LP-01…LP-06 through `evaluate_cra` / `run_customer_assessment`.  
   - TypeScript unit tests for list resolution helpers.

9. **Handoff note.** Short English note for Lucimara: what was encoded, what still needs her numbers (Q6, 30 vs 180, Q8).

## Out of scope

- Hosted demo re-seed / republish without Edu approval  
- Ledger trigger evaluator (TASK-039)  
- Tenant UI to edit weights/lists (TASK-040)  
- MLRO approval chain (TASK-038)  
- Excel import runtime  
- Changing production demo policy until Lucimara signs v1.1  

## Acceptance criteria

1. `python3 docs/produto/cra/reference_engine_v1_1.py docs/produto/cra/casebook-lucimara-parity-v0.json` → **6/6 OK**, including LP-01 overall **76.61**.  
2. SQL + TS parity suites green for LP-01…LP-06 against template v1.1.  
3. Existing v1 casebook (24 cases) still green against the v1 template path.  
4. Publish validator rejects a policy whose category weights (per mode) do not sum to 100, or whose factor subweights within a category do not sum to 100.  
5. Overrides never affect the numeric score via addition; reject/force_high only change band/outcome.  
6. No third-party product brand strings in user-facing policy labels.  
7. Review report filed; Edu merge only after CI green.

## Suggested implementation order

1. Mirror fixtures into platform paths; wire reference engine check.  
2. Extend evaluate/publish for list_ref + score_map + modes (feature-flagged or new template key).  
3. Seed template v1.1 as DRAFT alongside v1; do not auto-publish on hosted.  
4. Port LP cases to SQL/TS.  
5. Form RPC + tests.  
6. Handoff + REVIEW doc.

## Effort

About **3–5 engineering days** for one stream. Can start immediately; Lucimara answers land as a small follow-up patch (thresholds / window / Q8), not a rewrite.

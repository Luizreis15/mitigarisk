# MITIGA — Product Direction & 25-Day MVP (v1)

**Date:** 26 Sep 2026 · **Owner:** Product orchestration (Claude) · **Approvers:** Edu (product), Lucimara (risk & compliance)
**Inputs:** Lucimara's source files (Investor deck, Regulatory presentation, AML/CFT Operational Process Flow Charts, Project Now Ruleset, EU Compliance Checklist, Vendor Benchmark, Financial Plan) · PRD v0.3 · current codebase state (26 Sep 2026)

---

## 1. One-line product definition

**MITIGA is a configurable, explainable and auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities.** It sits on top of the screening and identity vendors an entity already uses, and turns their outputs into a documented risk rating, a due-diligence level, the required actions and a human decision trail that stands up to the regulator (AMLR 2024/1624, applicable 10 July 2027).

**Principle:** *MITIGA does the work; the entity retains the decision.* This is the AMLR Art. 18 outsourcing rule, and it matches the platform's existing design.

## 2. Positioning

| Axis | Decision |
|---|---|
| Category | CRA and due-diligence engine. It is not an identity vendor and not a screening data vendor. |
| Beachhead | Regulated payment, gaming and e-commerce operators in Malta and the EU. Lucimara's methodology and ruleset already run in this segment. |
| Expansion | Payment institutions, EMIs and CASPs; then DNFBPs. This is the AMLR 2027 horizon. |
| Differentiators | (1) Configurable methodology per entity, versioned and immutable once published. (2) Override (knock-out) rules plus weighted scoring, fully explained with reason codes. (3) Linked-transaction trigger rules, a live AMLA gap (AMLA-OB-2). (4) Audit pack ready for FIAU/AMLA review. (5) Mid-market price point, against CRA engines at €18.5k–€324k/yr. |
| Not in scope | Document capture, biometric IDV, sanctions/PEP data, and automatic STR filing. Partners and the entity's existing vendors cover these. |
| AI | Assistive only, later (triage, narrative drafts). Deterministic core decision. |

## 3. Who uses it (MVP)

| Role (existing capability model) | Real-world role | MVP actions |
|---|---|---|
| `tenant_admin` | MLRO / Head of Compliance | Publish policy, approve high-risk/EDD, record final decision |
| `risk_analyst` | Compliance analyst (2nd line) | Create assessments, review results, request documents |
| `operator` | Onboarding / operations (1st line) | Submit customer data, see status and required actions |
| `auditor` | Internal audit (3rd line) | Read-only access plus audit pack export |
| API client | The entity's onboarding system | `POST /v1/assessments`, `GET /v1/assessments/{id}` |

## 4. MVP-25 scope (fixed)

The goal: **on day 25, Lucimara can run her own CRA methodology in MITIGA on synthetic customers, through the portal and the API, and export the evidence.**

### In scope

1. **Customer subject.** A natural-person customer with an external reference, the registration fields from P1.1 and the SOW questionnaire from P1.2. It reuses the supplier slice's tenancy, RPC, audit and immutability patterns.
2. **Policy Template v1: "EU Payments & Gaming CRA (C2D-derived)",** following spec doc 03:
   - override rules;
   - five weighted categories with sub-factors and value→points maps;
   - bands mapped to SDD/CDD/EDD;
   - required actions per band;
   - periodic review interval per band.
3. **Assessment result:**
   - overall score and category scores;
   - band and due-diligence level;
   - override hits;
   - reason codes;
   - missing data (data quality);
   - required actions;
   - next periodic review date;
   - policy version.
4. **Transaction trigger evaluator:** the Project Now ruleset (€500 lifetime, €2k/180d, affordability, €10k/180d net linked) run on **aggregated totals supplied by the caller**. There is no raw transaction ingestion in the MVP. The output is the trigger hit and the required action.
5. **Approval chain.** High risk, EDD or PEP requires an MLRO decision, recorded as an immutable decision. A board-approval flag is captured.
6. **API v1:** per-tenant API key, `POST /v1/assessments` (idempotent) and `GET /v1/assessments/{id}`, plus minimal docs and examples.
7. **History, detail and audit pack export** (PDF/CSV). The pack contains inputs, policy version, factor contributions, overrides, decision chain and timestamps.
8. **Members:** invite and assign roles (real UI).
9. **Demo hygiene:** hide the prototype routes; only real screens remain reachable.

### Out of scope (explicit)

- Real-time transaction monitoring.
- Case management and STR filing.
- Vendor connectors: screening results arrive as input fields.
- Webhooks (stretch goal only).
- Billing, MFA/SSO, EUDI Wallet, AMLA database and FIU.net adapters.
- BWRA.

## 5. How it maps to what exists

| Capability | Status on 26 Sep | Work |
|---|---|---|
| Tenancy, roles, database authorization boundary | Done and hardened (218 SQL assertions) | None |
| Versioned, immutable policy + deterministic weighted engine | Done (single-level factors) | Extend with categories, value→points maps and override rules |
| Recommendation vs. human decision, immutable audit | Done (supplier slice) | Generalize to the customer subject; add a second approval level |
| Supplier-specific UI | Done | Replace with customer assessment screens |
| API, API keys | Not started | Build (thin layer over the same RPCs) |
| Audit pack export | Not started | Build |
| Trigger evaluator | Not started | Build (pure function + RPC) |

## 6. 25-day plan (v2, replaces the earlier plan)

| Days | Deliverable | Visible proof |
|---|---|---|
| 1–2 | Main CI green; prototype routes hidden; browser walkthrough with screenshots; status board | Status board |
| 1–3 | **60-min session with Lucimara:** confirm doc-03 open questions (weights mapping, factor tables, 75/76 boundary, trigger ruleset as default) | Signed-off Policy Template v1 |
| 3–9 | Customer subject + engine extension (categories, points maps, overrides, DD level, required actions, review date) | Assess a synthetic customer in the portal |
| 8–12 | Trigger evaluator + approval chain | Trigger hit shows the required action; MLRO approves an EDD case |
| 10–14 | API v1 + keys + docs | An API-created assessment appears in the portal |
| 13–17 | History, detail, audit pack export; member invites | Download an audit pack |
| 17–19 | Synthetic case book (≥20 cases from P1/P2 flows) validated by Lucimara | Case book passes |
| 20–23 | Assisted pilot with Lucimara; fixes | Real use on synthetic data |
| 24–25 | Clean delivery environment, demo script, handover | MVP live |

**Cadence:**
- A browser demo every 2–3 days.
- Independent review only for changes to permissions or evidence integrity.
- One task in flight per agent.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Methodology tables not finalized ("still being finalised" in the source) | Ship Template v1 with the documented structure and provisional points, labelled DRAFT; lock after the day-3 session |
| Scope creep toward the investor deck (9 gaps, TM, MLRO service) | This document is the scope; anything else goes to the post-MVP backlog |
| Messaging conflict on AI | Adopt "assistive AI, deterministic decision" in all materials |
| Pilot client unknown | Demo tenant "EU Payments Demo Ltd." with synthetic data; swap in the real client after sign-off |

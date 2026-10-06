# MITIGA — CRA & Due-Diligence Policy Template v1 (DRAFT)

**Status:** DRAFT. Pending sign-off by Lucimara (Head of Compliance).
**Source:** "AML/CFT Operational Process Flow Charts" (P1.7, P1.8, P2.1, P2.2, P2.8) and "Project Now Ruleset Summary v4" (Jul 2025).
**Audience:** product and engineering. This is the first published policy the MVP engine must be able to express.

Marker legend:
- **[SRC]** taken directly from the source documents.
- **[PROV]** provisional engineering placeholder; must be confirmed.
- **[Q#]** open question (see §8).

---

## 1. Evaluation pipeline

```
Customer data + SOW questionnaire + screening results (from entity's vendor) + transaction aggregates
  → 1. Validation & data quality (missing mandatory fields)
  → 2. Override rules (knock-outs)            → may force HIGH / BLOCK / REJECT
  → 3. Category scoring (5 weighted categories)
  → 4. Band → Due-diligence level (SDD / CDD / EDD)
  → 5. Required actions + approval requirements
  → 6. Next periodic review date
  → 7. Transaction trigger evaluation (independent of score)
  → Result + reason codes + immutable evidence → human decision
```

## 2. Override rules (evaluated before scoring) [SRC P1.7/P2.8, P1.3–P1.6, P1.1]

| Code | Condition | Effect |
|---|---|---|
| `OVR_SANCTIONS_CONFIRMED` | Sanctions positive match confirmed | Existing customer: **freeze funds and block all transactions**. Prospect: **reject**. Report to MLRO |
| `OVR_SANCTIONS_INCONCLUSIVE` | Partial or inconclusive sanctions match | Classify **HIGH**, block pending manual review |
| `OVR_PEP` | PEP hit confirmed, or PEP self-declared | Classify **HIGH** → EDD; **MLRO + board approval** required; if not approved → terminate (P3.4) |
| `OVR_ADVERSE_MEDIA_MATERIAL` | Material adverse media (final AML/CFT conviction) | Classify **HIGH**; report to MLRO; termination path (P3.3) |
| `OVR_ADVERSE_MEDIA_POTENTIAL` | Under investigation for an AML/CFT offence | Classify **HIGH** |
| `OVR_HNWI` | High-net-worth individual | Classify **HIGH** |
| `OVR_BLACKLISTED_COUNTRY` | Resident in, or declared active links to, a blacklisted country | **Reject/terminate** (P3.5) |

Non-material adverse media (unrelated to AML/CFT) is **not** an override. It feeds the Customer category as a factor.

## 3. Weighted categories [SRC structure; weights mapping PROV, Q1]

| Category | Weight | Factors [SRC] | Onboarding source |
|---|---:|---|---|
| **C1 Customer** | 20% [PROV] | Purpose of relationship; non-material adverse media; employment status; occupation; prior STRs | Registration form, SOW Q, screening |
| **C2 Geography** | 10% [PROV] | Residence; nationality; SOW/SOF country | Registration form, SOW Q |
| **C3 Product / Service / Payment** | 15% [PROV] | Payment method; product type (closed-loop vs open) | Tenant configuration |
| **C4 Delivery channel** | 10% [PROV] | Face-to-face vs non-face-to-face | Onboarding channel |
| **C5 Transactions** | 45% [PROV] | Affordability result; change in behaviour; high-risk or high-value transactions | Transaction aggregates (later in lifecycle) |

The source lists the weights 45/20/15/10/10 but the slide layout doesn't settle which weight belongs to which category (**Q1**).

At onboarding, C5 has little data, so the source marks it "predetermined". Proposed handling [PROV]: at onboarding, C5 takes a neutral default of 0 risk points and is flagged "not yet observable" in data quality. It is recalculated at each trigger or periodic review (P2.8).

### 3.1 Factor scoring [PROV, Q2]

Each factor maps an input value to **risk points from 0 to 100**. The category score is the weighted average of its factors, and the overall score is Σ(category score × category weight). Placeholder maps until Lucimara provides the C2D scoring sheet:

| Factor | Low (0) | Medium (50) | High (100) |
|---|---|---|---|
| Purpose of relationship | e-commerce | gambling/betting | multipurpose / unclear |
| Employment status | employed | self-employed / retired / student | unemployed with high declared activity |
| Occupation / industry | standard | cash-intensive | high-risk sectors list (**Q3**) |
| Non-material adverse media | none | 1 hit | multiple hits |
| Prior STRs | none | — | ≥1 |
| Residence / nationality / SOW country | EU/EEA standard | higher-risk list | EU high-risk third country (Commission list) |
| Payment method | bank transfer | card | cash |
| Product | closed-loop | — | open-loop |
| Channel | face-to-face | — | non-face-to-face |
| Affordability result | within | 80–100% of limit | above limit |
| Behaviour change | none | moderate | significant |

## 4. Bands and due-diligence level [SRC P1.7/P1.8; boundary Q4]

| Score | Band | DD level | Required actions [SRC P1.8] | Approval |
|---|---|---|---|---|
| 0 – 35 | LOW | **SDD** | Identify (name, DOB, birth country, nationality, address); verify ID; ongoing screening | None |
| 36 – 75 | MEDIUM | **CDD** | SDD + purpose and intended nature (occupation, employment, nature and purpose of transactions via SOW Q) at the €500 point | None |
| 76 – 100 | HIGH | **EDD** | CDD + SOW/SOF information **and documentation** (P2.7) | **MLRO + board** |

The source says ">76 = high" and "36–75 = medium", which leaves a gap between 75 and 76. [PROV] Implement bands as [0,36), [36,76), [76,100], closed at 100.

## 5. Periodic review [SRC P2.1]

| Band | Review every | Workflow |
|---|---|---|
| LOW | 36 months | Start 3 months before the due date. 3 attempts for POI/POA, PEP confirmation plus SOW Q, and SOW docs. Block 1 month after the due date if incomplete → P3.8 |
| MEDIUM | 24 months | same |
| HIGH | 12 months | same |

Inactive for more than 730 days → dormant (P3.7).

## 6. Transaction trigger rules — "Project Now" ruleset [SRC]

Input: aggregates supplied by the caller (MVP), per customer.

| Code | Metric | Window | Threshold | Required action | If not provided |
|---|---|---|---|---|---|
| `TRG_500_DEROGATION` | Deposits + withdrawals | Lifetime | ≥ €500 | Full KYC (POI + POA) + purpose-of-relationship question | Deposits capped at €500, no accumulation |
| `TRG_2K_180D` | Deposits | 180-day rolling | ≥ €2,000 (gambling purpose; e-commerce goes straight to SOW Q) | SOW questionnaire | Deposits capped below €2k |
| `TRG_AFFORDABILITY` | **Net** deposits | Lifetime from the SOW Q answer date | > affordability limit (from SOW Q or docs) | SOW documents | Deposits capped at affordability; monthly accumulation allowed after the 1st trigger |
| `TRG_10K_180D_LINKED` | **Net** deposits, linked | 180 days from the registration date (resets) | ≥ €10,000 | SOW/SOF documents, unless prior SOW docs already cover it | Capped below €10k; reset only if SOW docs were provided before |
| `TRG_30D_AFFORDABILITY` [SRC P2.2c] | Deposits vs declared income | 30-day rolling | deposits > income | SOF docs; if not covered → escalate to MLRO / STR | Block the triggering transaction |

**Net deposit** = Σ deposits − 90% × Σ (winnings/withdrawals) within the linked period. Winnings outside the period are applied only via a manual compliance parameter (case-by-case) [SRC slides 7–10].

## 7. Reason codes (initial set)

`OVR_*` (above) · `CAT_C1_HIGH`, `CAT_C2_HIGH`, … · `FACTOR_<key>_{LOW|MEDIUM|HIGH}` · `BAND_LOW|MEDIUM|HIGH` · `DD_SDD|CDD|EDD` · `DATA_MISSING_<field>` · `TRG_*` · `APPROVAL_MLRO_REQUIRED` · `APPROVAL_BOARD_REQUIRED` · `REVIEW_DUE_<date>`

## 8. Open questions for Lucimara

1. **Q1:** Which weight goes with which category (45/20/15/10/10)? Is 45% transactions?
2. **Q2:** The full C2D factor and points sheet ("still being finalised" per the flowchart). Can we use it as Template v1, anonymised?
3. **Q3:** The high-risk occupation/industry list and the country lists (blacklisted, high-risk, standard).
4. **Q4:** The 75/76 boundary: is a score of 76 HIGH?
5. **Q5:** Are the Project Now thresholds (€500, €2k/180d, €10k/180d, 90% net) the **default template**, or specific to that client?
6. **Q6:** For HNWI, what is the definition or threshold?
7. **Q7:** Is board approval required for every EDD, or only for PEPs?
8. **Q8:** Minimum mandatory onboarding fields (data dictionary) for the API contract.

## 9. Acceptance (MVP)

- Template v1 is published as an immutable policy version in the demo tenant.
- ≥20 synthetic cases derived from the P1/P2 flows produce the expected band, DD level, overrides, triggers and required actions, with Lucimara's sign-off.
- Every result is reproducible from stored inputs plus the policy version (audit pack).

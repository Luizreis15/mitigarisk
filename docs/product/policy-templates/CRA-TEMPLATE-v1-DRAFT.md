# MITIGA — CRA & Due-Diligence Policy Template v1 (DRAFT)

**Status:** DRAFT — **partially signed off by Lucimara (Oct 2026).** Q1–Q5 and Q7 closed. Q6 and Q8 need a short follow-up (see §8).
**Source methodology:** AML/CFT operational process flows (P1.7, P1.8, P2.1, P2.2, P2.8) and gambling-industry transaction trigger thresholds (Jul 2025). Product-facing name: **MITIGA EU Payments & Gaming CRA** (MITIGA CRA Template v1). Do not use client or third-party brand names (former working labels) in product docs or UI.
**Audience:** product and engineering. This is the first published policy the MVP engine must be able to express.

Marker legend:
- **[SRC]** taken from the source methodology.
- **[LUC]** confirmed by Lucimara (Oct 2026).
- **[PROV]** provisional engineering placeholder; still open or demo-only.

---

## 1. Evaluation pipeline

```
Customer data + SOW questionnaire + screening results (from entity's vendor) + transaction aggregates
  → 1. Validation & data quality (missing mandatory fields)
  → 2. Override rules (knock-outs)            → may force HIGH / BLOCK / REJECT
  → 3. Category scoring (5 weighted categories; weights customisable 0–100)
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
| `OVR_PEP` | PEP hit confirmed, or PEP self-declared | Classify **HIGH** → EDD; **MLRO approval** required [LUC Q7]; board only if the MLRO escalates/submits; if not approved → terminate (P3.4) |
| `OVR_ADVERSE_MEDIA_MATERIAL` | Material adverse media (final AML/CFT conviction) | Classify **HIGH**; report to MLRO; termination path (P3.3) |
| `OVR_ADVERSE_MEDIA_POTENTIAL` | Under investigation for an AML/CFT offence | Classify **HIGH** |
| `OVR_HNWI` | High-net-worth individual | Classify **HIGH** — **definition/threshold pending** [LUC Q6: term not recognised; follow-up required] |
| `OVR_BLACKLISTED_COUNTRY` | Resident in, or declared active links to, a blacklisted country | **Reject/terminate** (P3.5) |

Non-material adverse media (unrelated to AML/CFT) is **not** an override. It feeds the Customer category as a factor.

## 3. Weighted categories [LUC Q1]

The engine must expose **five categories**. Category weights are **customisable by the tenant on a 0–100 scale** (typically normalised to sum 100 at publish time). Fixed demo defaults below are illustrative only; the product requirement is configurability, not a locked 45/20/15/10/10 split.

| Category | Demo default weight | Factors [SRC] | Onboarding source |
|---|---:|---|---|
| **C1 Customer** | 20 | Purpose of relationship; non-material adverse media; employment status; occupation; prior STRs | Registration form, SOW Q, screening |
| **C2 Geography** | 10 | Residence; nationality; SOW/SOF country | Registration form, SOW Q |
| **C3 Product / Service / Payment** | 15 | Payment method; product type (closed-loop vs open) | Tenant configuration |
| **C4 Delivery channel** | 10 | Face-to-face vs non-face-to-face | Onboarding channel |
| **C5 Transactions** | 45 | Affordability result; change in behaviour; high-risk or high-value transactions | Transaction aggregates (later in lifecycle) |

At onboarding, C5 has little data. Proposed handling [PROV]: at onboarding, C5 takes a neutral default of 0 risk points and is flagged "not yet observable" in data quality. It is recalculated at each trigger or periodic review (P2.8).

### 3.1 Factor scoring [LUC Q2, Q3]

Each factor maps an input value to **risk points from 0 to 100**. The category score is the weighted average of its factors, and the overall score is Σ(category score × category weight).

Product naming: this sheet is the **MITIGA CRA Template v1** scoring sheet. Do not reference former client/vendor working names in docs or UI [LUC Q2].

Occupation/industry and country lists (blacklisted, high-risk, standard) are **provided by MITIGA as starter lists**; each customer **scores / customises risk exposure** for their own policy [LUC Q3].

Demo placeholder maps (until tenant-custom lists are configured):

| Factor | Low (0) | Medium (50) | High (100) |
|---|---|---|---|
| Purpose of relationship | e-commerce | gambling/betting | multipurpose / unclear |
| Employment status | employed | self-employed / retired / student | unemployed with high declared activity |
| Occupation / industry | standard | cash-intensive | high-risk (tenant-scored list) |
| Non-material adverse media | none | 1 hit | multiple hits |
| Prior STRs | none | — | ≥1 |
| Residence / nationality / SOW country | standard | higher-risk (tenant-scored) | high-risk third country (tenant-scored / Commission list) |
| Payment method | bank transfer | card | cash |
| Product | closed-loop | — | open-loop |
| Channel | face-to-face | — | non-face-to-face |
| Affordability result | within | 80–100% of limit | above limit |
| Behaviour change | none | moderate | significant |

## 4. Bands and due-diligence level [LUC Q4, Q7]

| Score | Band | DD level | Required actions [SRC P1.8] | Approval |
|---|---|---|---|---|
| 0 – 35 | LOW | **SDD** | Identify (name, DOB, birth country, nationality, address); verify ID; ongoing screening | None |
| 36 – 75 | MEDIUM | **CDD** | SDD + purpose and intended nature (occupation, employment, nature and purpose of transactions via SOW Q) at the €500 point | None |
| 76 – 100 | HIGH | **EDD** | CDD + SOW/SOF information **and documentation** (P2.7) | **MLRO** required [LUC Q7]. Board only if the MLRO escalates/submits |

**Confirmed [LUC Q4]:** a score of **76 is HIGH**. Implement bands as [0,36), [36,76), [76,100], closed at 100.

## 5. Periodic review [SRC P2.1]

| Band | Review every | Workflow |
|---|---|---|
| LOW | 36 months | Start 3 months before the due date. 3 attempts for POI/POA, PEP confirmation plus SOW Q, and SOW docs. Block 1 month after the due date if incomplete → P3.8 |
| MEDIUM | 24 months | same |
| HIGH | 12 months | same |

Inactive for more than 730 days → dormant (P3.7).

## 6. Transaction trigger rules — MITIGA gambling-industry default [LUC Q5]

These thresholds are the **default for the gambling industry**, not a single-client exception [LUC Q5]. Input: aggregates supplied by the caller (MVP), per customer.

| Code | Metric | Window | Threshold | Required action | If not provided |
|---|---|---|---|---|---|
| `TRG_500_DEROGATION` | Deposits + withdrawals | Lifetime | ≥ €500 | Full KYC (POI + POA) + purpose-of-relationship question | Deposits capped at €500, no accumulation |
| `TRG_2K_180D` | Deposits | 180-day rolling | ≥ €2,000 (gambling purpose; e-commerce goes straight to SOW Q) | SOW questionnaire | Deposits capped below €2k |
| `TRG_AFFORDABILITY` | **Net** deposits | Lifetime from the SOW Q answer date | > affordability limit (from SOW Q or docs) | SOW documents | Deposits capped at affordability; monthly accumulation allowed after the 1st trigger |
| `TRG_10K_180D_LINKED` | **Net** deposits, linked | 180 days from the registration date (resets) | ≥ €10,000 | SOW/SOF documents, unless prior SOW docs already cover it | Capped below €10k; reset only if SOW docs were provided before |
| `TRG_30D_AFFORDABILITY` [SRC P2.2c] | Deposits vs declared income | 30-day rolling | deposits > income | SOF docs; if not covered → escalate to MLRO / STR | Block the triggering transaction |

**Net deposit** = Σ deposits − 90% × Σ (winnings/withdrawals) within the linked period. Winnings outside the period are applied only via a manual compliance parameter (case-by-case).

## 7. Reason codes (initial set)

`OVR_*` (above) · `CAT_C1_HIGH`, `CAT_C2_HIGH`, … · `FACTOR_<key>_{LOW|MEDIUM|HIGH}` · `BAND_LOW|MEDIUM|HIGH` · `DD_SDD|CDD|EDD` · `DATA_MISSING_<field>` · `TRG_*` · `APPROVAL_MLRO_REQUIRED` · `APPROVAL_BOARD_REQUIRED` (only when MLRO escalates) · `REVIEW_DUE_<date>`

## 8. Lucimara decisions (Oct 2026) and remaining follow-ups

| # | Decision | Status |
|---|---|---|
| **Q1** | Create the five categories; weights customisable 0–100. Specific default ranges are secondary to configurability. | **Closed [LUC]** |
| **Q2** | Use MITIGA branding; replace former client/vendor working names in shared product documents. | **Closed [LUC]** — product/docs rename required |
| **Q3** | Occupation and country lists are customisable by the customer; MITIGA provides starter lists, customer scores exposure. | **Closed [LUC]** |
| **Q4** | Score 76 is HIGH. | **Closed [LUC]** |
| **Q5** | Trigger thresholds (€500, €2k/180d, €10k/180d, 90% net) are the gambling-industry default, not one-client-only. | **Closed [LUC]** |
| **Q6** | "HNWI" was not recognised. Need plain-language follow-up (High Net Worth Individual / pessoa de alto patrimônio). Keep override provisional until defined or removed. | **Open** |
| **Q7** | EDD / high-risk: **MLRO yes**. Board only if the MLRO reports/submits (escalation), not for every EDD. | **Closed [LUC]** |
| **Q8** | Question not understood. Rephrase as: which customer fields are **mandatory at first assessment** (name, DOB, nationality, residence, channel, purpose, screening results, etc.) so the API and portal know the minimum intake. | **Open** |

### Suggested follow-up wording for Lucimara

**Q6 (rephrased):** Some methodologies force HIGH risk for a “high-net-worth individual” (someone with very large assets or income). Do you want this rule in MITIGA? If yes, what threshold (e.g. declared income, net deposits, or assets)? If no, we remove it.

**Q8 (rephrased):** When an operator sends a customer for the first CRA assessment, which fields must always be present before the system can run? Example list for you to mark required / optional: full name, date of birth, country of birth, nationality, residence country, onboarding channel (face-to-face or not), purpose of relationship, employment/occupation, screening results (sanctions / PEP / adverse media), and declared income (if known).

## 9. Acceptance (MVP)

- Template v1 is published as an immutable policy version in the demo tenant, under the **MITIGA** name.
- Category weights are configurable (0–100); demo defaults may be used for synthetic cases.
- Occupation/country risk lists are tenant-customisable (starter lists + customer scoring).
- ≥20 synthetic cases produce the expected band, DD level, overrides, triggers and required actions; MLRO is required for HIGH/EDD; board is escalation-only.
- Every result is reproducible from stored inputs plus the policy version (audit pack).
- Q6 and Q8 closed or explicitly deferred before calling the template “signed off”.

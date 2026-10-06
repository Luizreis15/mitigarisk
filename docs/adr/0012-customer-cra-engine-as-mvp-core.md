# ADR 0012 — The customer CRA and due-diligence engine is the MVP core; scoring authority stays in the database

- Status: accepted
- Date: 2026-09-26
- Approved by: the human owner (Edu), via the TASK-030 contract
- Amends: ADR 0007 (scoring authority; see "Relationship to other ADRs")

## Context

Until now the repository described a broad "risk intelligence and operational planning" product for digital businesses and online gaming (PRD v0.1, Brazil-first, Portuguese; PRD v0.2/v0.3 refocused on Malta and the EU). The built platform, however, is a generic foundation plus one real product slice: tenancy, capability-based authorization hardened at the database boundary, versioned immutable policies, a deterministic evaluation, immutable audit evidence and a human final decision — exercised end to end only for a *supplier* subject.

The compliance lead's methodology and ruleset (customer risk assessment with override rules, weighted categories, SDD/CDD/EDD bands, periodic review and linked-transaction triggers) show what the engine must be able to express to be useful to a real obliged entity. The product direction is recorded in `docs/product/PRODUCT-DIRECTION-MVP-25.md`; the policy structure in `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md`; the requirements in `docs/product/PRD-v0.3.md`.

The regulatory driver is the EU Anti-Money Laundering Regulation (AMLR, Regulation (EU) 2024/1624), applicable from 10 July 2027. It lets an obliged entity outsource AML tasks (KYC, screening, monitoring, risk-methodology tooling) but not the decision itself — which matches the principle this platform already implements: the system recommends, the entity decides.

## Decision

**1. Product definition.** MITIGA is a configurable, explainable and auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities.

Guiding principle: *MITIGA does the work; the entity retains the decision.*

**2. The MVP core is the customer CRA engine.** Its components are:

- override (knock-out) rules evaluated before scoring;
- weighted categories with sub-factors and value→points maps;
- risk bands mapped to simplified, standard and enhanced due diligence (SDD / CDD / EDD);
- required actions per band;
- periodic-review scheduling per band;
- transaction trigger rules (evaluated on aggregated totals supplied by the caller — no raw transaction ingestion in the MVP);
- a two-level approval chain (for example MLRO, then board) recorded as immutable decisions;
- an audit pack (inputs, policy version, factor contributions, overrides, decision chain, timestamps) exportable for regulator review.

**3. The supplier slice is kept as the reference implementation, not extended.** It remains the working example of the tenancy, RPC, audit and immutability patterns (tenant-scoped subject, `security definer` write RPCs with explicit authorization, atomic audit event, immutable evidence, separate recommendation and final decision). New product work generalizes those patterns to the customer subject; it does not add features to the supplier flow.

**4. Scoring authority stays in the database.** The score, band, reason codes and data-quality state that count are computed inside `security definer` RPCs from persisted inputs and the tenant's published policy version, never accepted from a caller. TASK-023 established this and the authorization and evidence-integrity work (TASK-026, TASK-028, TASK-029) depends on it: it is what makes a result impossible to forge through the API, a Server Action or a direct database call. The TypeScript engine under `apps/web/lib/domain/evaluation-*` (ADR 0007) is a **non-authoritative reference implementation and test oracle**: it documents the algorithm and lets tests detect drift, but it does not write results. Extending the engine (categories, points maps, overrides) therefore means extending the SQL implementation first, with the TypeScript reference kept in step.

**5. Positioning.** MITIGA is a layer on top of the screening and identity-verification vendors an entity already uses; their outputs (sanctions, PEP, adverse media, identity results) arrive as input fields. It is not an identity vendor, a screening-data vendor, or an automatic STR filer. The beachhead is regulated payment, gaming and e-commerce operators in Malta and the EU, then payment institutions, EMIs and CASPs, then DNFBPs. AI, when introduced, is assistive only; the decision core stays deterministic.

**6. Policy numbers stay DRAFT until the compliance lead signs them off.** The structure is built now; every weight, points map, list, threshold and band boundary in the CRA template is provisional until confirmed. Template v1 is labelled DRAFT wherever it appears, and is published as an immutable policy version only in the demo tenant until sign-off.

## Consequences

- The database gains the CRA concepts (categories, value→points maps, override rules, DD levels, required actions, review dates, a second approval level) as forward-only migrations with negative-authorization tests, following the existing conventions. Every new write path is a `security definer` RPC with explicit authorization and an atomic audit event.
- The TypeScript reference engine must be extended alongside the SQL implementation so drift stays detectable; it must never become a second write path.
- Client code (Server Actions, the future HTTP API, the UI) stays a thin layer over the RPCs; it does not compute or store results.
- Prototype routes and fixture data are not part of the product core and must not be presented as real functionality.
- Scope discipline: the 25-day MVP scope in `docs/product/PRODUCT-DIRECTION-MVP-25.md` is the boundary; investor-deck ambitions, real-time monitoring, case management, vendor connectors, billing, MFA/SSO and BWRA are post-MVP.

## Alternatives considered

- **Make the TypeScript engine authoritative and have the database store results it supplies.** Rejected: any caller with the capability could then submit an arbitrary score; it would undo the guarantee TASK-023 introduced and the integrity properties proven in TASK-026/028/029.
- **Extend the supplier slice into the CRA product.** Rejected: the supplier subject and its screens are a reference, not the domain the entity's compliance team works in; generalizing the patterns to the customer subject is cleaner than growing a supplier-specific model.
- **Build identity verification and screening data into the product.** Rejected: the entity already buys these; competing there dilutes the differentiator (configurable, explainable, auditable methodology and evidence).

## Relationship to other ADRs

- ADR 0002 (English-first, market-neutral): unchanged. The EU regulatory framing is a market focus, not a licence to hard-code jurisdiction-specific document, address, currency or time-zone assumptions into domain contracts.
- ADR 0003 (capability-based authorization) and ADR 0004 (immutable audit and evidence): unchanged; the CRA engine is built on them.
- ADR 0007 (deterministic evaluation engine): its determinism, versioning, reason-code and recommendation-versus-decision rules stand. Any wording there that implies the TypeScript engine is the authority that produces persisted results is superseded by decision 4 above.

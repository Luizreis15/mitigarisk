# PRD — Risk Assessment & Monitoring SaaS

*Product requirements and operating plan document*

**Version:** 0.3

**Status:** Discovery — positioning sharpened against the current KYC/AML vendor landscape

**Date:** September 25, 2026 (supersedes v0.2, September 25, 2026; v0.1, September 11, 2026)

**Initial target market:** iGaming and regulated digital businesses operating out of / licensed in Malta and the EU, serving an international customer base (proposed reference operators: Tipico, Sportingbet, Bet365 — as illustrative client profile, not confirmed prospects)

**Product Owner:** To be named

**Compliance lead:** Lucimara Batista — Head of Compliance, risk company based in Malta

**Technical lead:** Mateus (Kippa Softwares)

*Initial material for evaluation by the system owner and alignment between product, risk, engineering and operations.*

## Change note — v0.1 → v0.2

This version corrects two structural assumptions carried over from the discovery conversations that produced v0.1:

- **Market:** v0.1 assumed a Brazil-first rollout with Brazilian references (COAF, BACEN, Serasa, LGPD). This was incorrect. The product targets **iGaming and other regulated digital businesses operating internationally, out of Malta and the EU** — not Brazil, for now.
- **Language:** v0.1 was written in Portuguese. The codebase is already English-first (ADR 0002), and the target market is English-speaking. This document is written in English to match.

Everything else in v0.1 that was market-agnostic (architecture, security model, testing strategy, governance structure) is preserved in substance and translated here. Everything that was Brazil-specific has been re-derived for the Malta/EU/iGaming context.

An appendix at the end of this document summarizes the current implementation status, based on a technical audit performed September 25, 2026.

## Change note — v0.2 → v0.3

This version does not change market or language — it sharpens focus, using a market-landscape scan of how iGaming operators actually run risk assessment and customer approval today (full detail in the companion document *"Mitiga — Market Analysis: iGaming KYC/AML Landscape & Differentiators"*, same Drive folder). Three concrete changes:

- **Positioning sharpened:** Mitiga is defined explicitly as a policy/explainability/audit layer that sits on top of whatever identity and AML data an operator already buys (SEON, Sumsub, ComplyAdvantage, GBG, etc.) — not a sixth identity-verification vendor competing for the same budget line.
- **Phase 0 has a concrete first deliverable:** a ready-to-activate MGA policy template, encoding the real FIAU/MGA €2,000/30-day risk-assessment trigger, mandatory PEP screening, and the Player Protection Directive's five Markers of Harm — instead of an open-ended "regulatory mapping" task.
- **Less hedging where the market scan gave a real answer:** the responsible-gaming risk dimension and the four reference competitors move from "proposed, to validate" to "confirmed by market research, to formally approve."

## Table of contents

1. Executive summary
2. Context, problem and opportunity
3. Confirmed premises and hypotheses
4. Objectives, outcomes and non-objectives
5. Expected objections and product responses
6. Scope by phase
7. Personas, roles and system views
8. Journeys and operational flows
9. Functional requirements
10. Risk engine and policy engine
11. Solution architecture
12. Frontend
13. Backend
14. API and integrations
15. Data and database
16. Real-time processing and queries
17. Security, privacy and encryption
18. Audit, explainability and regulatory governance
19. Non-functional requirements and service levels
20. Operations, support and incident response
21. Billing model and recurring revenue
22. Owners, team and project governance
23. Execution plan and timeline
24. Quality and testing strategy
25. Operational and technical risks
26. Product, operations and business metrics
27. MVP acceptance criteria
28. Pending decisions
29. Next steps
30. Appendix — current implementation status (audit, Sept 25, 2026)

# 1. Executive summary

The product is a multi-tenant B2B SaaS for risk assessment, classification, monitoring and documentation. It integrates into the operational environment of contracting companies and receives, via API, registration, document and — in later phases — transactional data.

Each contracting company configures its own risk factors, weights, thresholds, accepted countries, policies and risk appetite. The platform combines this information, produces per-dimension scores, an overall classification, reasons, pending items and recommendations. The decision to approve, limit, request further documents or reject a customer remains with the contracting company.

The product has two major moments:

1. **Onboarding and initial risk profile:** classification of the customer before or during entry into the operation.
2. **Continuous monitoring:** comparison of transactions and subsequent behaviour against the initially declared profile.

The MVP should prioritise onboarding, configuration, API, explainability and audit. Transactional monitoring is designed for from the start but activated after the first flow is validated.

### Recommended architecture decision

Start with a **modular monolith**, API-first, with asynchronous processing for long-running tasks. This reduces cost and complexity in the MVP without preventing the future separation of the rules engine, connectors, transactional monitoring and notifications into independent services.

### How many views will there be?

The product will have **seven operational views**, defined by role and permission:

1. SaaS platform administration.
2. Executive management of the contracting company.
3. Administration of the contracting company.
4. Risk and compliance analyst.
5. Operations and support.
6. Audit and read-only.
7. Development and integrations.

Data, API, backend, response and real-time behaviour are platform capabilities that serve these views; they are not standalone user views. The contracting company's end customer will not have their own portal in the MVP.

# 2. Context, problem and opportunity

### 2.1 Problem

Companies exposed to regulatory, financial, operational and reputational risk frequently run assessments in spreadsheets, scattered documents or poorly configurable tools. This causes:

- slow and inconsistent analysis;
- difficulty proving which rule was applied;
- poor traceability of policy changes;
- decisions dependent on individual knowledge;
- weak integration with registration and transaction data;
- difficulty comparing real behaviour with the declared profile;
- higher audit and investigation cost;
- abandonment risk during onboarding of high-velocity digital operations — acutely true in **iGaming**, where a slow KYC/onboarding response directly drives players to a competing operator.

### 2.2 Opportunity

Build a risk infrastructure layer that can be embedded into iGaming operators, payment/settlement providers, and other regulated digital operations. Differentiation will come from combining:

- per-company configuration;
- response speed;
- multiple risk dimensions;
- explainability and audit trail;
- API integration;
- isolation between tenants;
- continuous monitoring;
- assistive intelligence modules without delegating the final decision to an opaque model.

**Why Malta / EU as the base of operations:** Malta is one of the world's principal iGaming licensing jurisdictions (Malta Gaming Authority — MGA), and EU anti-money-laundering directives (AMLD) and GDPR set the compliance bar that operators licensed there — and the vendors that serve them — must meet. Building and operating from Malta, with a Head of Compliance embedded in a Malta-based risk firm, places the product inside the regulatory context of its own target market from day one.

### 2.3 Value proposition

**For iGaming operators and other regulated digital businesses that need to assess customers and operations quickly, the product offers a configurable, integrated and auditable risk engine that turns registration and transactional data into explainable classifications, respecting each contracting company's risk appetite.**

### 2.4 Market position and differentiators

A scan of how operators actually run risk assessment today (see the companion market-analysis document) shows the vendor landscape splits into two families that rarely overlap fully: **fraud/identity specialists at the onboarding moment** (SEON, GBG, Sumsub, iDenfy) and **AML data/screening layers** (ComplyAdvantage, whose data in fact powers Sumsub's own AML screening). Neither family is built as a fully configurable, explainable policy engine that sits across an operator's whole risk apparatus — most still run that part in spreadsheets, exactly the gap Mitiga targets.

Four differentiators follow directly from this:

1. **Complement, don't compete.** Mitiga receives data via API rather than capturing documents itself — an operator keeps its existing SEON/Sumsub/GBG integration for identity, and Mitiga becomes the policy, explainability and audit layer on top, aggregating whatever signals the operator already buys under its own configured weights.
2. **MGA policy template out of the box.** No generic KYC/AML vendor specialises in Malta specifically. Mitiga ships a ready-to-activate template encoding the FIAU/MGA €2,000/30-day risk-assessment trigger, mandatory PEP screening, and the five Markers of Harm from the Player Protection Directive.
3. **No opaque AI in the core decision.** The current market trend is agentic AI triaging alerts — reviewers of those tools flag exactly the trust and threshold-tuning problems this creates. Mitiga's ASM-006 (never an autonomous approval/rejection) and full explainability run against that trend, not with it.
4. **Reason codes portable across regulators.** Operators holding licences in more than one jurisdiction (Malta plus UK, for instance) need evidence that satisfies more than one regulator. Mitiga's reason-code and evidence design (§18.4) is built to be reused across regimes instead of hard-coded to one.

# 3. Confirmed premises and hypotheses

### 3.1 Premises confirmed in discovery conversations

- The product is B2B and will be contracted by companies.
- Each company will have its own policies and risk appetite.
- The product will be multi-tenant, with no automatic sharing of profiles between companies.
- Registration data and documents are collected by the contracting company.
- The platform receives information via integration and calculates risk.
- The tool classifies and explains; the final decision belongs to the contracting company.
- The system must record pending items and insufficient data quality.
- The assessment must generate auditable evidence.
- The product will have an initial profile and transactional monitoring.
- In online gaming, onboarding speed is critical.
- "Agents" are, at this stage, modules or capabilities; autonomous AI is not a core MVP requirement.

### 3.2 Working hypotheses (updated for the Malta/iGaming market)

- The first vertical is **iGaming / online betting operators**, licensed in Malta and/or other EU-recognised jurisdictions, serving international players.
- The first version will be cloud-hosted and sold as SaaS.
- The MVP will use deterministic rules and configurable weights.
- External integrations will be optional and asynchronous.
- The platform will store the minimum necessary for audit; zero retention is incompatible with the requirement for complete evidence.
- The end customer will interact with the contracting company's interface, not directly with the SaaS.
- English is the product's primary language from day one (not a later expansion, as assumed in v0.1).

### 3.3 Decisions still unconfirmed

- Exact pilot country/licensing jurisdiction and operator profile (large-tier operator vs. mid-tier challenger).
- Mandatory external data sources for the EU/iGaming context (sanctions lists, PEP databases, EU AML registries).
- Official turnaround time for a complete response.
- Data retention and residency policy (GDPR-constrained — likely EU data residency requirement).
- Whether the score itself or only the acceptance policy varies per contracting company.
- Whether there will be an operational recommendation beyond the classification.
- Scope of regulatory reporting (MGA, and destination-market regulators where the operator also holds licences).
- Commercial model and pricing (currency: EUR, not BRL).

# 4. Objectives, outcomes and non-objectives

### 4.1 Product objectives

1. Calculate risk consistently and configurably.
2. Reduce the time between registration and response to the company.
3. Make every result explainable by factors and rules.
4. Generate evidence for audit and internal review.
5. Rigorously separate each company's data, policies and users.
6. Integrate the engine into the operational flow via API and webhooks.
7. Allow the profile to evolve based on new information and behaviour.
8. Enable expansion by sector, country and risk dimension.

### 4.2 Measurable outcomes proposed for the pilot

- 100% of assessments linked to an immutable policy version.
- 100% of results with reason codes or an explicit indication of insufficient data.
- Zero cross-tenant access in isolation tests.
- Internal engine response, without third parties, within 2 seconds at the 95th percentile.
- Transactional event receipt confirmation within 500 ms at the 95th percentile.
- Initial monthly availability of 99.9%, after the pilot phase.
- Successful webhook delivery for 99.5% of events, including retries.
- At least a 50% reduction in operational analysis time for the pilot flow.

### 4.3 MVP non-objectives

- Creating a global bureau or a profile shared between companies.
- Replacing the contracting company's decision.
- Guaranteeing the absence of fraud, money laundering or financial loss.
- Acting as a regulatory authority or issuing legal opinions.
- Collecting all data directly from the end customer.
- Offering credit or setting financial limits on its own.
- Automating external reporting to a regulator without legal and human validation.
- Using opaque AI as the sole basis for an adverse classification.
- Serving every sector and country simultaneously at first launch.

# 5. Expected objections and product responses

|  |  |
| :-: | :-: |
| Objection | Product response |
| "We already do this in spreadsheets." | The product adds versioning, consistency, integration, speed, controlled access and an audit trail. |
| "A single score doesn't fit every company." | Policies, weights, thresholds and procedures are configured per tenant. |
| "We don't want to hand our data to a vendor." | The product applies minimisation, encryption, configurable retention and dedicated deployment options for enterprise clients. |
| "If the AI gets it wrong, who is liable?" | The core is deterministic and explainable; AI is assistive. The contracting company retains the final decision. |
| "External integrations could slow onboarding down." | The flow has a preliminary response, asynchronous processing, per-connector deadlines and a final result via webhook. |
| "There will be too many false positives." | Policies support simulation, versioning, calibration, human review and effectiveness metrics. |
| "Integrating yet another vendor is complex." | There is a sandbox, documentation, examples, signed webhooks and versioned API contracts. |
| "A leak between companies would be unacceptable." | Isolation is enforced in authentication, application, database, encryption, testing and observability. |
| "The product seems too generic." | The platform has a common core plus policy packages per vertical, starting with the chosen niche (iGaming). |
| "We can't depend on the platform to authorise every transaction." | The company defines its own contingency procedure; the MVP is not the final decision-maker on the critical path. |
| "How does this fit MGA / EU AML requirements specifically?" | Policy templates and reason codes are designed to map directly onto MGA remote-gaming compliance obligations and EU AMLD customer due-diligence categories, with evidence structured for regulator-facing audit packs. |
| "Why not just buy SEON or Sumsub and be done with it?" | Those tools are strong at fraud signals or identity/document verification, but are not built as a configurable policy and explainability layer across an operator's whole risk apparatus. Mitiga complements them — it aggregates their outputs into one auditable decision surface configured per tenant, rather than replacing the identity layer the operator already trusts. |

# 6. Scope by phase

### 6.1 Phase 0 — Discovery and design

- Definition of pilot niche and jurisdiction.
- Regulatory mapping by a specialist (MGA remote gaming framework, EU AMLD, GDPR) — **concrete output:** a ready-to-activate MGA policy template encoding the FIAU/MGA €2,000/30-day risk-assessment trigger, mandatory PEP screening, and the Player Protection Directive's five Markers of Harm (see §2.4).
- Onboarding data dictionary.
- Risk taxonomy and reason codes.
- Initial API contract.
- Prototype of the main screens.
- Privacy, retention and liability policy.
- Identification of four reference competitors (see §28).

### 6.2 Phase 1 — Onboarding MVP

- Multi-tenancy.
- User, role and permission management.
- Secure authentication and administrative MFA.
- Company portal.
- Policy configuration and versioning.
- Assessment API.
- Completeness and quality validation.
- Deterministic rules and scoring engine.
- Per-dimension and consolidated scores.
- Classification, reasons, pending items and recommendation.
- History, evidence and audit.
- Query and export of assessments.
- Completion webhooks.
- Sandbox and fictitious company for integration.
- Usage measurement for billing.

### 6.3 Phase 2 — Transactional monitoring

- Continuous event ingestion.
- Comparison between declared profile and observed behaviour.
- Velocity, volume, frequency, geography and pattern rules.
- Alerts and prioritisation.
- Case management and investigation.
- Near-real-time dashboards.
- Alert webhooks.
- Retries, idempotency and dead-letter queue.

### 6.4 Phase 3 — Connectors and assistive intelligence

- Identity, document, credit, PEP and sanctions providers (EU/UK/global sanctions lists as a priority for the iGaming context).
- Assisted document extraction.
- Case summaries and analyst recommendations.
- Statistical anomaly detection.
- Calibration based on known outcomes.
- Policy packages by vertical and country.

### 6.5 Phase 4 — Scale and enterprise

- Dedicated environments.
- Per-client encryption keys.
- Corporate SSO and automatic user provisioning.
- Regional data residency (EU residency as a likely default given GDPR).
- Data warehouse and advanced analytics.
- Custom SLA.
- Connector and partner ecosystem.

# 7. Personas, roles and system views

(Unchanged in substance from v0.1 — translated below. This section is market-agnostic.)

### 7.1 View 1 — SaaS administration

**User:** vendor's internal operations team.

**Goal:** administer tenants, plans, platform health and support without accessing sensitive data by default.

- create, suspend and configure companies;
- associate plans, limits and resources;
- track consumption and availability;
- manage feature flags;
- consult operational metadata;
- perform support with temporary, justified, audited access;
- track integration and webhook failures;
- administer global policy templates.

### 7.2 View 2 — Company executive management

**User:** Director of Risk, Compliance or Operations.

**Goal:** understand exposure, trend, volume and policy effectiveness.

- executive dashboard;
- distribution by risk band and dimension;
- volume and alert evolution;
- time and productivity indicators;
- policy version comparison;
- management reports;
- consumption and billing.

### 7.3 View 3 — Company administration

**User:** tenant administrator.

**Goal:** configure the environment and control access.

- users, teams, roles and permissions;
- business units, brands, countries and environments;
- policies, weights, thresholds and procedures;
- API credentials and webhooks;
- data retention;
- notifications;
- external integrations;
- approval and publication of new policies.

### 7.4 View 4 — Risk and compliance analyst

**User:** analyst, officer or investigator.

**Goal:** review assessments, understand reasons and handle exceptions.

- assessment and alert queue;
- customer search within the tenant;
- score explanation;
- positive, negative and pending factors;
- attachments and evidence;
- internal notes;
- requesting additional documentation;
- opening and handling cases;
- re-assessment with new information;
- recording human conclusions.

### 7.5 View 5 — Operations and support

**User:** onboarding or support team.

**Goal:** track status without changing policy or viewing unnecessary data.

- search by external reference;
- assessment status;
- pending items released to support;
- estimated timelines;
- operational result allowed by the role;
- resending a notification;
- escalating to an analyst.

### 7.6 View 6 — Audit and read-only

**User:** internal auditor, external auditor or control officer.

**Goal:** reconstruct decisions and prove controls.

- read-only access;
- policy and assessment history;
- change trail;
- input and output evidence;
- controlled export;
- query by period, user, rule and outcome;
- access and segregation-of-duties reports.

### 7.7 View 7 — Development and integrations

**User:** developer at the contracting company.

**Goal:** integrate, test and operate the communication between systems.

- interactive API documentation;
- per-environment credentials;
- sandbox;
- payload examples;
- technical logs without sensitive data;
- webhook history and retry;
- limits and consumption;
- platform status;
- secret rotation.

### 7.8 Summary access matrix

|  |  |  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Capability | SaaS Admin | Executive | Tenant Admin | Analyst | Operations | Auditor | Dev/API |
| Manage tenant | Yes | No | Partial | No | No | No | No |
| Edit policy | No by default | Approve | Yes | Propose | No | No | No |
| View sensitive data | Emergency | Aggregated | Per role | Yes | Minimal | Controlled | No |
| Handle case | No | No | Optional | Yes | Forward | No | No |
| View audit | Metadata | Aggregated | Yes | Partial | No | Yes | Technical |
| Manage API | No by default | No | Yes | No | No | Query | Yes |
| View billing | Yes | Yes | Yes | No | No | No | Consumption |

# 8. Journeys and operational flows

### 8.1 Initial company configuration

1. SaaS operations creates the tenant and assigns the plan.
2. The company administrator receives an activation invitation.
3. The administrator configures MFA, users and roles.
4. The company chooses a policy template or starts its own configuration.
5. An analyst defines factors, weights, thresholds and procedures.
6. An executive or approver reviews and publishes the policy.
7. A developer creates sandbox credentials.
8. The company tests known cases.
9. After acceptance, production credentials are created.

### 8.2 Onboarding assessment

1. The end customer completes registration with the contracting company.
2. The company validates its own registration and sends a request to the API.
3. The API authenticates the technical client, identifies the tenant and validates the payload contract.
4. The system checks for duplicates via idempotency key.
5. Data is normalised, minimised and assessed for completeness.
6. Optional connectors are triggered according to policy.
7. The engine executes the rules of the published version.
8. The system calculates per-dimension scores, uncertainty and data quality.
9. The aggregator produces the consolidated band.
10. The system returns or publishes the result, reasons and pending items.
11. The company applies its external decision.
12. Evidence and audit trail are recorded.

### 8.3 Quick response and final response

To reconcile speed with external queries:

- **Immediate response:** receipt, basic validation and assessment identifier.
- **Optional preliminary response:** result using available internal data.
- **Final response:** result after mandatory connectors or expiry of the configured deadline.
- **Later update:** re-assessment if a delayed source changes the result.

Every response must state status, policy_version, is_final, data_quality, reason_codes and timestamp.

### 8.4 Transactional monitoring

1. The company sends the event with customer and transaction reference.
2. The API validates, records idempotency and confirms receipt.
3. The event enters a durable queue.
4. The processor retrieves the current profile and applicable policy.
5. Rules evaluate volume, frequency, velocity, geography and deviations.
6. Normal events update behavioural aggregates.
7. Relevant events generate explainable alerts.
8. Alerts may open cases according to configuration.
9. The company receives a webhook and consults the dashboard.
10. Analysts investigate and record the conclusion.

### 8.5 Policy change

1. An authorised user creates a draft based on a published version.
2. Changes are simulated against anonymised data or test cases.
3. The system shows expected impact and differences.
4. An approver publishes the new version.
5. New assessments use the new version.
6. Old assessments retain the original version.
7. Historical reprocessing only occurs via explicit, audited action.

# 9. Functional requirements

Priorities: **P0** mandatory for MVP, **P1** needed for the extended pilot, **P2** future evolution.

### 9.1 Companies and identity

|  |  |  |
| :-: | :-: | :-: |
| ID | Priority | Requirement |
| TEN-001 | P0 | Create a tenant with an immutable identifier, plan, region and status. |
| TEN-002 | P0 | Prevent access to another tenant's data or configuration. |
| IAM-001 | P0 | Authenticate users and require MFA for privileged roles. |
| IAM-002 | P0 | Provide role- and permission-based access control. |
| IAM-003 | P0 | Log login, failure, role change and access elevation. |
| IAM-004 | P1 | Support corporate SSO. |
| IAM-005 | P2 | Support automatic user provisioning and deactivation. |

### 9.2 Policies and configuration

|  |  |  |
| :-: | :-: | :-: |
| ID | Priority | Requirement |
| POL-001 | P0 | Create factors, rules, weights, bands and pending-item rules. |
| POL-002 | P0 | Keep a draft separate from the published version. |
| POL-003 | P0 | Version and make each published policy immutable. |
| POL-004 | P0 | Require approval for publication per the defined segregation of duties. |
| POL-005 | P0 | Offer an initial template per vertical (iGaming first). |
| POL-006 | P1 | Simulate a policy's impact before publication. |
| POL-007 | P1 | Schedule activation and expiry. |
| POL-008 | P2 | Compare performance between versions. |

### 9.3 Assessment and scoring

|  |  |  |
| :-: | :-: | :-: |
| ID | Priority | Requirement |
| ASM-001 | P0 | Create an assessment via API with an idempotency key. |
| ASM-002 | P0 | Validate contract, types, required fields and basic consistency. |
| ASM-003 | P0 | Produce a pending status when required data is missing. |
| ASM-004 | P0 | Calculate per-dimension and consolidated score. |
| ASM-005 | P0 | Return band, reasons, quality and policy version. |
| ASM-006 | P0 | Never issue approval or rejection as an autonomous decision. |
| ASM-007 | P0 | Allow lookup by internal ID and external reference. |
| ASM-008 | P0 | Maintain re-assessment history within the tenant. |
| ASM-009 | P1 | Support preliminary and final responses. |
| ASM-010 | P1 | Allow manual analysis and human conclusion. |

### 9.4 Alerts and cases

|  |  |  |
| :-: | :-: | :-: |
| ID | Priority | Requirement |
| ALT-001 | P1 | Generate alerts from explainable rules. |
| ALT-002 | P1 | Prioritise alerts by severity and risk. |
| CAS-001 | P1 | Open, assign, comment on and close cases. |
| CAS-002 | P1 | Record evidence and human decisions. |
| CAS-003 | P1 | Control internal deadlines and escalation. |
| CAS-004 | P2 | Generate an AI-assisted case narrative draft. |

### 9.5 Audit and reports

|  |  |  |
| :-: | :-: | :-: |
| ID | Priority | Requirement |
| AUD-001 | P0 | Log security, configuration and assessment events. |
| AUD-002 | P0 | Preserve policy version and reason codes. |
| AUD-003 | P0 | Prevent silent alteration of audit events. |
| REP-001 | P0 | Filter and export authorised assessments. |
| REP-002 | P1 | Generate executive and operational reports. |
| REP-003 | P2 | Generate evidence packages for external audit / regulator requests. |

### 9.6 Integrations and notifications

|  |  |  |
| :-: | :-: | :-: |
| ID | Priority | Requirement |
| API-001 | P0 | Version endpoints and contracts. |
| API-002 | P0 | Authenticate systems via machine credentials. |
| API-003 | P0 | Apply limits per tenant and credential. |
| API-004 | P0 | Sign webhooks and allow retries. |
| API-005 | P0 | Provide an isolated sandbox. |
| API-006 | P1 | Allow secret rotation without downtime. |
| CON-001 | P1 | Standardise external connectors behind a common interface. |
| CON-002 | P1 | Apply timeout and circuit breaker per provider. |

### 9.7 Billing and consumption

|  |  |  |
| :-: | :-: | :-: |
| ID | Priority | Requirement |
| BIL-001 | P0 | Meter assessments, transactions, users and connectors used. |
| BIL-002 | P0 | Link tenant to plan and allowance. |
| BIL-003 | P1 | Alert when approaching a limit. |
| BIL-004 | P1 | Generate a reconcilable usage statement. |
| BIL-005 | P2 | Automate upgrade, billing and controlled commercial suspension. |

# 10. Risk engine and policy engine

### 10.1 Conceptual separation

The product has two logical layers:

1. **Risk engine:** interprets data and calculates exposure per dimension.
2. **Policy engine:** applies the company's parameters and produces classification, pending items and recommended action.

The final decision — such as allowing play, granting credit or blocking an operation — remains with the contracting company's system.

### 10.2 Calculation pipeline

Received data → normalisation → validation and completeness → authorised enrichments → per-dimension rules → per-dimension score → quality and uncertainty calculation → weighted aggregation → risk band → reason codes → pending items and recommendation → auditable evidence

### 10.3 Initial dimensions

- money laundering;
- fraud;
- sanctions and terrorist financing;
- credit;
- reputation and image;
- financial;
- operational;
- transactional behaviour;
- *responsible-gaming / player-protection signals* (confirmed as a distinct regulatory requirement, not just a proposal: the MGA Player Protection Directive mandates monitoring of five Markers of Harm — the first being transaction amount/frequency of deposits and wagers — separately from AML. Affordability checks, self-exclusion registry hits and problem-gambling indicators belong here. Exact thresholds and the remaining four Markers still need sign-off with Lucimara.)

The list must be configurable. For the MVP, only the dimensions validated by the vertical specialist will be active.

### 10.4 Proposed score convention

- Numeric scale from 0 to 100.
- 0 represents lowest exposure, 100 highest exposure.
- Each dimension has its own score.
- The consolidated score uses the published policy's weights.
- Low/medium/high bands are configured per tenant.
- Data quality is shown separately from risk.
- Missing data must not be silently confused with proven risk.

### 10.5 Explainability

Every result must include: factors assessed; rules triggered; each factor's contribution; standardised reason codes; missing or inconsistent data; sources consulted; policy version; calculation timestamp; indication of preliminary or final result.

### 10.6 Use of artificial intelligence

In the MVP, AI is not responsible for the core score. Later permitted uses: document field extraction; evidence summarisation; case narrative suggestions; assisted prioritisation; pattern and anomaly detection; help authoring rules. Any AI output must state model, version, context, confidence and whether human review is required when it affects an analysis.

# 11. Solution architecture

### 11.1 Logical view

Contracting company's systems → API Gateway / WAF / machine authentication → Tenant & identity service · Policy & versioning service · Assessment service · Risk & rules engine · Connector orchestrator · Case & audit service · Webhook & notification service · Usage & billing metering → PostgreSQL (transactional) · Redis (cache, locks, idempotency) · Object storage for evidence · Queue / event stream for async processing

### 11.2 Implementation strategy

- Modular monolith in the MVP.
- Clear domain boundaries in code and database.
- Separate async processors for connectors, webhooks and transactions.
- Internal events with versioned contracts.
- Extraction into microservices only when scale, isolation or team size justify it.
- Reproducible infrastructure with separate environments: development, sandbox, staging and production.

### 11.3 Recommended technical stack

This is a recommendation, not an irrevocable decision. *(As of the September 25, 2026 audit, this stack is already the one actually in use — see Appendix.)*

- **Frontend:** React with Next.js and TypeScript.
- **Main backend:** TypeScript, Next.js server actions / equivalent architecture.
- **Future analytical engine:** isolated Python service only when statistical models are required.
- **Transactional database:** PostgreSQL.
- **Cache and idempotency:** Redis.
- **Events:** a managed queue service in the MVP; Kafka or Redpanda only if volume justifies it.
- **Objects and documents:** S3-compatible storage.
- **Authentication:** managed provider with MFA and future SSO support (Supabase Auth, currently).
- **Observability:** structured logs, metrics, traces and centralised alerts.
- **Infrastructure:** containers and infrastructure as code; simple orchestration at first.

### 11.4 Why a modular monolith

- Shorter build time.
- Simpler database transactions.
- Lower operating cost.
- Easier debugging and testing.
- Allows future modules to be separated without taking on microservice complexity too early.

# 12. Frontend

### 12.1 Navigation structure

1. Overview.
2. Assessments.
3. Alerts.
4. Cases.
5. Customers, always tenant-scoped.
6. Policies and rules.
7. Reports and audit.
8. Integrations and API.
9. Users and security.
10. Consumption and billing.

Items not yet available for a given phase must be hidden behind a feature flag.

### 12.2 Experience principles

- Explanation before action.
- Risk, uncertainty and pending status visually distinct.
- Consistent status between interface, API and webhook.
- Reproducible filters and audited exports.
- Reinforced confirmation for publishing policy or changing security settings.
- Accessibility from initial design.
- Sensitive data masked by default.
- Dates, currency (EUR default) and timezone configured per tenant.
- Responsive interface, prioritising desktop for analysts.

### 12.3 P0 screens

Login, MFA and recovery; environment selection; basic dashboard; assessment list and detail; score explanation; pending-items list; policy editor; draft-vs-published comparison; user and role management; credentials, webhooks and sandbox; audit; consumption.

### 12.4 Mandatory states

Every operational screen must anticipate: loading; empty; no permission; recoverable error; integration error; partial data; preliminary result; final result; masked content; service unavailable.

# 13. Backend

### 13.1 Domain modules

|  |  |
| :-: | :-: |
| Module | Responsibility |
| Tenancy | Context, isolation, region, plan and feature flags. |
| Identity & Access | Users, machines, roles, sessions and MFA. |
| Policy | Factors, rules, weights, templates, approval and versions. |
| Assessment | Assessment lifecycle and input normalisation. |
| Scoring | Deterministic execution and score aggregation. |
| Connector | External integrations, timeouts, cache and evidence. |
| Transaction | Ingestion and processing of transactional events. |
| Alert & Case | Alerts, investigation, tasks and human conclusion. |
| Evidence & Audit | Immutable evidence and event reconstruction. |
| Notification | Webhooks, operational emails and retries. |
| Usage & Billing | Metering, allowance, overage and statements. |
| Platform Ops | Health, audited support and global configuration. |

### 13.2 Mandatory patterns

- tenant_id derived from the authenticated identity, never trusted from the request body.
- Idempotency on external commands.
- Concurrency control when editing policies.
- Dates stored in UTC.
- Opaque, non-sequential identifiers in APIs.
- Errors with a stable code and a safe message.
- Logs without national ID, document, address, token or full payload.
- Database transactions at the necessary consistency boundaries.
- Transactional outbox for reliable event publication.
- Feature flags per tenant and environment.

### 13.3 Proposed assessment states

received, validating, pending_data, enriching, scoring, preliminary, completed, manual_review, failed, cancelled. Invalid transitions must be rejected and audited.

# 14. API and integrations

### 14.1 Principles

REST/JSON in the MVP; explicit version in the path; OAuth 2.0 Client Credentials or an equivalent managed mechanism; mandatory idempotency key for creation; HMAC-signed webhooks; cursor-based pagination; stable error codes and formats; limits per tenant, endpoint and credential; OpenAPI as an executable contract; backward compatibility within the major version.

### 14.2 Initial endpoints

|  |  |  |
| :-: | :-: | :-: |
| Method | Endpoint | Purpose |
| POST | /v1/assessments | Create an assessment. |
| GET | /v1/assessments/{id} | Query state and result. |
| POST | /v1/assessments/{id}/supplements | Submit additional information. |
| POST | /v1/assessments/{id}/reassess | Request a new assessment. |
| GET | /v1/policies/active | Query the authorised active version. |
| POST | /v1/transactions | Ingest a transactional event in phase 2. |
| GET | /v1/alerts | Query alerts. |
| GET | /v1/cases/{id} | Query an authorised case. |
| POST | /v1/webhook-endpoints | Configure a webhook destination. |
| GET | /v1/usage | Query consumption. |

### 14.3 Conceptual return example

{
  "assessment_id": "asm_opaque_id",
  "external_reference": "customer-123",
  "status": "completed",
  "is_final": true,
  "policy_version": "policy_2026_09_001",
  "overall": { "score": 72, "band": "high" },
  "dimensions": [
    {"code": "fraud", "score": 81, "band": "high"},
    {"code": "credit", "score": 48, "band": "medium"}
  ],
  "data_quality": { "score": 86, "missing_fields": ["income_source_evidence"] },
  "reason_codes": ["IDENTITY_DATA_MISMATCH", "INCOME_EVIDENCE_MISSING"],
  "recommended_action": "manual_review",
  "calculated_at": "2026-09-25T15:00:00Z"
}

recommended_action is a recommendation configured by the company; it is not a legal or operational decision taken by the SaaS.

### 14.4 Webhooks

Initial events: assessment.preliminary; assessment.completed; assessment.updated; assessment.failed; alert.created; case.updated; usage.threshold_reached.

Requirements: signature and timestamp; replay protection; unique event identifier; at-least-once delivery; consumer must be idempotent; exponential retry; a panel to inspect and resend; controlled discard after a limit, with an alert.

# 15. Data and database

### 15.1 Main entities

Tenant, TenantEnvironment, User/Role/Permission, ApiClient, RiskPolicy, PolicyVersion, RiskDimension, RiskFactor, Rule, CustomerReference, Assessment, InputSnapshot, DimensionScore, ReasonCode, MissingRequirement, TransactionEvent, Alert, Case, Evidence, AuditEvent, WebhookDelivery, UsageRecord, Subscription.

### 15.2 Multi-tenant strategy

MVP recommendation: shared schema with tenant_id on every domain table; Row-Level Security in PostgreSQL; mandatory filter in the application repository; tenant context validated on every request and job; automated isolation tests; keys and caches always tenant-prefixed; no broad administrative query without special permission and audit. For enterprise clients, offer a dedicated database, schema or environment in the future.

### 15.3 Data classification

**Public:** approved marketing material. **Internal:** configuration and metrics without personal identification. **Confidential:** policies, scores, reports and commercial data. **Restricted:** national ID/passport, address, date of birth, documents, evidence and credentials.

### 15.4 Proposed retention

Configurable per tenant and category. Final periods depend on legal and contractual validation — **under GDPR, this needs explicit legal basis and a documented retention schedule, and EU data residency is a likely requirement** given Malta/EU operations. Separate operational data, calculation evidence and security logs. Allow anonymisation once full identification is no longer necessary. Support controlled deletion and holds for retention obligations. Backups must respect a documented, encrypted expiry.

### 15.5 Zero retention

A minimal-retention processing mode can be created, but there is a structural conflict: reconstructing an assessment requires knowing the inputs, policy and result. Options: (1) retain a full encrypted snapshot; (2) retain only derived fields, hashes and minimal evidence; (3) leave full evidence with the contracting company and store only a signed reference. The choice is contractual and technical; it must not be promised before an auditable-reconstruction proof exists.

# 16. Real-time processing and queries

### 16.1 Definitions

**Synchronous onboarding:** simple internal calculation returned in the same call. **Asynchronous onboarding:** assessment depends on third parties or long processing. **Near-real-time monitoring:** event confirmed quickly and processed via queue. **Inline decision:** response required before the company continues the transaction; not recommended for the MVP.

### 16.2 Proposed technical targets

|  |  |
| :-: | :-: |
| Operation | Initial target |
| Receipt confirmation | p95 up to 500 ms |
| Score with internal data only | p95 up to 2 s |
| Assessment query | p95 up to 500 ms |
| Dashboard update | up to 5 s after processing |
| Initial webhook delivery | up to 5 s after completion |
| Assessment with third parties | connector-specific deadline, with timeout |

### 16.3 Event architecture

The API confirms after validating and persisting the event. Heavy processing happens outside the request. Events carry tenant, version, correlation and idempotency. Ordering is guaranteed when necessary per customer or account. Failures go to retry and an exception queue. Transactional aggregates are updated incrementally. The dashboard receives updates via periodic query; SSE or WebSocket only if the experience requires it.

### 16.4 Contingency

The company must choose and document behaviour when the SaaS is unavailable: continue with conservative limits; send to manual review; keep the transaction pending; apply a local contingency rule. The SaaS must not impose automatic blocking without validated contract, architecture and legal risk assessment.

# 17. Security, privacy and encryption

### 17.1 Principles

Privacy by design; least privilege; deny by default; separation of duties; defence in depth; evidence of every privileged action; no sensitive information in ordinary logs.

### 17.2 Encryption

TLS 1.3 for external traffic wherever supported; TLS between sensitive internal components; AES-256-GCM or an equivalent managed service for data at rest; envelope encryption with keys protected by KMS/HSM; keys separated per environment, with a per-tenant key option for enterprise clients; field-level encryption for critical documents and identifiers; secrets stored in a vault, never in code or a common database; documented rotation of keys, secrets and credentials; backups and exports also encrypted.

### 17.3 Identity and access

MFA for administrators and privileged analysts; short sessions for critical actions; authorisation enforced in the backend regardless of interface; enterprise SSO in a later phase; machine accounts separated from human accounts; minimal API scopes; temporary, approved, justified and logged support access; periodic access review.

### 17.4 Data protection

Masking of national ID/passport, documents and address in the interface; tokenisation or pseudonymisation for internal references; automatic redaction in logs and observability tools; download and export subject to permission and audit; development environments without real data; synthetic test data; privacy impact assessment before the pilot.

### 17.5 Development security

Mandatory code review; dependency and secret scanning; static, dynamic and API testing; threat modelling per critical flow; dedicated tenant-isolation tests; penetration testing before regulated clients go live; vulnerability management with severity-based deadlines; pinned and verified images and dependencies.

### 17.6 Privacy responsibilities

The contract must define contracting company, operator/processor, sub-processors, purpose, legal basis, retention, data-subject requests, incident handling and international transfer — **under GDPR (not LGPD)**, given Malta/EU operations and an international customer base. These definitions require legal validation; the product must not assume them through architecture alone.

# 18. Audit, explainability and regulatory governance

### 18.1 Minimum evidence per assessment

Tenant and environment; external reference and internal identifier; requesting technical identity; receipt and completion timestamps; API contract version; policy version; factors and rules executed; sources consulted; per-dimension scores; consolidated classification; quality and pending items; reason codes; human changes or conclusions; hash or reference of the evidence used.

### 18.2 Immutability

Published policies cannot be edited; corrections generate a new version; audit events must be append-only; exports must contain an identifier and an integrity hash; required deletions must generate a record without retaining inappropriate content.

### 18.3 Segregation of duties

A policy's creator should not necessarily be able to publish it; an analyst must not retroactively change the rule used; a technical administrator must not close a risk case without permission; SaaS support must not access sensitive data by default.

### 18.4 Regulatory reporting

In the MVP, the platform organises evidence and internal exports. Automatic submission to authorities is out of scope until jurisdiction, format, responsibility, signature and human review are validated. **Primary regulatory reference for this market: the Malta Gaming Authority (MGA) remote-gaming compliance framework, EU anti-money-laundering directives (AMLD), and GDPR** — replacing the Brazil-specific COAF/BACEN references from v0.1. Where an operator holds licences in additional jurisdictions (e.g. UK Gambling Commission), reason codes and evidence packs should be structured to be reusable across regimes, without hard-coding any single regulator's format into the core engine.

# 19. Non-functional requirements and service levels

### 19.1 Availability and continuity

Initial target of 99.9% monthly after the pilot; critical components distributed across zones where the provider allows; automatic backups and periodic restore tests; proposed RPO of 15 minutes; proposed RTO of 4 hours on the standard plan; enterprise plans may contract higher targets.

### 19.2 Performance

Per-endpoint targets monitored at the 95th and 99th percentile; load testing with a fictitious company; protection against noisy tenants; mandatory pagination on collections; heavy queries executed asynchronously; indexes driven by real query patterns.

### 19.3 Scalability

Stateless application where possible; horizontally scalable workers; event partitioning per tenant or reference; history archiving per retention policy; explicit usage limits per plan.

### 19.4 Observability

Product, infrastructure and integration metrics; structured logs with correlation; distributed tracing on critical flows; alerts tied to customer impact, not just CPU usage; SLO and error-budget dashboard; per-connector status.

### 19.5 Compatibility and accessibility

The two most recent versions of major corporate browsers; interface following recognised accessibility practices; language and regional formatting decoupled from code.

# 20. Operations, support and incident response

### 20.1 Environments

Local development without real data; shared development environment; per-tenant sandbox for integration; staging close to production; production with reinforced controls.

### 20.2 Deployment process

1. Reviewed change and automated tests.
2. Backward-compatible migration.
3. Deployment to staging.
4. Smoke and contract tests.
5. Gradual production rollout.
6. Metrics and error monitoring.
7. Rollback or feature-flag disablement when necessary.

### 20.3 Support

|  |  |  |
| :-: | :-: | :-: |
| Severity | Example | Proposed initial response |
| S1 | Broad outage, leak or integrity risk | 15 minutes, contracted coverage |
| S2 | Degraded critical function or halted assessments | 1 hour |
| S3 | Partial failure with a workaround | 4 business hours |
| S4 | Question, enhancement or cosmetic issue | 1 business day |

Definitive times will depend on plan and operational capacity.

### 20.4 Incident response

Detection and automatic opening; naming an Incident Commander; containment and data protection; communication via a defined channel and cadence; evidence preservation; recovery and validation; blameless root-cause analysis; action plan with owner and deadline; legal assessment of mandatory notifications (**including GDPR's 72-hour breach-notification requirement**).

### 20.5 Minimum runbooks

API unavailable; queue backlog; degraded external connector; failing webhook; suspected cross-tenant leak; compromised credential; divergent score; incorrect policy publication; migration failure; backup restoration.

# 21. Billing model and recurring revenue

### 21.1 Recommended model

Combination of recurring subscription and consumption: (1) implementation fee — configuration, integration, template and training; (2) platform monthly fee — access, users, environments, support and allowance; (3) overage usage — assessments and transactional events beyond the allowance; (4) external connectors — pass-through or margin on third-party lookups; (5) add-ons — SSO, dedicated environment, own key, SLA, reports and special retention.

### 21.2 Conceptual plans

|  |  |  |
| :-: | :-: | :-: |
| Plan | Audience | Suggested structure |
| Pilot | First use case | One environment, limited users, assisted onboarding and support. |
| Growth | Scaling digital / iGaming operators | Larger allowance, advanced policies, webhooks and monitoring. |
| Enterprise | Regulated or high-volume operations | Annual contract, SSO, dedicated environment, SLA and expanded security. |

Do not set prices before measuring cost per assessment, cost per connector, infrastructure, support and willingness to pay. **Pricing currency: EUR** (not BRL, as assumed in v0.1).

### 21.3 Billing unit

Possible units: initiated assessment; completed assessment; re-assessment; thousand transactional events; external source lookup; active user; investigated case; additional storage and retention. Recommendation: charge a monthly fee with an assessment/transaction allowance, overage by usage, and connectors billed separately. User count should not be the primary limiter, as that discourages internal adoption.

### 21.4 Recurrence and contracts

Monthly upfront billing for standard plans; annual option with a commercial discount; enterprise contracts with minimum commitment and negotiated volume; daily metering with monthly close; alerts at 70%, 90% and 100% of the allowance; grace period and a non-disruptive delinquency procedure for critical flows.

### 21.5 Financial metrics

MRR and ARR; implementation revenue tracked separately from recurring revenue; net revenue per tenant; gross margin; cost per assessment and per thousand transactions; expansion, contraction and churn; net revenue retention; customer acquisition cost payback period.

# 22. Owners, team and project governance

### 22.1 Required owners

|  |  |
| :-: | :-: |
| Role | Main accountability |
| Sponsor/Founder | Vision, capital, strategic decisions and market access. |
| Product Owner | PRD, prioritisation, scope and functional acceptance. |
| Project Manager | Timeline, dependencies, risks and communication. |
| Risk/Compliance Specialist | Factors, rules, cases and regulatory validation (Lucimara Batista). |
| Tech Lead/Architect | Architecture, technical standards and engineering decisions (Mateus, Kippa Softwares). |
| Backend Owner | API, engine, integrations and consistency. |
| Frontend Owner | Portal, experience, accessibility and design system. |
| Data/Risk Engine Owner | Scoring model, data, quality and calibration. |
| Security/Privacy Owner | Threats, controls, incidents and privacy (GDPR). |
| DevOps/SRE Owner | Environments, delivery, observability and continuity. |
| QA Owner | Test strategy and quality evidence. |
| Customer Success Owner | Company onboarding, training and adoption. |
| Finance/Billing Owner | Plans, metering, invoicing and margin. |

One person may hold multiple roles at the start, but every area needs a nominal owner before development.

### 22.2 Summary RACI

|  |  |  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Deliverable | Sponsor | Product | Compliance | Tech Lead | Engineering | Security | QA |
| Niche and value proposition | A | R | C | C | I | I | I |
| Taxonomy and rules | I | A | R | C | C | C | C |
| Architecture | I | C | C | A/R | R | C | C |
| Data model | I | C | C | A | R | C | C |
| Security and privacy | I | C | C | C | R | A/R | C |
| UX and flows | I | A | C | C | R | C | C |
| Quality and acceptance | I | A | C | C | R | C | R |
| Pilot | A | R | R | C | C | C | C |
| Go-live | A | R | C | R | R | R | R |

Legend: **R** executes, **A** accountable for the result, **C** consulted, **I** informed.

### 22.3 Governance cadence

Engineering daily: 15 minutes. Sprint planning and review: fortnightly. Business demo: fortnightly. Product & risk committee: weekly during discovery and pilot. Security review: at each major milestone. Executive steering: monthly. Architecture decision records for structural changes. Risk register updated weekly.

### 22.4 Suggested minimum team

1 Product Owner/PM; 1 risk/compliance specialist with meaningful dedication (Lucimara); 1 full-stack Tech Lead (Mateus/Kippa); 2 backend engineers; 1 frontend engineer; 1 QA with automation; shared DevOps/SRE and security initially; part-time UX/UI during discovery and portal build.

# 23. Execution plan and timeline

Estimate for an already-formed minimum team. Not a commercial commitment until data, integrations and team are confirmed.

### Stage 0 — Closed discovery, 2 to 3 weeks

Resolve the ten critical decisions; shortlist four competitors; define the pilot and use case; close the data dictionary; define taxonomy and a sample policy; approve wireframes; validate the liability and retention model (GDPR-aligned). **Output:** PRD 1.0, prototype and prioritised backlog.

### Stage 1 — Platform foundation, 3 to 4 weeks

Repositories, environments and continuous delivery; tenancy, identity and authorisation; database structure; basic audit; API gateway and credentials; portal skeleton. **Output:** tenant created, users authenticated and sandbox accessible. *(Per the September 25, 2026 audit, this stage is substantially complete — see Appendix.)*

### Stage 2 — Engine and onboarding, 5 to 6 weeks

Policy editor and versioning; input validation; rules engine; scores and reason codes; assessment API; webhooks; list and detail screens. **Output:** complete flow executed with a fictitious company. *(Per the audit, a first real slice — supplier evidence and final decision — exists; the broader onboarding flow described here is still mostly prototype.)*

### Stage 3 — Audit, operations and billing, 3 to 4 weeks

Full trails; reports and exports; pending-item management; consumption metering; operational dashboards; runbooks and support. **Output:** pilot candidate.

### Stage 4 — Security, load and pilot, 3 to 4 weeks

Isolation and security testing; load and failure testing; backup restoration; pilot fixes; training and acceptance. **Output:** MVP in controlled production.

### Indicative timeline

**16 to 21 weeks** for the pilot MVP, after requirements, team and external dependencies are closed.

### Transactional monitoring

Add 6 to 10 weeks after onboarding stabilises, depending on volume, rules and the need for inline decisions.

# 24. Quality and testing strategy

### 24.1 Test pyramid

Unit tests on the engine and rules; property tests for score boundaries; integration tests with database, queue and cache; API and webhook contract tests; end-to-end tests of critical journeys; database migration tests; load, spike and soak testing; controlled chaos testing on connectors and queues; security and authorisation testing; explicit tenant-isolation testing.

### 24.2 Mandatory synthetic cases

Low-risk customer with complete data; high-risk customer with multiple factors; insufficient data; inconsistent information; duplicate request; unavailable connector; policy changed during assessment; re-assessed customer; cross-tenant access attempt; out-of-order transactional event; unavailable webhook; large registration spike.

### 24.3 Definition of Done

A deliverable is only done when: acceptance criteria are met; relevant automated tests pass; authorisation and isolation were tested; logs and metrics were added; no sensitive data is in logs; migration and rollback were assessed; API and operational documentation was updated; the change was validated in staging; the Product Owner accepted the behaviour; an operational owner and runbook exist for the critical function.

# 25. Operational and technical risks

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| Risk | Probability | Impact | Mitigation | Owner |
| Cross-tenant leak | Low | Critical | RLS, layered authorisation, tests, encryption and access review. | Security + Tech Lead |
| Incorrect score from a faulty rule | Medium | High | Versioning, simulation, review, golden cases and rollback. | Risk Engine Owner |
| Poorly configured company policy | High | High | Templates, validation, dual approval and a simulation environment. | Product + Compliance |
| Lack of auditable evidence | Medium | High | Minimal snapshot, immutable policy, append-only audit and a reconstruction test. | Compliance + Backend |
| External provider unavailability | High | Medium/High | Timeout, circuit breaker, permitted cache, partial response and fallback. | Backend Owner |
| Slow onboarding and abandonment | Medium | High | Fast path, async processing, latency targets and per-connector metering. | Tech Lead + Product |
| Excessive false positives | High | High | Calibration, human review, metrics and per-version tuning. | Compliance |
| False negatives | Medium | Critical | Test cases, post-hoc monitoring, rule review and feedback. | Compliance + Data |
| PII in logs or support | Medium | Critical | Redaction, masking, logging policies and automated tests. | Security |
| Scope too broad | High | High | One niche, one jurisdiction, onboarding first, strict change criteria. | Product Owner |
| Dependency on a single specialist | High | High | Documentation, workshops, peer review and a decision matrix. | Sponsor |
| Unpredictable third-party cost | Medium | High | Metering per lookup, limits, pass-through and contracts. | Finance + Product |
| Duplicate or out-of-order events | High | Medium | Idempotency, versioning, sequencing and deterministic processing. | Backend Owner |
| Regulatory change (MGA / EU AMLD) | Medium | High | Configurable policies, legal monitoring and template updates. | Compliance |
| Misuse of AI | Medium | High | Assistive AI, human review, model logs and a ban on opaque decisions. | AI/Data + Security |
| Billing model failure | Medium | High | Telemetry from the MVP, paid pilots and margin analysis. | Finance + Sponsor |
| CI/branch discipline erosion (merging with failing checks) | Medium | Medium | Branch protection requiring green checks before merge; documented in the Sept 25 audit as already observed once. | Tech Lead |

# 26. Product, operations and business metrics

### 26.1 Product

Time to first valid assessment; percentage of completed assessments; percentage pending due to missing data; average and p95 assessment time; manual review rate; distribution by risk band; reason-code usage; adoption by user profile.

### 26.2 Risk effectiveness

Confirmed and dismissed alerts; false positives and false negatives, where a known outcome exists; time to investigate an alert; percentage of re-assessments that change band; rules with the highest contribution and highest dismissal rate; data coverage per dimension.

### 26.3 Technical operations

Availability; p50/p95/p99 latency; errors per endpoint; queue depth and lag; webhook success rate; per-connector failure and latency; incidents by severity; observed RPO/RTO in tests; isolation violations: zero target.

### 26.4 Business

MRR and ARR; pilot-to-contract conversion; implementation time; revenue and margin per tenant; consumption expansion; churn and net revenue retention; support cost per tenant; unit cost per assessment and per thousand transactions.

# 27. MVP acceptance criteria

The MVP is ready for pilot when:

1. Two fictitious companies operate with zero cross-access.
2. An administrator configures and publishes a versioned policy.
3. The API receives an idempotent assessment and validates its payload.
4. The engine returns scores, band, reasons, quality and pending items.
5. The same input can be assessed by different policies without contaminating tenants.
6. The company receives the result via query and a signed webhook.
7. An auditor can reconstruct which policy and which factors produced the result.
8. Sensitive data is encrypted and masked.
9. Access profiles prevent unauthorised actions.
10. Load tests meet agreed targets.
11. Backups are restored successfully in a documented exercise.
12. Runbooks and alerts exist for critical failures.
13. Consumption per tenant is metered and reconcilable.
14. The risk specialist approves the synthetic cases.
15. The Product Owner signs off on the pilot.

# 28. Pending decisions

The ten answers below are needed to turn this PRD into v1.0. Where I've proposed a working answer based on the corrected market context, it is marked *(proposed — validate with Lucimara)*; it is not a confirmed decision.

1. What will be the first pilot niche, jurisdiction and company type? *(proposed: an EU/Malta-licensed iGaming operator, mid-tier size — to validate)*
2. Which fields and documents will be mandatory at onboarding?
3. Which external sources will be used, who contracts them and who pays for each lookup? *(likely candidates: EU/UK/global sanctions and PEP screening providers — to validate)*
4. What turnaround time is acceptable for a preliminary and a final response?
5. What data may the SaaS store, and for how long? *(GDPR-constrained; EU data residency likely required)*
6. Will the base score be common with only acceptance varying by company, or will the entire calculation be customised per company?
7. Which dimensions and factors will form the first real policy? *(a responsible-gaming/player-protection dimension is now confirmed as regulatorily required, not just proposed — see §10.3; the specific thresholds within it still need sign-off)*
8. Will the return include only classification, or also a recommended action and pending items?
9. What registration and transaction volume is expected in year one?
10. What minimum hosting, security, audit and certification requirements do the first clients have? *(likely to include MGA-related technical/organisational measures and ISO 27001 expectations common among EU enterprise buyers — to validate)*

**Four reference competitors/products** — now backed by an actual market scan (see companion document), not a guess: **SEON** (digital-footprint fraud detection at signup), **Sumsub** (identity/document/biometric KYC, AML screening via a ComplyAdvantage partnership), **ComplyAdvantage** (the AML/sanctions/PEP data layer several other vendors build on), and **GBG** (identity verification plus fraud, risk-profiling framing close to Mitiga's own language). None of the four ships a fully configurable, explainable policy engine as their center of gravity — that gap is where Mitiga's positioning sits (§2.4). Still needs: formal sign-off from Lucimara that these four are the right reference set, plus any Malta-specific compliance boutique she knows directly.

# 29. Next steps

1. Name the Sponsor, Product Owner, risk specialist (Lucimara) and Tech Lead (Mateus).
2. Answer the ten pending decisions, now scoped to the Malta/EU/iGaming market.
3. Confirm four reference competitors.
4. Select the pilot company and flow.
5. Hold a taxonomy and risk-factors workshop — with explicit attention to iGaming-specific factors (player protection, source of funds for high-value players, geo-blocking for restricted markets).
6. Create the data dictionary and payload examples.
7. Validate privacy, retention and legal liability under GDPR.
8. Design wireframes for the seven views.
9. Produce the physical architecture and threat model.
10. Estimate the backlog with the responsible team.
11. Approve PRD 1.0, timeline and budget.
12. Start the technical foundation and sandbox. *(Already underway — see Appendix.)*

## Cumulative decision log (v0.2 + v0.3)

|  |  |
| :-: | :-: |
| Decision | Status |
| B2B, multi-tenant product | Adopted |
| No shared global profile | Adopted |
| Contracting company keeps the final decision | Adopted |
| API-first | Adopted |
| **Market corrected: Malta/EU + international iGaming, not Brazil** | **Adopted, v0.2** |
| **Language corrected: English throughout, matching ADR 0002** | **Adopted, v0.2** |
| Onboarding as the first MVP | Recommended, pending approval |
| Transactional monitoring as the next phase | Recommended, pending approval |
| Modular monolith | Recommended — **and already the implemented architecture per the Sept 25, 2026 audit** |
| Deterministic rules in the initial core | Recommended, pending risk validation |
| Seven operational views | Recommended, pending user validation |
| Hybrid billing: subscription and consumption | Recommended, pending commercial validation; currency EUR |
| **Positioning: policy/explainability/audit layer on top of existing KYC/AML vendors, not a competing identity-verification product** | **Adopted, v0.3** |
| **Four reference competitors identified: SEON, Sumsub, ComplyAdvantage, GBG** | **Confirmed by market scan, v0.3 — pending Lucimara sign-off** |

# Appendix — Current implementation status (technical audit, September 25, 2026)

This appendix summarises an independent technical audit of the repository (base origin/main @ 4c79eac) performed the same week this PRD was corrected. Full detail lives in a separate audit document; this is the executive summary relevant to product planning.

|  |  |  |
| :-: | :-: | :-: |
| Dimension | Status | Summary |
| Tenant isolation / database authorisation | Green | 46 RLS policies, 218 SQL assertions, three independent hardening cycles closed 7 classes of bypass. |
| Real product slice (suppliers) | Amber | Complete in code and database; never exercised in an authenticated browser against a hosted Supabase project. |
| PRD coverage | Red (expected at this stage) | MVP-P0 tenancy/policy/assessment/audit are well covered; missing: API v1, webhooks, sandbox, billing, exports, MFA, real policy/case screens. |
| CI / delivery governance | Red | main's test job was failing since merge; a one-line fix was open in an unmerged PR at audit time. |
| Environments | Amber | Local + CI + Vercel preview exist; no separate staging/production, no verified hosted Supabase project. |
| Repository hygiene | Amber | Local main branch far behind; stale worktrees; a merge landed with a red check. |

### Top five priorities coming out of the audit

1. Merge the pending one-line CI fix so main goes green again.
2. Provision a real verification environment (local Supabase via Docker, or a fictitious-data staging project) and prove the real slice end-to-end in a browser.
3. Fix the real-vs-demo confusion: 19 prototype routes are reachable without authentication and could be mistaken for real functionality in a demo.
4. Harden database grants (least privilege) and move extensions out of the public schema.
5. Hold the product session to answer the ten pending decisions in §28 of this PRD — nothing in the risk engine is "real" from a business standpoint until a real policy exists.

Read alongside this PRD: the audit independently reached the same conclusion as §6/§28 above — **the PRD's scope is still large relative to the one real slice built so far**, and the recommended path is to keep advancing one module at a time (assessment history → policy publication with validation → members → cases → API/webhooks) rather than broadening in parallel.

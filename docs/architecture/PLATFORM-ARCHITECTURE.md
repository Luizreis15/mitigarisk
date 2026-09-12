# MITIGA platform architecture — baseline

## Architecture decision

The MVP is an API-first modular monolith. It provides clear domain boundaries and one deployable application while product rules are still changing. Components may be extracted into services only after measured scaling, isolation, ownership, or regulatory needs justify the cost through an ADR.

## Bounded contexts

| Context | Responsibility |
|---|---|
| Identity and access | Users, memberships, roles, MFA/SSO policy, sessions |
| Tenancy | Companies, environments, plans, quotas, feature entitlements |
| Risk policy | Factors, weights, thresholds, versions, simulation and publication |
| Evaluation | Input validation, deterministic scoring, reasons, recommendations |
| Monitoring | Event intake, profile comparison, rules, alerts and prioritization |
| Cases | Assignment, SLA, evidence, notes, decisions and escalation |
| Integrations | API keys, webhooks, connectors, idempotency and delivery state |
| Audit | Append-only evidence, actors, correlation, exports and retention |
| Billing | Metering, subscriptions, invoices and entitlement state |
| Notifications | Templates, email requests, delivery and failure events |
| Platform operations | Tenant health, incidents, support access and observability |

## Runtime baseline

- Web and backend-for-frontend: TypeScript application in `apps/web/`.
- Database, authentication, storage, and selected realtime channels: Supabase.
- Transactional email: Resend, always called from server-side code.
- Background work: durable job boundary for evaluations, webhook delivery, imports, and email events; provider chosen when the first asynchronous slice is implemented.
- Contracts: versioned HTTP APIs and signed webhooks with idempotency keys.
- Observability: structured logs, correlation IDs, metrics, traces, and audit events without raw sensitive data.

## Multi-tenancy and authorization

Tenant membership is explicit. Every tenant-owned record carries `tenant_id`; PostgreSQL row-level security is defense in depth and enabled by default. Server-side services verify both identity and permission. Support impersonation, if introduced, must be time-limited, reason-bound, visibly indicated, and audited.

Initial roles are platform super admin, tenant owner/admin, risk analyst, operator, auditor/read-only, and developer/integration. Permission capabilities are authoritative; role names are convenient bundles.

## Risk and audit invariants

Every risk result references immutable policy and model versions, normalized inputs or their approved evidence, reason codes, data-quality state, timestamps, tenant, correlation ID, and responsible actor or service. Published policies are immutable; changes create a new version. A recommendation never silently becomes the customer's final business decision.

## Supabase boundary

- Browser code uses only the project URL and public anonymous key.
- Privileged operations use server-side credentials and a narrow repository/service boundary.
- RLS policies are versioned and tested with positive and negative tenant cases.
- Storage buckets separate tenant content and apply path plus policy controls.
- Realtime subscriptions expose only authorized, minimal event payloads.
- Production, staging, and development use separate projects or rigorously isolated environments.

## Resend boundary

The application stores an internal notification request before sending. Resend message IDs are mapped to internal IDs. Webhook signatures are verified and events are idempotent. Delivery, bounce, complaint, and suppression states are retained without placing secrets or unnecessary personal data in logs.

## Data protection

Use TLS in transit, provider-managed encryption at rest, field-level protection where classification demands it, minimization, purpose-bound retention, and deletion/anonymization workflows. Keep secrets in environment secret stores and rotate them by environment. Production data is not used in development fixtures.

## API rules

External write endpoints require authentication, authorization, idempotency, schema validation, stable error codes, rate limits, and a correlation ID. Webhooks are signed, versioned, retried with backoff, and moved to a dead-letter state after the retry budget.

## Language, locale, and international markets

English is the authoritative product language. Runtime copy is externalized into typed catalogs and remains separate from stable reason codes, API errors, and audit actions. The provisional default locale is `en-US`, but tenant and user preferences control presentation.

Store timestamps in UTC and display them in an explicit IANA time zone. Represent currencies with ISO 4217 codes and integer minor units. Country, legal entity identifiers, personal documents, addresses, phone numbers, regulatory sources, retention, and data residency are modeled through country or policy configuration rather than Brazilian assumptions.

## Environments and delivery

Use development, preview, staging, and production. Pull requests produce isolated previews; `main` may deploy to staging automatically. Production promotion is explicit and uses the same tested artifact. Database changes follow expand/migrate/contract when compatibility is required.

## Initial repository evolution

Keep the existing web app intact while establishing contracts. Add domain and data modules inside it first. Extract `packages/contracts`, `packages/domain`, or a worker application only when multiple runtime consumers appear; do not create empty architecture for its own sake.

# ADR 0002 — English-first and market-neutral product

- Status: accepted
- Date: 2026-09-12
- Decision owner: product owner

## Context

MITIGA will be sold primarily to companies whose working language is English. Treating English as a later translation would allow Brazilian terminology, document formats, addresses, currency, time zones, regulatory assumptions, and user journeys to become embedded in the product and data model.

## Decision

English is the product's source language from the beginning. All customer-facing interface copy, transactional email, onboarding content, exported reports, support material, and operational terminology are authored in English.

The default application locale is provisionally `en-US`, while number, date, time, currency, and time-zone presentation remains configurable by tenant and user. Internal timestamps use UTC, currencies use ISO 4217 codes and integer minor units, and country-specific identity or regulatory requirements live in versioned policy packs.

User-facing strings are externalized from components into typed message catalogs. Stable API fields, reason codes, audit actions, code identifiers, migrations, and technical documentation use English. Display messages are not used as programmatic identifiers.

The architecture must support future locales without making Portuguese the hidden source language. English-first does not mean US-only: addresses, names, phone numbers, business identifiers, identity documents, and risk rules must not assume one country unless a policy pack explicitly does so.

## Consequences

- The current Portuguese prototype is a visual reference, not merge-ready product copy.
- Cursor must replace Portuguese routes, fixtures, labels, messages, metadata, and screenshots with the English-first structure.
- Claude must keep domain and database contracts market-neutral and model locale, country, currency, and time zone explicitly where relevant.
- Product discovery and the PRD require an English, international-market revision rather than a literal translation.
- Regional legal, compliance, retention, and data-residency decisions remain separate launch-market decisions requiring human approval.

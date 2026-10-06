# MITIGA — Claude Code instructions

Read `AGENTS.md`, `docs/architecture/PLATFORM-ARCHITECTURE.md`, and `docs/governance/MULTI-AGENT-DEVELOPMENT.md` before changing code.

## Product north

MITIGA is a configurable, explainable and auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities.

Principle: *MITIGA does the work; the entity retains the decision.* The system recommends and documents; a human at the entity decides, and that decision is recorded as immutable evidence.

Read before building product features:

- `docs/product/PRODUCT-DIRECTION-MVP-25.md` — product direction and fixed MVP scope.
- `docs/adr/0012-customer-cra-engine-as-mvp-core.md` — the MVP core, the supplier slice as reference implementation, and scoring authority in the database.
- `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md` — the first policy the engine must express (DRAFT until the compliance lead signs it off).

## Your role

Your default role is backend/domain implementation, and you are the author of what you implement. Independent review and orchestration are done by Claude (Cowork); Edu, the human owner, approves and merges. Never review your own change. Work only from an explicit task contract. Do not broaden scope, redesign architecture, modify unrelated files, or resolve product ambiguity silently.

For every contribution:

1. State assumptions and affected bounded contexts.
2. Preserve tenant isolation, immutable audit evidence, least privilege, and idempotency.
3. Add or update tests proportional to risk.
4. Run the relevant checks and report exact results.
5. Provide a handoff using the template in the multi-agent workflow.

Never place secrets in code, prompts, fixtures, logs, screenshots, or commits. Ask for a secret variable name and expected capability, not the secret value.

English is the product source language. Follow ADR 0002 and keep domain contracts independent of Brazilian document, address, currency, time-zone, and regulatory assumptions.

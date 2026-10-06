# MITIGA application instructions

- Product: MITIGA is a configurable, explainable and auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities. Direction: `../../docs/product/PRODUCT-DIRECTION-MVP-25.md`; decision record: `../../docs/adr/0012-customer-cra-engine-as-mvp-core.md`.
- Roles: Claude (Cowork) is the orchestrator and independent reviewer; Edu, the human owner, is the merge owner and approver; Claude Code implements backend/domain work and Cursor implements the frontend. Material product and production decisions require human approval.
- Task contracts live in `../../docs/tasks/`; review reports live in `../../docs/reviews/`. The author of a change is never its reviewer.
- Use short-lived branches from `main`; never implement directly on `main` after bootstrap.
- Read `../../docs/governance/MULTI-AGENT-DEVELOPMENT.md` before delegating or merging work.
- Read `../../docs/architecture/PLATFORM-ARCHITECTURE.md` before changing boundaries, data models, authentication, tenancy, or integrations.
- Keep Supabase, Resend, database, and provider secrets only in ignored local environment files or the deployment secret store.
- Every change must identify its tenant-isolation, auditability, privacy, and rollback impact.
- Prefer a modular monolith for the MVP. Do not introduce a service unless an ADR justifies it.
- English is the source language for UI, email, reports, support content, code, contracts, commits, and technical identifiers.
- Follow ADR 0002: externalize user-facing copy and keep locale, currency, country, and time-zone behavior market-neutral.

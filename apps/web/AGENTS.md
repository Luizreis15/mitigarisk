# MITIGA application instructions

- Codex acts as technical orchestrator and merge owner; material product and production decisions require human approval.
- Use short-lived branches from `main`; never implement directly on `main` after bootstrap.
- Read `../../docs/governance/MULTI-AGENT-DEVELOPMENT.md` before delegating or merging work.
- Read `../../docs/architecture/PLATFORM-ARCHITECTURE.md` before changing boundaries, data models, authentication, tenancy, or integrations.
- Keep Supabase, Resend, database, and provider secrets only in ignored local environment files or the deployment secret store.
- Every change must identify its tenant-isolation, auditability, privacy, and rollback impact.
- Prefer a modular monolith for the MVP. Do not introduce a service unless an ADR justifies it.
- UI text is Portuguese (Brazil) by default; code, contracts, commits, and technical identifiers use English.

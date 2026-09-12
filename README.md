# MITIGA

MITIGA is a multi-tenant risk intelligence and operational planning SaaS for digital businesses and online gaming operations. It combines configurable policies, explainable scoring, case management, monitoring, APIs, audit evidence, and platform governance.

## Current status

- Product discovery and PRD: initial version complete.
- Visual identity and design system: approval candidate complete.
- Web application: scaffolded in `apps/web/`; product views are the next milestone.
- Supabase and Resend: architecture prepared; credentials and environments are not connected yet.

## Repository map

- `apps/web/` — web application and product interface.
- `docs/` — PRD, architecture, governance, ADRs, and agent prompts.
- `artifacts/` — design sources and selected lightweight visual assets.
- `.cursor/rules/` — persistent implementation rules for Cursor.
- `AGENTS.md` — persistent project rules shared by coding agents.
- `CLAUDE.md` — persistent project rules for Claude Code.

## Governance

Codex operates as the technical orchestrator and merge owner. Cursor and Claude Code work from bounded task contracts on short-lived branches. Humans remain accountable for business, legal, production, billing, and data-protection decisions.

Start with:

1. `docs/governance/MULTI-AGENT-DEVELOPMENT.md`
2. `docs/architecture/PLATFORM-ARCHITECTURE.md`
3. `docs/prompts/PROMPT-ORCHESTRATION.md`
4. `CONTRIBUTING.md`

## Security

Never paste or commit Supabase service-role keys, database passwords, Resend API keys, webhook secrets, or production tokens. Use `apps/web/.env.local` locally and the hosting secret store in deployed environments.

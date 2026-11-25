# MITIGA

MITIGA is a configurable, explainable and auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities.

*MITIGA does the work; the entity retains the decision.* It sits on top of the screening and identity vendors an entity already uses, and turns their outputs into a documented risk rating, a due-diligence level, the required actions and a human decision trail that stands up to the regulator. The first policy it must express is the compliance lead's CRA methodology (DRAFT until signed off).

Direction and scope: [`docs/product/PRODUCT-DIRECTION-MVP-25.md`](docs/product/PRODUCT-DIRECTION-MVP-25.md) · requirements: [`docs/product/PRD-v0.3.md`](docs/product/PRD-v0.3.md) · decision record: [`docs/adr/0012-customer-cra-engine-as-mvp-core.md`](docs/adr/0012-customer-cra-engine-as-mvp-core.md).

## Current status

As of 24 Nov 2026. The capability-by-capability state, with the migration, route or test behind each claim, is in [`docs/STATUS.md`](docs/STATUS.md); this section only summarizes it.

Real today:

- The customer CRA flow end to end: customer record, database-computed assessment against the published policy, required actions, MLRO and board decisions, and an audit pack per customer.
- Transaction trigger checks on aggregated totals entered by a user.
- Views for each role in a tenant-scoped workspace at `/workspace`, member invitations, bulk customer import from CSV, a portfolio report, and a platform console at `/platform`.
- Database authorization hardened at the boundary: row-level security, `security definer` write RPCs with explicit authorization, platform-administrator and suspended-tenant isolation, append-only evidence and audit.
- A hosted Supabase project runs these migrations. The repository does not record which ones are applied at a given moment.

Not real yet:

- The policy editor and case management exist only as prototype screens with fixture data, reachable only when `ENABLE_PROTOTYPE_ROUTES=true`. They are not product functionality.
- No HTTP API, webhooks, billing, MFA/SSO, automatic transaction ingestion or vendor connectors.
- The application sends no email of its own. Authentication emails are sent by Supabase Auth through SMTP (`docs/auth/hosted-auth-configuration.md`).
- The policy numbers are DRAFT until the compliance lead signs them off.

The technical entry point is [`docs/architecture/TRD.md`](docs/architecture/TRD.md): the five invariants no change may violate, an index of the ADRs, and the runtime shape.

## Repository map

- `apps/web/` — web application (Next.js on Vinext, TypeScript).
- `supabase/` — forward-only migrations, seed data, the disposable local verification harness (`supabase/tests/`) and the hosted demo-tenant script (`supabase/scripts/hosted/`).
- `docs/` — the status board (`docs/STATUS.md`), product (`docs/product/`), architecture and the TRD (`docs/architecture/`), ADRs, governance, security, audits, task contracts (`docs/tasks/`), review reports (`docs/reviews/`) and agent prompts.
- `scripts/` — repository gates (`check-secrets.sh`, `verify-web.sh`, `npm-audit-gate.mjs`) and the hosted demo-tenant renderer (`scripts/hosted/`).
- `.githooks/` — the pre-commit hook.
- `.cursor/rules/` — persistent implementation rules for Cursor.
- `AGENTS.md` — persistent project rules shared by coding agents.
- `CLAUDE.md` — persistent project rules for Claude Code.

## Governance

Claude (Cowork) is the orchestrator and independent reviewer: it writes task contracts, sequences work and performs the independent review. Edu, the human owner, is the merge owner and approver. Claude Code implements backend/domain work and Cursor implements the frontend, each from a bounded task contract on a short-lived branch. Humans remain accountable for business, legal, production, billing, and data-protection decisions.

The contracts in `docs/tasks/` end at TASK-037. The pull requests merged after #10, up to #45, have no contract there (#46 is TASK-037); `docs/tasks/README.md` records what is known about each contract.

Start with:

1. `docs/STATUS.md`
2. `docs/architecture/TRD.md`
3. `docs/governance/MULTI-AGENT-DEVELOPMENT.md`
4. `docs/architecture/PLATFORM-ARCHITECTURE.md`
5. `docs/prompts/PROMPT-ORCHESTRATION.md`
6. `CONTRIBUTING.md`

## Security

Never paste or commit Supabase service-role keys, database passwords, Resend API keys, webhook secrets, or production tokens. Use `apps/web/.env.local` locally and the hosting secret store in deployed environments.

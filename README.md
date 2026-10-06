# MITIGA

MITIGA is a configurable, explainable and auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities.

*MITIGA does the work; the entity retains the decision.* It sits on top of the screening and identity vendors an entity already uses, and turns their outputs into a documented risk rating, a due-diligence level, the required actions and a human decision trail that stands up to the regulator. The first policy it must express is the compliance lead's CRA methodology (DRAFT until signed off).

Direction and scope: [`docs/product/PRODUCT-DIRECTION-MVP-25.md`](docs/product/PRODUCT-DIRECTION-MVP-25.md) · requirements: [`docs/product/PRD-v0.3.md`](docs/product/PRD-v0.3.md) · decision record: [`docs/adr/0012-customer-cra-engine-as-mvp-core.md`](docs/adr/0012-customer-cra-engine-as-mvp-core.md).

## Current status

Real today:

- Authentication (Supabase Auth, cookie sessions) and a protected, tenant-scoped workspace at `/workspace`.
- One real product slice — the supplier flow (supplier, fictional evidence, database-computed evaluation, final decision by the company admin). It is the reference implementation of the tenancy, RPC, audit and immutability patterns.
- Database authorization hardened at the boundary: row-level security, `security definer` write RPCs with explicit authorization, platform-administrator and suspended-tenant isolation, immutable evaluation evidence and append-only audit, verified by 218 SQL assertions and 223 application tests.

Not real yet:

- Most routes (company, operator, policies, cases, entities, super-admin) are prototype screens with fixture data. They are not product functionality.
- No public API, webhooks, billing or transaction monitoring.
- The migrations are not applied to a hosted Supabase project, and Resend email sending is not implemented.

Next: the CRA engine — categories with value→points maps, override rules, SDD/CDD/EDD levels and required actions, transaction triggers, a two-level approval chain, API v1 and the audit pack (see the product direction for the fixed scope).

## Repository map

- `apps/web/` — web application (Next.js on Vinext, TypeScript).
- `supabase/` — forward-only migrations, seed data, and the disposable local verification harness (`supabase/tests/`).
- `docs/` — product (`docs/product/`), architecture, ADRs, governance, security, task contracts (`docs/tasks/`), review reports (`docs/reviews/`) and agent prompts.
- `scripts/` — repository gates (`check-secrets.sh`, `verify-web.sh`).
- `.cursor/rules/` — persistent implementation rules for Cursor.
- `AGENTS.md` — persistent project rules shared by coding agents.
- `CLAUDE.md` — persistent project rules for Claude Code.

## Governance

Claude (Cowork) is the orchestrator and independent reviewer: it writes task contracts, sequences work and performs the independent review. Edu, the human owner, is the merge owner and approver. Claude Code implements backend/domain work and Cursor implements the frontend, each from a bounded task contract on a short-lived branch. Humans remain accountable for business, legal, production, billing, and data-protection decisions.

Start with:

1. `docs/governance/MULTI-AGENT-DEVELOPMENT.md`
2. `docs/architecture/PLATFORM-ARCHITECTURE.md`
3. `docs/prompts/PROMPT-ORCHESTRATION.md`
4. `CONTRIBUTING.md`

## Security

Never paste or commit Supabase service-role keys, database passwords, Resend API keys, webhook secrets, or production tokens. Use `apps/web/.env.local` locally and the hosting secret store in deployed environments.

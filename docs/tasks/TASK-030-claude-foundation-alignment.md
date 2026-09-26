# TASK-030 — Foundation alignment with the CRA product direction

Owner: Claude Code (implementation) · Reviewer: orchestrator (Claude, Cowork) · Approver/merge: Edu (human owner)
Status: **Approved — 26 Sep 2026 (Edu)**
Branch: `docs/foundation-alignment-cra`, created from `origin/main` after `git fetch origin`. If PR #2 (`fix/ci-node22-strip-types`) is already merged, the branch will include it.

## Objective

Update the repository's persistent instructions and product docs so that every agent (Claude Code, Cursor) reading the repo builds toward the current product: **a configurable, explainable, auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities**. The first policy is Lucimara's methodology.

This is a documentation-only task.

## Why

The repo still describes the previous direction:
- The README describes "risk intelligence and operational planning… online gaming".
- The only PRD in the repo is v0.1 (Brazil, Portuguese).
- AGENTS.md, CLAUDE.md, CONTRIBUTING.md and the governance docs name **Codex** as orchestrator and merge owner.
- The 14 Sep reports and the 35-day plan are superseded.

Agents read these first, so they must be accurate.

## Inputs (read in full before editing)

These files live outside the repo:
- `/Users/samiragouvea/Desktop/Mitiga/docs/produto/02-Product-Direction-and-MVP-25.md` (**authoritative product direction**)
- `/Users/samiragouvea/Desktop/Mitiga/docs/produto/03-CRA-and-Due-Diligence-Policy-Template-v1.md` (policy spec, DRAFT)
- `/Users/samiragouvea/Desktop/Mitiga/docs/produto/PRD-Risk-Assessment-SaaS-v0.3.md` (PRD v0.3, exported from Drive)
- `/Users/samiragouvea/Desktop/Mitiga/docs/produto/01-Analise-dos-Arquivos-da-Lucimara.md` (PT-BR analysis; context only, do not commit)

## In scope

1. **Product docs in the repo (English):**
   - Add `docs/product/PRD-v0.3.md` (copy of the export; keep the content, fix only formatting).
   - Add `docs/product/PRODUCT-DIRECTION-MVP-25.md` (copy of 02).
   - Add `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md` (copy of 03).
   - Move `docs/product/PRD-SaaS-Gestao-de-Riscos-v0.1.md` to `docs/product/archive/` with a one-line SUPERSEDED header pointing to v0.3 and the product direction.
2. **ADR 0012 — `docs/adr/0012-customer-cra-engine-as-mvp-core.md`.** It records:
   - **Decision:** the MVP core is a customer CRA and due-diligence engine. The components are: override rules, weighted categories with value→points maps, SDD/CDD/EDD bands, required actions, periodic review, transaction trigger rules, a two-level approval chain, and the audit pack.
   - **The supplier slice is kept** as the reference implementation of the tenancy, RPC, audit and immutability patterns. It is not extended.
   - **Scoring authority stays in the database**, inside security-definer RPCs. TASK-023 established this and TASK-026/028/029 depend on it. The TypeScript engine (ADR 0007) is a non-authoritative reference and test oracle. This supersedes any wording in ADR 0007 that implies otherwise.
   - **Positioning:** the platform is a layer on top of the entity's existing screening and IDV vendors, which provide screening results as inputs. The beachhead is regulated payment, gaming and e-commerce operators in Malta and the EU.
   - **The policy numbers stay DRAFT** until Lucimara signs them off. The structure is built now.
3. **README.md:** rewrite the intro, current status and governance to match the product direction and the real state:
   - real today: auth, workspace, supplier slice, hardened DB authorization (218 SQL assertions);
   - prototype routes still exist;
   - next: the CRA engine.
   Keep the security section.
4. **Governance.** In AGENTS.md, apps/web/AGENTS.md, CLAUDE.md, CONTRIBUTING.md, `docs/governance/MULTI-AGENT-DEVELOPMENT.md`, `docs/prompts/PROMPT-ORCHESTRATION.md` and `.cursor/rules/00-mitiga-core.mdc`, set:
   - **Orchestrator and independent reviewer:** Claude (Cowork). It writes task contracts, sequences work and performs the independent review.
   - **Merge owner and approver:** Edu, the human owner. Codex is no longer part of the workflow.
   - **Implementation:** Claude Code (backend/domain), Cursor (frontend).
   - **Task contracts** live in `docs/tasks/`; review reports live in `docs/reviews/`.
   - Keep every existing security rule (no secrets, English-first, tenant isolation, author ≠ reviewer).
   - CLAUDE.md must add a short **"Product north"** section: the one-line product definition, the principle "MITIGA does the work; the entity retains the decision", and pointers to the product direction, ADR 0012 and the policy template.
5. **Superseded reports.** Add a SUPERSEDED header (pointing to the product direction) to:
   - `docs/reports/2026-09-14-construction-status-and-35-day-plan.md`
   - `docs/reports/2026-09-14-lucimara-executive-brief.md`
6. **Architecture doc.** Add a short section to `docs/architecture/PLATFORM-ARCHITECTURE.md` naming the "Customer Risk Assessment" bounded context and pointing to ADR 0012. Do not restructure the document.
7. Write the handoff in this contract file, saved as `docs/tasks/TASK-030-claude-foundation-alignment.md`.

## Out of scope

- Any code, migration, test, seed or dependency change.
- Deleting files other than the PRD v0.1 move into `archive/`.
- Rewriting historical task contracts or reviews.
- Committing `01-Analise…` (PT-BR, internal).

## Acceptance criteria

1. `grep -ri "codex" AGENTS.md CLAUDE.md CONTRIBUTING.md apps/web/AGENTS.md docs/governance docs/prompts .cursor/rules README.md` returns nothing, except explicit historical notes ("previously Codex").
2. The README, CLAUDE.md and ADR 0012 all state the same one-line product definition.
3. PRD v0.3, the product direction and the policy template exist under `docs/product/`; v0.1 is archived with a SUPERSEDED header.
4. `./scripts/check-secrets.sh` and `git diff --check` pass; `npm test` and the build are unaffected (docs only).

## Rules

- Conventional Commits in English, docs scope (`docs(product): …`, `docs(adr): …`, `docs(governance): …`), with no agent names in subjects.
- No push, no merge; do not touch `main` or `integration/*`.
- Do not read `.env`/`.env.local`; no hosted services.
- You are the author, not the reviewer.

## Expected handoff

The standard template, plus the list of files changed with a one-line summary each and the output of the acceptance grep.

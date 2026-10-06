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

## Handoff

**Outcome:** Documentation-only alignment done. The repository now describes the current product (a configurable, explainable and auditable CRA and Due-Diligence engine for EU obliged entities), records the decision in ADR 0012, and names the current roles. No code, migration, test, seed or dependency was changed. The PT-BR analysis (`01-Analise…`) was not committed.

**Branch and commits:** `docs/foundation-alignment-cra`, created from `origin/main` at `4c79eac`. **PR #2 (`fix/ci-node22-strip-types`) is not merged yet** (state OPEN at setup), so this branch does not include the CI test-script fix; on Node 22.13 the `web-quality` job will still fail here until PR #2 lands (docs-only branch, unrelated to this change).

```text
f3b2558 docs(task): add TASK-030 foundation alignment contract
549c773 docs(product): add PRD v0.3, MVP-25 direction and CRA policy template
ca45559 docs(adr): record the customer CRA engine as the MVP core
be0b074 docs(governance): align roles and product north with the current workflow
1062669 docs(product): rewrite README for the CRA product direction
b345430 docs(product): mark superseded reports and name the CRA context
```

Final content commit: `b345430`. This handoff is recorded in the commit that follows it (a commit cannot contain its own hash); the branch tip at delivery is reported in the reply.

**Files changed (19):**

- `docs/tasks/TASK-030-claude-foundation-alignment.md` (A) — the approved contract and this handoff.
- `docs/product/PRD-v0.3.md` (A) — PRD v0.3 export; content unchanged, formatting only (2-space list indent normalised, `1.  ` → `1. `, trailing spaces stripped; verified identical modulo whitespace).
- `docs/product/PRODUCT-DIRECTION-MVP-25.md` (A) — product direction and fixed 25-day MVP scope (byte-identical copy of input 02).
- `docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md` (A) — CRA and due-diligence policy template v1, DRAFT (byte-identical copy of input 03).
- `docs/product/archive/PRD-SaaS-Gestao-de-Riscos-v0.1.md` (R) — PRD v0.1 moved with a one-line SUPERSEDED header pointing to v0.3 and the direction.
- `docs/adr/0012-customer-cra-engine-as-mvp-core.md` (A) — decision record: CRA engine is the MVP core; supplier slice kept as reference, not extended; scoring authority stays in the database; positioning; policy numbers DRAFT.
- `docs/adr/0007-deterministic-evaluation-engine.md` (M) — status line amended to point to ADR 0012 (TS engine is a non-authoritative reference/test oracle). Not in the contract's file list; added because the contract asks that ADR 0012 supersede any conflicting wording there — reviewer to confirm.
- `README.md` (M) — new intro/one-line definition, real-versus-prototype status, next milestone, corrected repository map (removed the non-existent `artifacts/`), governance; security section kept.
- `AGENTS.md` (M) — product one-liner and pointers; roles (Claude Cowork orchestrator/reviewer, Edu merge owner, Claude Code backend, Cursor frontend); contracts/reviews locations.
- `apps/web/AGENTS.md` (M) — same roles/product bullets with relative paths.
- `CLAUDE.md` (M) — new "Product north" section (one-liner, principle, pointers to direction, ADR 0012 and policy template); role section updated (author never reviews own change).
- `CONTRIBUTING.md` (M) — review/merge sentence: Claude (Cowork) reviews, Edu approves and merges; contracts in `docs/tasks/`.
- `docs/governance/MULTI-AGENT-DEVELOPMENT.md` (M) — operating model, role table and merge steps reassigned; one explicit historical note about Codex; all merge gates and the handoff/task templates unchanged.
- `docs/governance/MERGE-RUNBOOK.md` (M) — merge performed by Edu after orchestrator review; the `worktrees/codex` command replaced by a historical note. Not in the contract's file list but inside the acceptance grep's `docs/governance` scope.
- `docs/prompts/PROMPT-ORCHESTRATION.md` (M) — prompts retitled/reworded for the orchestrator, the Claude Code implementation owner and the independent reviewer/merge recommender; reviewer prompt no longer used by the author role.
- `.cursor/rules/00-mitiga-core.mdc` (M) — product north and roles bullets.
- `docs/reports/2026-09-14-construction-status-and-35-day-plan.md` (M) — SUPERSEDED header.
- `docs/reports/2026-09-14-lucimara-executive-brief.md` (M) — SUPERSEDED header.
- `docs/architecture/PLATFORM-ARCHITECTURE.md` (M) — short "Customer Risk Assessment context" section before "Runtime baseline"; nothing else restructured.

**Acceptance grep** (`grep -rin "codex" AGENTS.md CLAUDE.md CONTRIBUTING.md apps/web/AGENTS.md docs/governance docs/prompts .cursor/rules README.md`), output — only explicit historical notes remain:

```text
docs/governance/MERGE-RUNBOOK.md:20:Any other worktree still present (for example the legacy `codex` one, kept only for history) is checked the same way before anything is merged from it.
docs/governance/MULTI-AGENT-DEVELOPMENT.md:5:... (Previously Codex filled the orchestrator and merge-owner roles; it is no longer part of the workflow.)
```

**Acceptance criteria:**

1. Grep: only the two historical notes above — met.
2. One-line definition ("MITIGA is a configurable, explainable and auditable Customer Risk Assessment (CRA) and Due-Diligence engine for EU obliged entities.") is byte-identical in `README.md`, `CLAUDE.md` and `docs/adr/0012-customer-cra-engine-as-mvp-core.md` (also in `AGENTS.md` and the direction document) — met.
3. PRD v0.3, the product direction and the policy template exist under `docs/product/`; v0.1 archived with a SUPERSEDED header — met.
4. `check-secrets` and `git diff --check` pass; `npm test` unchanged at 223/223 — met.

**Checks and exact results** (Node v24.11.1, npm 11.6.2):

| Check | Result |
|---|---|
| `./scripts/check-secrets.sh` | exit 0 — "Secret check passed." |
| `git diff --check origin/main` | exit 0 |
| `npm ci` (apps/web) | exit 0 |
| `npm test` (apps/web) | exit 0 — 223 tests, 223 pass, 0 fail, 0 skipped |
| `git status` after `npm ci` | clean (no tracked changes) |

**Security/tenant/audit impact:** none — documentation only. No secret read or written; no `.env*` opened; no hosted service touched.

**Decisions and assumptions:**

- The ADR 0007 amendment and the MERGE-RUNBOOK edit go slightly beyond the contract's literal file list; both are required by its stated intent and acceptance grep and are flagged above.
- README status lines are limited to facts verified in the 25 Sep audit (218 SQL assertions, 223 tests, prototype routes, unapplied hosted migrations, Resend not implemented); the transient CI state is deliberately not stated in the README.
- PRD v0.3 contains named individuals and a reference-operator list exactly as exported; kept unchanged per the contract ("keep the content").
- Docs referenced by the new files but outside this task (e.g. `docs/reviews/` review reports for TASK-026/028/029 currently live only in the orchestration folder) were not moved.

**Known limitations:** the branch does not include PR #2, so the Node 22.13 unit-test CI job stays red on this branch; historical task contracts and reviews still mention Codex (out of scope); no rendered-Markdown preview was checked.

**Recommended reviewer:** the orchestrator (Claude, Cowork), independent review per `docs/governance/MULTI-AGENT-DEVELOPMENT.md`.

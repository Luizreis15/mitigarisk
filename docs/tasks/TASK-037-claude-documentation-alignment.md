# TASK-037 — Documentation alignment: status board, consolidated TRD, README

Owner: Claude Code · Reviewer: orchestrator (Claude, Cowork) · Approver/merge: Edu
Status: **Draft — 24 Nov 2026. Implemented in pull request #46.**
Branch: `docs/documentation-alignment`, created from `origin/main`.

## Objective

Stop requiring archaeology to learn the state of the system. Today the only reliable way to know what is built is to read migrations and route folders; the README describes September; the technical reasoning is spread across twelve ADRs with no entry point; and one task contract lives outside version control.

Documentation only. No migration, no schema change, no application code, no dependency change. If any part of this task seems to require one, stop and report it.

## Inputs

- `README.md` — the "Current status" section is stale.
- `docs/adr/0001` … `0012` — the real technical reasoning.
- `docs/architecture/PLATFORM-ARCHITECTURE.md` and `docs/contracts/INTEGRATION-BOUNDARIES.md`.
- `docs/product/PRODUCT-DIRECTION-MVP-25.md` — the fixed MVP scope.
- `supabase/migrations/` (34 files) and `apps/web/app/` — the ground truth for what exists.
- `TASK-036-claude-cra-lucimara-template-parity.md` — currently only in Google Drive, outside this repository. Ask Edu for the file; do not reconstruct it from memory.

## In scope

### 1. Status board — `docs/STATUS.md`

One row per capability, with the real state, derived from code and migrations rather than from intent.

- Columns: capability · state (`built` | `partial` | `prototype` | `not started`) · evidence (migration filename, route path or test file) · note.
- Cover at least: tenancy and authorization, policy versioning, CRA v2 engine, customer assessment, transaction triggers, decision chain, audit pack, bulk import, portfolio report, member invitations, platform console, policy editor, HTTP API, webhooks, MFA/SSO, billing, transaction ingestion, vendor connectors.
- A capability is `built` only if a migration or route exists and a test exercises it. Anything reachable only under `ENABLE_PROTOTYPE_ROUTES` is `prototype`, never `partial`.
- State every claim against evidence. Where you cannot find evidence either way, write `unknown` and say what you looked at. Do not infer state from a task contract: contracts record intent, not delivery.
- Add a line to `CONTRIBUTING.md` requiring this file to be updated in the same PR as any change that moves a capability between states.

### 2. Consolidated TRD — `docs/architecture/TRD.md`

An entry point, not a rewrite. No decision is restated in full and no ADR is superseded.

- Open with the five invariants no change may violate, each with the ADR that establishes it and the test or trigger that enforces it:
  - policy is data, never code;
  - the evaluator is a pure function — no clock, no randomness, no network, no database;
  - published policy versions, assessments, decisions and audit events are append-only, enforced by trigger rather than by application discipline;
  - the system produces a recommendation; only an identified human produces a decision;
  - the tenant is a hard boundary, verified by negative-authorization tests.
- Then an index: one line per ADR saying what question it answers and when to read it.
- Then the runtime shape in one page: where scoring authority lives, what the TypeScript engine is for, what the client layer may and may not do.
- Then a short section naming what is deliberately not decided yet, so a reader stops looking: HTTP API shape, webhook delivery semantics, policy editor model, list-versioning strategy.
- Link it from `README.md` and from `docs/architecture/PLATFORM-ARCHITECTURE.md`. Do not move or edit the ADRs.

### 3. README rewritten to today

- Replace "Current status" with what is actually true as of this branch, citing `docs/STATUS.md` rather than repeating it.
- Remove the claims that there is no transaction monitoring and that migrations are not applied to a hosted project, both now false.
- Keep the repository map, governance and security sections; correct anything in them that drifted.

### 4. TASK-036 into version control

- Commit `docs/tasks/TASK-036-claude-cra-lucimara-template-parity.md` from the file Edu provides, unchanged except for a `Status:` line.
- Add a `Status:` line to every contract in `docs/tasks/` that lacks one, using only evidence already in the repository (a merge commit, a review report under `docs/reviews/`, or an ADR that records the outcome). Where there is no evidence, write `Status: **Unknown — not reconstructed**`. Do not guess.
- Add a short note in `docs/tasks/` recording that TASK-027 and TASK-031 do not exist, if you can establish from git history whether they were cancelled or renumbered. If you cannot, say so in the note.

## Out of scope

- Any change to `apps/web/**`, `supabase/**` or `scripts/**`.
- Editing, renumbering or superseding any existing ADR.
- Rewriting the PRD or the product direction.
- Creating a backlog, a roadmap or an estimate. The status board records state, not plans.

## Acceptance criteria

- `docs/STATUS.md` exists, every row cites evidence by filename or path, and no row contradicts the repository.
- `docs/architecture/TRD.md` exists, names the five invariants with their enforcing mechanism, and indexes all twelve ADRs.
- `README.md` contains no statement that the repository contradicts.
- `docs/tasks/TASK-036-*.md` is tracked in git, and every contract has a `Status:` line.
- CI is green. No file outside `docs/`, `README.md` and `CONTRIBUTING.md` is modified.

## Rules

- Evidence over intent, everywhere. A sentence you cannot point at a file for does not go in.
- Where the repository and a document disagree, the repository wins and the disagreement is recorded.
- Uncertainty is written down as uncertainty. `unknown` is an acceptable answer; a confident wrong one is not.
- One PR.

## Expected handoff

In the PR description: the capability count by state; each place where a document disagreed with the code and what you did; anything you marked `unknown` and what would resolve it; and any claim in the existing docs you believe is wrong but did not change because it falls outside this scope.

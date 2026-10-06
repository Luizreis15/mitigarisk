# Multi-agent development and merge protocol

## Operating model

MITIGA uses one repository and one integration authority. Claude (Cowork) is the orchestrator and independent reviewer: it decomposes work, writes task contracts in `docs/tasks/`, sequences work, reconciles architecture, performs the independent review and records it in `docs/reviews/`, and prepares merge recommendations. Edu, the human owner, is the merge owner and approver. Claude Code (backend/domain) and Cursor (frontend) implement bounded tasks. Humans retain approval for business, legal, security, production, billing, and destructive decisions. (Previously Codex filled the orchestrator and merge-owner roles; it is no longer part of the workflow.)

## Default responsibilities

| Role | Primary responsibility | Must not do alone |
|---|---|---|
| Claude (Cowork) — orchestrator and independent reviewer | Architecture, backlog decomposition, task contracts, sequencing, independent review, release readiness | Approve legal policy, production secrets, billing, or destructive production changes; merge |
| Cursor | Product UI, interaction, frontend tests, local full-stack slices | Change core contracts or migrations without task approval |
| Claude Code | Domain/backend implementation, threat analysis, difficult debugging | Review or merge its own change |
| Edu — human owner, merge owner and approver | Product priorities, risk appetite, compliance interpretation, budget, production approval, merging | Share secrets in Git, chat, issue, screenshot, or source file |

Assignments may change per task, but author and reviewer must be different for high-risk work.

## Branch and merge model

`main` is the only permanent branch and must remain deployable. Work uses short-lived branches created from current `main`. Use temporary `integration/<initiative>` branches only when two dependent pull requests cannot be validated separately.

1. The orchestrator (Claude, Cowork) writes a task contract in `docs/tasks/` and identifies dependencies.
2. One agent owns one branch and one outcome.
3. The agent updates from `main` before handoff.
4. An independent agent reviews security-sensitive or architectural changes.
5. The orchestrator performs the independent review, records it in `docs/reviews/`, checks cross-feature consistency, and recommends whether to merge.
6. Edu (human owner) approves and merges; human approval is always required when the change crosses a protected decision boundary.
7. The pull request is squash-merged; the branch is deleted after merge.

No direct commits to `main` after the bootstrap commit. Never combine unrelated fixes in a merge just because they are nearby.

## Merge gates

A change may merge only when all applicable gates pass:

- scope and acceptance criteria are satisfied;
- lint, type checks, unit tests, and relevant integration tests pass;
- tenant isolation and authorization are tested server-side;
- migrations are reviewed and reversible or remediable;
- audit, privacy, encryption, retention, and logging impacts are documented;
- external effects are idempotent and observable;
- UI changes include responsive and accessibility verification;
- documentation and environment examples are current;
- no secret or sensitive customer data exists in the diff or history.

## Conflict resolution order

Resolve conflicts by authority, not by newest text: accepted ADRs, domain contracts, database migrations, backend behavior, frontend implementation, tests, then documentation. If two accepted sources disagree, stop the merge and create a decision record.

## Task contract

```text
Objective:
Business context:
In scope:
Out of scope:
Files or bounded contexts allowed:
Inputs and dependencies:
Acceptance criteria:
Security/tenant/audit requirements:
Required verification:
Expected handoff:
```

## Agent handoff

```text
Outcome:
Branch and commit:
Files changed:
Decisions and assumptions:
Checks run and exact results:
Security/tenant/audit impact:
Migration and rollback notes:
Known limitations:
Recommended reviewer:
```

## Protected decision boundaries

Explicit human approval is required for production access, new vendors or spending, external messages, customer data import/export, authentication policy, tenant suspension, pricing and billing, legal or regulatory claims, risk-decision policy, retention changes, and destructive migrations.

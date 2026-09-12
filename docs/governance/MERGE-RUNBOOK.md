# Local merge runbook

## Purpose

Integrate the Cursor and Claude Code worktrees into `main` without allowing one agent to overwrite another or bypass review.

## 1. Freeze and collect handoffs

Each agent stops editing, commits its bounded task, runs the required checks, and returns the standard handoff. Uncommitted task changes are not reviewed for merge.

## 2. Verify each worktree

From the main repository, confirm:

```text
git -C ../worktrees/cursor status --short --branch
git -C ../worktrees/claude status --short --branch
git -C ../worktrees/codex status --short --branch
```

Each branch must be clean. Review the commits and compare each branch with `main` before running or merging code.

## 3. Review in risk order

1. Secret and credential exposure.
2. Destructive or unapproved external effects.
3. Tenant isolation, authorization, RLS, and audit invariants.
4. Schema and domain compatibility.
5. Runtime correctness and failure behavior.
6. Accessibility, responsiveness, and visual consistency.
7. Documentation and maintainability.

## 4. Merge order

Merge the orchestration and quality gates first. Merge platform/domain foundations second. Rebase or update the frontend branch and resolve only explicit contract mappings. Merge the frontend last after its build and behavior are revalidated against the integrated platform branch.

Use `--no-ff` for local integration branches when preserving the task boundary helps review. The final hosted pull request uses squash merge according to repository governance.

## 5. Post-merge gates

Run `./scripts/check-secrets.sh` and `./scripts/verify-web.sh`. Review migration order and verify no environment file is tracked. Tag a milestone only after `main` is clean and all accepted task criteria are traceable to commits.

## 6. Stop conditions

Stop and require human approval for production access, real external email, destructive migration, billing behavior, customer data movement, legal or risk-policy interpretation, or any credential exposure.

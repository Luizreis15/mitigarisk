# TASK-003 — Codex integration foundation

## Objective

Create provider-neutral quality gates and an integration contract so the Cursor frontend and Claude platform branches can be reviewed and merged without hidden coupling or committed secrets.

## In scope

- Repository secret scan executable locally and in CI.
- Web lint and production-build validation executable locally and in CI.
- GitHub-compatible quality workflow, inactive until a remote is published.
- Integration boundary between presentation, domain, data, notifications, and providers.
- Local merge runbook for the three worktrees.

## Out of scope

- Product UI, domain schema, Supabase migrations, Resend calls, production deployment, or external writes.

## Acceptance criteria

1. The repository rejects tracked environment files and recognizable privileged-key formats.
2. The web validation runs the project's own lint and build commands.
3. CI uses least-privilege permissions and cancels superseded branch runs.
4. The integration contract prevents direct provider access from presentation components.
5. The runbook verifies task commits, working-tree cleanliness, divergence, tests, and merge order.
6. All scripts pass against the bootstrap repository.

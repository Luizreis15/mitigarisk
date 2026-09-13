# ADR 0005 — TASK-002 scope boundaries and deferred decisions

- Status: accepted
- Date: 2026-09-12

## Context

TASK-002's in-scope domain list is "tenants, memberships, roles/capabilities,
policy versions, evaluations, reason codes, cases, audit events, API
clients, webhook deliveries, and notification requests." The broader
Tenancy bounded context in `docs/architecture/PLATFORM-ARCHITECTURE.md`
also mentions environments, plans, and quotas, and the runtime baseline
mentions a durable background-job boundary and Resend. A literal reading of
the architecture doc could pull all of that into this task; the task
contract's explicit in-scope/out-of-scope lists say otherwise.

## Decision

The following are deliberately not built in this task, to avoid resolving
product ambiguity silently or broadening scope beyond the task contract:

- **Tenant environments, plans, quotas, and feature entitlements.** Not in
  TASK-002's explicit table list. `public.tenants` has no columns for
  these; adding them later is additive (new columns/tables), not a
  breaking change to what exists now.
- **Background job/worker infrastructure.** `webhook_deliveries` and
  `notification_requests` model the state machine a worker would drive
  (`pending`/`delivered`/`failed`/`dead_letter`, idempotency keys,
  attempt/backoff columns) but no worker, queue, or provider selection is
  implemented — `docs/architecture/PLATFORM-ARCHITECTURE.md` explicitly
  defers "provider chosen when the first asynchronous slice is
  implemented," and TASK-002 lists real email sending and third-party
  connectors as out of scope.
- **Generated Supabase TypeScript types.** `supabase gen types typescript`
  requires either a linked hosted project (out of scope: "does not depend
  on privileged credentials") or `supabase start`, which requires Docker —
  unavailable in this task's execution environment. `apps/web/lib/domain/**`
  is hand-written instead, with `apps/web/tests/domain/tenancy-sql-sync.test.ts`
  guarding the one place hand-written and generated data are most likely to
  drift (capability/role keys). Revisit once Docker or a linked project is
  available.
- **The exact role → capability grants.** Seeded as a reasonable default
  (ADR 0003) because the task explicitly requires roles/capabilities to
  exist and be enforced, but the specific grant matrix is a product policy
  decision, not something to leave unimplemented. Flagged for product
  review rather than left silently ambiguous.
- **Real Postgres RLS test execution.** Rather than only asserting
  correctness by reading the SQL, this task adds a local, credential-free
  harness (`supabase/tests/run-local-verification.sh`) that applies every
  migration and the RLS/immutability test suite against a disposable
  Postgres cluster (`initdb`/`pg_ctl`, no Docker, no network, no hosted
  project). This exceeds "static checks" and was the only way to catch the
  `app` schema PostgREST-exposure defect described in ADR 0003.

## Consequences

A reviewer evaluating this task against
`docs/architecture/PLATFORM-ARCHITECTURE.md` in full should expect gaps in
the areas listed above and treat them as intentionally deferred, not
missed. Each deferred item is additive to the current schema rather than
requiring rework of what TASK-002 delivers.

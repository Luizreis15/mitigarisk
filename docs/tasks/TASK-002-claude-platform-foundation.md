# TASK-002 — Claude platform and Supabase foundation

## Objective

Design a reviewable backend/domain foundation for MITIGA using Supabase, with enforceable multi-tenancy, immutable risk evidence, and a migration path that does not depend on privileged credentials.

## Business context

The MVP must support tenant-specific policies and explainable onboarding evaluations before continuous transaction monitoring. This task establishes contracts and database safety without connecting production services.

## In scope

- Initial domain model for tenants, memberships, roles/capabilities, policy versions, evaluations, reason codes, cases, audit events, API clients, webhook deliveries, and notification requests.
- Forward-only SQL migrations under `supabase/migrations/`.
- RLS policies with explicit positive and cross-tenant negative cases.
- Seed data limited to fictional development tenants.
- TypeScript domain contracts and server-only Supabase boundary where useful.
- Threat model and ADRs for meaningful decisions or deviations.
- Idempotency, correlation IDs, timestamps, actor provenance, and immutable published-policy references.

## Out of scope

- Executing migrations against a hosted project.
- Reading or requesting `.env.local`, service-role, database passwords, or Resend keys.
- Real email sending, frontend screens, billing implementation, third-party connectors, or autonomous risk decisions.
- Microservices or background-provider selection without a separate ADR.

## Allowed files

- `supabase/**`
- `docs/architecture/**`
- `docs/adr/**`
- `docs/security/**`
- `apps/web/lib/domain/**`
- `apps/web/lib/supabase/**`
- `apps/web/tests/**`
- `apps/web/package.json` and lockfile only if a required dependency is justified
- This task file for handoff notes only

## Acceptance criteria

1. Schema and domain contracts map cleanly to the accepted bounded contexts.
2. Every tenant-owned table includes `tenant_id` and RLS enforcement.
3. Published policies and completed evaluation evidence cannot be silently mutated.
4. Authorization checks are server-side and capability-oriented.
5. RLS examples cover authorized access, unauthenticated denial, and cross-tenant denial.
6. Webhook and notification models support idempotency and delivery history.
7. Migrations include remediation or rollback notes and avoid destructive shortcuts.
8. No credential or live network operation is introduced.
9. Static checks or available local tests pass; unavailable verification is reported explicitly.

## Expected handoff

Commit changes on `feat/claude-platform-foundation` using Conventional Commits, then return findings and the standard handoff from `docs/governance/MULTI-AGENT-DEVELOPMENT.md`. Do not merge or apply anything to the hosted Supabase project.

## Handoff (2026-09-12, Claude Code)

Outcome: implemented in full. Schema, RLS, immutability, domain contracts, Supabase boundary, threat model, and ADRs are in place and verified against a disposable local Postgres instance (no hosted project touched).

Branch and commit: `feat/claude-platform-foundation`, commits `7aa171f` (schema), `bd69161` (SQL verification harness), `3caa13f` (domain contracts + Supabase boundary), `7fcb288` (domain unit tests), `92ba1db` (threat model + ADRs).

Files changed: `supabase/migrations/**` (9 files), `supabase/seed.sql`, `supabase/tests/**` (shim, RLS suite, harness script, README), `apps/web/lib/domain/**`, `apps/web/lib/supabase/**`, `apps/web/tests/domain/**`, `apps/web/package.json` + lockfile (added `@supabase/supabase-js`), `apps/web/tsconfig.json` (`allowImportingTsExtensions`), `apps/web/.gitignore`/`.gitignore` (build-artifact ignores), `docs/adr/0002-0004`, `docs/security/TASK-002-threat-model.md`.

Decisions and assumptions (see ADR 0003–0005 for full rationale):
- Tenant membership derived from `public.memberships` via security-definer helpers, no custom JWT claim.
- Role → capability grants are an implementer default pending product ratification (ADR 0003).
- Environments/plans/quotas, background-job/worker infra, and generated Supabase types are explicitly deferred (ADR 0005) — additive later, not reworked.
- `app` schema functions are not PostgREST-exposed; added `public.has_capability`/`public.record_audit_event` wrappers after local verification caught that the original design would have silently 404'd from `apps/web/lib/supabase/authorization.ts`.

Checks run and exact results:
- `supabase/tests/run-local-verification.sh` (initdb/pg_ctl, no Docker, no network) — all 9 migrations apply cleanly; all 16 RLS/immutability/capability-RPC assertions in `supabase/tests/010-rls-tenant-isolation.sql` pass. Re-run after every schema change during implementation.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — no errors.
- `cd apps/web && npm run lint` (oxlint) — zero errors in any file this task touched; pre-existing errors in unrelated `components/ui/**`/`hooks/**` frontend files are untouched and out of scope.
- `cd apps/web && npm test` (`node --test`) — 8/8 pass, including a regression test that fails if the TS capability/role key lists drift from the SQL seed.
- `supabase gen types typescript` was attempted to generate a real `Database` type but requires Docker, unavailable in this environment; domain contracts are hand-written instead (ADR 0005). Reported explicitly per acceptance criterion 9.

Security/tenant/audit impact: every tenant-owned table has RLS keyed off `tenant_id`; cross-tenant reads and writes are denied and verified negatively. Published policies, completed evaluations, case evidence/decisions, and audit events are immutable at the trigger level, not just by convention. Audit writes are attributed server-side (`auth.uid()`), not caller-supplied. No secret, credential, or live network operation was introduced or required.

Migration and rollback notes: every migration is additive (`create table/function if not exists` or `create or replace`); each file ends with a rollback comment. No destructive migration exists in this task.

Known limitations: role→capability matrix needs product review; no worker/queue implementation; no generated Supabase types (Docker required); no frontend or real email/webhook delivery, per scope.

Recommended reviewer: an independent agent for the RLS/authorization design (security-sensitive, per `docs/governance/MULTI-AGENT-DEVELOPMENT.md`), plus product sign-off on the role→capability seed before any UI is built on top of it.

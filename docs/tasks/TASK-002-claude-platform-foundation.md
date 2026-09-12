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

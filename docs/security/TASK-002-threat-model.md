# TASK-002 threat model — Claude platform and Supabase foundation

Scope: the schema, RLS policies, and TypeScript contracts introduced by
TASK-002 (`supabase/**`, `apps/web/lib/domain/**`, `apps/web/lib/supabase/**`).
No hosted project, credential, or network operation is in scope — this
foundation has never been deployed or connected to anything live.

## Assets

- Tenant-owned records: memberships, policy versions/factors/thresholds,
  evaluations and reason codes, cases/evidence/decisions, API clients,
  webhook endpoints/deliveries, notification requests, audit events.
- Capability/role reference data (platform-wide, not tenant-owned).
- Published risk policy versions and completed evaluations, whose integrity
  the business depends on (immutable evidence, `docs/architecture/PLATFORM-ARCHITECTURE.md`).

## Trust boundaries

1. **Browser ↔ PostgREST (anon/authenticated roles).** The browser only ever
   holds the anonymous key; every table access is mediated by RLS. See
   `apps/web/lib/supabase/browser.ts`.
2. **Server ↔ PostgREST, request-scoped.** Server code acting on behalf of
   one user's request uses `createRequestScopedSupabaseClient()`
   (`apps/web/lib/supabase/server.ts`), which is still RLS-bound — it does
   not elevate privilege, it just runs server-side.
3. **Server ↔ database, service role.** `getServiceRoleSupabaseClient()`
   bypasses RLS entirely. Reserved for trusted background operations
   (tenant provisioning, webhook/notification delivery workers) that cannot
   be expressed as one user's own action. Every call site is individually
   responsible for its own authorization and audit logging.
4. **`app` schema.** Internal to the database; never exposed via PostgREST.
   The only two client-facing entry points into tenant-authorization and
   audit logic are the `public.has_capability()` and
   `public.record_audit_event()` wrappers (see ADR 0003).

## Threats considered and mitigations

| # | Threat | Mitigation |
|---|---|---|
| T1 | A user reads or writes another tenant's data by guessing an id. | Every tenant-owned table has RLS enabled with `USING`/`WITH CHECK` clauses gated by `app.has_capability()`/`app.current_tenant_ids()`; verified for both SELECT and INSERT in `supabase/tests/010-rls-tenant-isolation.sql` (tests 3, 3b). |
| T2 | A regular user (not `service_role`) forges `actor_id` on an audit event to hide their own action. | Client writes only reach `public.record_audit_event()`, which stamps `actor_id = auth.uid()` server-side; there is no INSERT policy on `audit_events` for `authenticated`/`anon`. Verified in test 4. |
| T3 | A published risk policy version (or its factors/thresholds) is edited after publication, invalidating past evaluation evidence. | `app.forbid_published_policy_version_mutation()` and `app.forbid_children_when_not_draft()` triggers reject the mutation at the database level regardless of role or RLS outcome. Verified in test 5. |
| T4 | A completed/failed evaluation or its reason codes are altered after the fact. | `app.forbid_completed_evaluation_mutation()` / `app.forbid_reason_code_mutation_after_completion()` triggers block it unconditionally. |
| T5 | Case evidence or a recorded case decision is edited or deleted, breaking the evidentiary trail. | `case_evidence`/`case_decisions` have no UPDATE/DELETE RLS policy and are additionally covered by `app.forbid_mutation()` triggers (belt-and-suspenders). |
| T6 | A caller replays a webhook delivery or notification request, causing duplicate side effects downstream. | `webhook_deliveries` is unique on `(endpoint_id, idempotency_key)`; `notification_requests` is unique on `(tenant_id, idempotency_key)`. |
| T7 | A user without `tenant.manage_members` grants themselves or someone else a higher-privilege role. | `memberships` INSERT/UPDATE both require `tenant.manage_members` via RLS `WITH CHECK`; verified negatively in test 4 (auditor cannot insert a membership). |
| T8 | A caller with only read access (`policy.view`) publishes a draft policy. | The `policy_versions` UPDATE policy's `WITH CHECK` requires `policy.publish` specifically when `new.status = 'published'`, in addition to `policy.manage`. |
| T9 | Row-level security is silently bypassed because a table lacks `ENABLE ROW LEVEL SECURITY`, or has grants but no matching policy so an operation errors instead of denies cleanly (or vice versa). | Every tenant-owned or reference table created in `supabase/migrations/` has RLS enabled in the same or an immediately following migration; the full RLS/immutability suite is exercised end-to-end against a live, disposable Postgres instance in CI-equivalent local verification (see `supabase/tests/README.md`), not just read from the SQL. |
| T10 | A raw secret (API client key, webhook secret) is recoverable from the database if it is compromised. | Only `key_hash`/`secret_hash` are ever stored; no column holds a raw secret. Generating/showing the raw value once is an application-layer concern outside this task's scope. |
| T11 | An `app.*` helper function meant to be internal becomes reachable by a client and used to bypass a capability check. | The `app` schema receives no PostgREST exposure; only two explicit `public.*` wrapper functions bridge into it, and both were exercised directly via RPC-equivalent calls in the local verification suite (test 3b, 4). |

## Residual risk / follow-ups (not blocking this task)

- Tenant provisioning (`tenants` INSERT/UPDATE by a platform admin) and
  membership invitation flows are schema/RLS-ready but have no application
  code yet; a future task must ensure the service-role paths that will
  drive them also write `audit_events` themselves (client-side
  `record_audit_event()` does not apply to service-role writes).
- No rate limiting or webhook signature verification is implemented at this
  layer (out of scope per TASK-002; called out in
  `docs/architecture/PLATFORM-ARCHITECTURE.md`, "API rules").
- Role → capability seed values (`docs/adr/0002-capability-based-authorization.md`)
  are an implementer default pending product confirmation.

# TASK-028 — Platform-admin operational boundary on policy, case, integration and notification surfaces

Owner: Claude Code (implementation) · Reviewer: independent (orchestrator) · Status: **Approved — D4, D5, D6 approved by human owner on 2026-09-22**

Branch: `fix/authz-platform-admin-operational-surfaces`, created from `integration/audit-and-task-019` at `d392486`. If the lockfile chore has already been integrated, branch from that newer head instead.

## Objective

Extend the TASK-026 rules to every remaining tenant-operational surface. D1 denies platform admins and D2 denies suspended tenants. The platform-admin bypass that remains must be explicit and limited to platform governance.

## Business context

The TASK-026 independent review found probe **G**. A platform administrator with no tenant membership created a draft policy in tenant 3, added a factor, added a single 0–100 `approve` band, and published it. The tenant's next supplier evaluation then used that policy and returned `approve`. The platform operator can therefore change any customer's risk recommendation indirectly. The cause is RLS of the form `app.is_platform_admin() or app.has_capability(...)`, which still exists outside the supplier slice.

## Human decisions required before start (recommended defaults)

- **D4 — Operational surfaces become member-only.** Recommended: **yes**. The following tables move to `app.has_tenant_capability_as_member(...)` (D1 + D2), with no platform bypass:
  - `policy_versions`, `policy_factors`, `policy_thresholds`;
  - `cases`, `case_evidence`, and the `case_decisions` select;
  - `api_clients`, `webhook_endpoints`, `webhook_deliveries`;
  - `notification_templates`, `notification_requests`.
- **D5 — Platform governance keeps an explicit, named bypass.** Recommended: **yes**. Platform administrators keep what they need to operate the platform:
  - `tenants` (read and status changes);
  - `memberships` (read and status changes through the existing RPCs);
  - the `roles`, `capabilities` and `role_capabilities` catalogs;
  - `platform_admins`.

  The bypass is expressed through a new helper, `app.is_platform_governance_actor()`, which is a thin wrapper around `app.is_platform_admin()`. Its purpose is that every remaining bypass can be found with grep.
- **D6 — `audit_events` select.** Recommended: platform admins read only events with `tenant_id is null`. That covers platform-level events and never exposes tenant operational metadata. Tenant members keep `audit.view` through the member-only helper.

## In scope

1. **Inventory first.** List every RLS policy and every `security definer` function in `supabase/migrations/` that references `app.is_platform_admin()` or `app.has_capability(`. Classify each one as D4, D5 or D6 in the handoff. If a surface does not fit the table, **stop and report it without implementing it**.
2. Add one forward migration that rewrites the D4 policies to the member-only helper and creates `app.is_platform_governance_actor()`. The D5 policies must call the new helper explicitly. The D6 policy is rewritten as described above.
3. Publication integrity. When `policy_versions.status` becomes `published`, a trigger enforces `published_at = now()` and `published_by = auth.uid()`. A future-dated `published_at` must no longer make a policy the current one. The trigger must not break the seed: the seed publishes as superuser with an explicit `published_by`, so the trigger forces `published_by` only when `auth.uid()` is not null.
4. Make SQLSTATEs consistent in the `run_supplier_evaluation` guard. A non-numeric `min` or `max` must fail with 22023, not 22P02. Test the value with a regex before casting. This requires redefining the function in the same new migration.
5. Record in `docs/tasks/TASK-028-*.md` that the TASK-026 migration header incorrectly names `apps/web/lib/domain/supplier-evaluation-adapter.ts`, which no longer exists. This is a documentation erratum only: applied migrations are immutable.
6. Add `supabase/tests/070-platform-admin-operational-boundary.sql`, covering:
   - probe G, end to end. A platform admin with no membership, and a dual-role platform admin, both fail on insert, update and publish of `policy_versions`, `policy_factors` and `policy_thresholds`, and on insert and update of cases. The tenant evaluation keeps using the legitimate policy;
   - a future-dated `published_at` is overwritten with `now()`;
   - suspended tenant: reads and writes on D4 surfaces are denied;
   - D5 still works for platform admins: listing tenants, suspending a tenant and listing memberships, through the existing paths;
   - D6: a platform admin sees platform events and does not see tenant events;
   - regression: `tenant_admin`, `risk_analyst`, `operator` and `auditor` keep their current capabilities on each D4 surface.

## Out of scope

- UI and prototype screens under `lib/demo`.
- Seed data and the role matrix, including `operator` and `evaluation.run`.
- A policy-publishing UI.
- Dependencies and the lockfile.
- Hosted Supabase and Vercel.
- Merge and push.

## Files allowed

- `supabase/migrations/<timestamp after 20260922130000>_platform_admin_operational_boundary.sql`
- `supabase/tests/070-platform-admin-operational-boundary.sql`
- `docs/tasks/TASK-028-claude-platform-admin-operational-boundary.md` (contract and handoff)

## Acceptance criteria

1. Probe G fails at every step with 42501, and the tenant's evaluation keeps using the tenant's own policy.
2. After the migration, every reference to `app.is_platform_admin()` in RLS is inside `app.is_platform_governance_actor()` or inside an explicit D5 or D6 policy. The handoff includes the resulting grep.
3. Suites 010–060 pass. Any modified test is justified in writing, test by test.
4. Publication with a future `published_at` is overwritten, which is covered by a test.
5. Full verification passes with exit codes preserved.

## Security, tenant and audit requirements

- The migration is forward-only, with no deletion of data.
- Rollback is documented as the prior policy bodies.
- Audit writes remain atomic.
- No real data and no secrets.

## Required verification

`./supabase/tests/run-local-verification.sh`. Then, in `apps/web`: `npm ci`, `npm test`, `npx tsc --noEmit -p tsconfig.json`, lint with the project exclusions, `npm run build`, and `npm run build:vercel && npm run verify:vercel`. Finally: `./scripts/check-secrets.sh` and `git diff --check`.

## Expected handoff

Use the standard template. It must include:
- the surface inventory and classification (D4, D5, D6);
- a before and after of each policy;
- the per-suite counts;
- the SHA.

## Inventory (item 1, done before implementation)

`grep -n "app\.is_platform_admin()\|app\.has_capability(" supabase/migrations/*.sql`, resolved to each object's **live** definition (the last migration that `drop policy`/`create or replace function`s it — several objects were redefined more than once before this task).

### Flagged: two surfaces do not fit D4, D5, or D6 — not implemented

**`public.record_audit_event(...)`** (write path, live in `20260912120800_security_and_english_first_hardening.sql`): both branches still let a platform administrator write an audit event into **any** tenant with no membership at all —
- `p_tenant_id is null and not app.is_platform_admin()` → raise 42501 (so a platform admin *may* write a platform-level event — arguably D6-shaped, but D6's decision text names only the `select` policy, not this write path);
- `p_tenant_id is not null and not app.is_platform_admin() and not exists(active membership) then` → raise 42501 (so a platform admin may **also** write into a tenant they do not belong to — not covered by D4's table list, not covered by D5).

This does not cleanly match any of the three approved decisions as literally scoped, so per item 1 ("if a surface does not fit the table, stop and report it without implementing it") it is **left unchanged** in `20260922140000_platform_admin_operational_boundary.sql`. It is not currently known to be exploitable end-to-end the way probe G was (every existing caller of `record_audit_event` is itself already gated by an authorized RPC before the audit call), but a platform administrator can call `public.record_audit_event` directly (it is `grant`ed to `authenticated`) and forge an attributed-to-themselves, but arbitrary-content, audit row into any tenant. Recommend a follow-up task, the same way probe G became this one.

**`evaluation_reason_codes_insert` and `evaluation_reason_codes_update`** (live, unmodified, in `20260912120300_evaluation.sql`, the original TASK-002 migration): discovered while producing the **live** grep below (`pg_policies`), not by the text grep alone, because these two policies were never touched by any later migration, including TASK-026's own `evaluation_reason_codes_select` rewrite. My TASK-026 handoff and this document's own first draft incorrectly stated that "evaluations/evaluation_reason_codes are already fixed by TASK-026" — that was true only for `evaluations_select/insert/update` and `evaluation_reason_codes_select`, never for these two. Both still read:
```
using (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
with check (app.is_platform_admin() or app.has_capability(tenant_id, 'evaluation.run'))
```
This is a live, direct-table write path: any platform administrator (any tenant, no membership needed), or any tenant member holding `evaluation.run`, can `INSERT`/`UPDATE` `evaluation_reason_codes` rows directly — bypassing `run_supplier_evaluation`'s non-forgeable, database-computed reasons entirely — for as long as the parent evaluation's `status` is `'pending'` (the append-only trigger, `app.forbid_reason_code_mutation_after_completion()`, only blocks this once the evaluation is `'completed'`/`'failed'`; a legacy, `supplier_id is null` evaluation can be left `'pending'` indefinitely, e.g. supabase/tests/020-integration-hardening.sql's own fixtures). `evaluation_reason_codes` is not in D4's table list (only `evaluations` implicitly was, via TASK-026, and even that migration missed these two), is not D5, and is not D6, so per the same stop-and-report instruction it is **left unchanged** here. This is arguably more urgent than the `record_audit_event` finding above — it is a live forgery vector on evaluation evidence, the exact category of bug TASK-023's original security correction (`20260914120200_supplier_evaluation.sql`) set out to close. Recommend an urgent follow-up task.

### D4 — moved to `app.has_tenant_capability_as_member(...)`, no platform bypass

| Table | Policy | Before | After |
|---|---|---|---|
| `policy_versions` | `policy_versions_select` | `app.is_platform_admin() or app.has_capability(tenant_id,'policy.view')` | `app.has_tenant_capability_as_member(tenant_id,'policy.view')` |
| `policy_versions` | `policy_versions_insert` | `app.is_platform_admin() or app.has_capability(tenant_id,'policy.manage')` | `app.has_tenant_capability_as_member(tenant_id,'policy.manage')` |
| `policy_versions` | `policy_versions_update` | using: same as insert; with check: `app.is_platform_admin() or (app.has_capability(tenant_id,'policy.manage') and (status is distinct from 'published' or app.has_capability(tenant_id,'policy.publish')))` | using: `app.has_tenant_capability_as_member(tenant_id,'policy.manage')`; with check: `app.has_tenant_capability_as_member(tenant_id,'policy.manage') and (status is distinct from 'published' or app.has_tenant_capability_as_member(tenant_id,'policy.publish'))` |
| `policy_versions` | `policy_versions_delete` | `app.is_platform_admin() or app.has_capability(tenant_id,'policy.manage')` | `app.has_tenant_capability_as_member(tenant_id,'policy.manage')` |
| `policy_factors` | `policy_factors_select` | same shape as policy_versions_select, `policy.view` | member-only, `policy.view` |
| `policy_factors` | `policy_factors_write` (for all) | `app.is_platform_admin() or app.has_capability(tenant_id,'policy.manage')` (using + check) | member-only, `policy.manage` (using + check) |
| `policy_thresholds` | `policy_thresholds_select` | same shape, `policy.view` | member-only, `policy.view` |
| `policy_thresholds` | `policy_thresholds_write` (for all) | same shape, `policy.manage` | member-only, `policy.manage` |
| `cases` | `cases_select` | `app.is_platform_admin() or app.has_capability(tenant_id,'case.view')` | member-only, `case.view` |
| `cases` | `cases_insert` | `(app.is_platform_admin() or app.has_capability(tenant_id,'case.manage')) and opened_by=auth.uid()` | `app.has_tenant_capability_as_member(tenant_id,'case.manage') and opened_by=auth.uid()` |
| `cases` | `cases_update` | using+check `app.is_platform_admin() or app.has_capability(tenant_id,'case.manage')` | member-only, `case.manage` |
| `case_evidence` | `case_evidence_select` | same shape, `case.view` | member-only, `case.view` |
| `case_evidence` | `case_evidence_insert` | `(app.is_platform_admin() or app.has_capability(tenant_id,'case.manage')) and uploaded_by=auth.uid()` | member-only + `uploaded_by=auth.uid()` |
| `case_decisions` | `case_decisions_select` | `app.is_platform_admin() or app.has_capability(tenant_id,'case.view')` | member-only, `case.view` |
| `case_decisions` | `case_decisions_insert` | — already fixed by `20260914120300_case_decisions_tenant_admin_only.sql` (`app.is_active_tenant_admin(tenant_id)`, no capability route, no bypass) | unchanged; not touched here |
| `api_clients` | `api_clients_select` | `app.is_platform_admin() or app.has_capability(tenant_id,'integration.view')` | member-only, `integration.view` |
| `api_clients` | `api_clients_insert` | `(... or has_capability(...,'integration.manage')) and created_by=auth.uid()` | member-only + `created_by=auth.uid()` |
| `api_clients` | `api_clients_update` | using+check `app.is_platform_admin() or app.has_capability(tenant_id,'integration.manage')` | member-only, `integration.manage` |
| `webhook_endpoints` | `webhook_endpoints_select` | same shape, `integration.view` | member-only |
| `webhook_endpoints` | `webhook_endpoints_insert` | same shape + `created_by=auth.uid()` | member-only + `created_by=auth.uid()` |
| `webhook_endpoints` | `webhook_endpoints_update` | same shape | member-only |
| `webhook_deliveries` | `webhook_deliveries_select` | same shape, `integration.view` | member-only |
| `webhook_deliveries` | `webhook_deliveries_insert` | same shape, `integration.manage` | member-only |
| `webhook_deliveries` | `webhook_deliveries_update` | — does not exist (dropped by `20260912120800...` with no replacement; retention-only, worker/service_role writes only) | unchanged; nothing to rewrite |
| `notification_requests` | `notification_requests_select` | `app.is_platform_admin() or app.has_capability(tenant_id,'notification.view')` | member-only |
| `notification_requests` | `notification_requests_insert` | same shape, `notification.manage` | member-only |
| `notification_requests` | `notification_requests_update` | — does not exist (dropped by `20260912120800...` with no replacement) | unchanged; nothing to rewrite |

### D4 + D5 (mixed) — `notification_templates` only

`notification_templates.tenant_id` is nullable by design: a null-tenant row is a platform-wide template, not tenant-owned data (its own table comment says so). Its `select` policy's `tenant_id is null` branch was already unconditionally open to *any* authenticated caller — never gated by `app.is_platform_admin()` at all — so applying D4's member-only helper to the whole policy without preserving that branch would have made platform-wide templates unreadable by everyone, including the platform admins who are supposed to manage them. That branch is left exactly as it was; only the tenant-owned branch's redundant `app.is_platform_admin()` disjunct is removed. The write policies already split this way; only the bypass call site changes.

| Policy | Before | After |
|---|---|---|
| `notification_templates_select` | `tenant_id is null or app.is_platform_admin() or app.has_capability(tenant_id,'notification.view')` | `tenant_id is null or app.has_tenant_capability_as_member(tenant_id,'notification.view')` |
| `notification_templates_insert` | `((tenant_id is null and app.is_platform_admin()) or (tenant_id is not null and app.has_capability(tenant_id,'notification.manage'))) and created_by=auth.uid()` | `((tenant_id is null and app.is_platform_governance_actor()) or (tenant_id is not null and app.has_tenant_capability_as_member(tenant_id,'notification.manage'))) and created_by=auth.uid()` |
| `notification_templates_update` | same dual shape (using + check) | same dual shape, `is_platform_governance_actor()` / member-only |

### D5 — kept, only through `app.is_platform_governance_actor()`

New helper: `app.is_platform_governance_actor()` — `security definer`, thin wrapper `select app.is_platform_admin();`, `stable`, granted to `authenticated`.

| Table/function | Policy/object | Before | After |
|---|---|---|---|
| `platform_admins` | `platform_admins_select` | `app.is_platform_admin()` | `app.is_platform_governance_actor()` |
| `tenants` | `tenants_select` | `app.is_platform_admin() or id in (select app.current_tenant_ids())` | `app.is_platform_governance_actor() or id in (select app.current_tenant_ids())` |
| `tenants` | `tenants_insert` | `app.is_platform_admin()` | `app.is_platform_governance_actor()` |
| `tenants` | `tenants_update` | using+check `app.is_platform_admin() or app.has_capability(id,'tenant.manage_settings')` | using+check `app.is_platform_governance_actor() or app.has_capability(id,'tenant.manage_settings')` |
| `memberships` | `memberships_select` | `app.is_platform_admin() or user_id=auth.uid() or app.has_capability(tenant_id,'tenant.view')` | `app.is_platform_governance_actor() or user_id=auth.uid() or app.has_capability(tenant_id,'tenant.view')` |
| `memberships` | `memberships_insert` (live version from `20260913090000_auth_tenant_bootstrap.sql`) | `(app.is_platform_admin() or app.has_capability(tenant_id,'tenant.manage_members')) and (invited_by is null or invited_by=auth.uid())` | `(app.is_platform_governance_actor() or app.has_capability(tenant_id,'tenant.manage_members')) and (invited_by is null or invited_by=auth.uid())` |
| `memberships` | `memberships_update` (same live migration) | using+check with `app.is_platform_admin() or app.has_capability(...) or (user_id=auth.uid() and/or status='invited')` | same shape, `app.is_platform_governance_actor()` |
| `app.guard_membership_transition()` (trigger fn, security definer) | backs `memberships_update` | `v_is_admin := app.is_platform_admin() or app.has_capability(old.tenant_id,'tenant.manage_members');` | `v_is_admin := app.is_platform_governance_actor() or app.has_capability(old.tenant_id,'tenant.manage_members');` |
| `roles`, `capabilities`, `role_capabilities` | `*_select` | `using (true)` — no bypass reference at all | unchanged; open read to any authenticated caller is the intended shape for reference catalogs |

**Left unchanged, out of AC2's literal scope ("every reference … in RLS"), and documented here as a judgment call:**
- `public.is_platform_admin()` (PostgREST wrapper, `20260913090000_auth_tenant_bootstrap.sql`): a plain identity-resolution query exposed to the client, not an authorization condition in a `WHERE`/`CHECK` clause. Still calls `app.is_platform_admin()` directly.
- `public.bootstrap_tenant(...)`: `security invoker`, not a `security definer` function (item 1's inventory scope is RLS policies and *security definer* functions), and its precondition (`if not public.is_platform_admin() then raise`) is a plpgsql check inside an RPC body, not RLS. Still calls `public.is_platform_admin()`.
- `app.has_capability(uuid, text)` and its PostgREST wrapper `public.has_capability(uuid, text)`: unchanged, security definer, still embeds `app.is_platform_admin()` in its own body — this is the same *deliberate, documented* platform-admin bypass TASK-026 already left in place for "everywhere else" (`20260914120050_no_bypass_authorization_helpers.sql`). After this migration it is reachable only from D5 call sites (`tenants_update`, `memberships_select/insert/update`, `app.guard_membership_transition()`) and the D5 branch of `notification_templates`; no D4 policy calls it anymore. `070-platform-admin-operational-boundary.sql` asserts this with a `pg_policies` introspection query.
- `app.is_platform_admin()` itself (`20260912120150_authorization_helpers.sql`): the base primitive; unchanged, still the thing `app.is_platform_governance_actor()` wraps.
- The D1/D2 **denial** checks approved in TASK-025/026 — `app.has_tenant_capability_as_member`, `app.is_active_tenant_admin`, `public.can_record_supplier_final_decision`, `public.record_supplier_final_decision`, `supplier_final_decisions_select` — all contain `not app.is_platform_admin()`. These exclude a platform administrator; they are not a bypass, so they correctly keep calling `app.is_platform_admin()` directly rather than the new governance-actor wrapper (using the wrapper there would be semantically backwards — the wrapper means "this identity is allowed a bypass," not "this identity is denied").

### D6 — `audit_events`

| Policy | Before | After |
|---|---|---|
| `audit_events_select` | `app.is_platform_admin() or (tenant_id is not null and app.has_capability(tenant_id,'audit.view'))` | `(tenant_id is null and app.is_platform_governance_actor()) or (tenant_id is not null and app.has_tenant_capability_as_member(tenant_id,'audit.view'))` |

### Already fixed by TASK-026, superseded — no action

`evaluations_insert`, `evaluations_update`, `evaluations_select`, `evaluation_reason_codes_select` (live definitions are entirely from `20260922130000_uniform_tenant_authorization.sql`, zero `app.is_platform_admin()`/`app.has_capability(` references remaining); `public.create_supplier`, `public.create_supplier_evidence`, `suppliers_select`, `supplier_evidence_select`, `public.record_supplier_final_decision`, `public.can_record_supplier_final_decision`, `supplier_final_decisions_select` (all call the D1/D2-safe member-only helpers already).

### Live grep (AC2), from `pg_policies` after applying every migration and the seed — not the raw text grep

The text grep at the top of this section necessarily shows every historical definition (applied migrations are immutable); this is the query that matters — the **live**, resolved state of every RLS policy after `20260922140000_platform_admin_operational_boundary.sql` applies:

```sql
select schemaname, tablename, policyname from pg_policies
where coalesce(qual,'') ~ 'app\.is_platform_admin\(' or coalesce(with_check,'') ~ 'app\.is_platform_admin\('
order by tablename, policyname;
```
```
 schemaname |        tablename         |           policyname
------------+---------------------------+----------------------------------
 public     | evaluation_reason_codes  | evaluation_reason_codes_insert    <- flagged above, not D4/D5/D6, not touched
 public     | evaluation_reason_codes  | evaluation_reason_codes_update    <- flagged above, not D4/D5/D6, not touched
 public     | supplier_final_decisions | supplier_final_decisions_select   <- D1 denial ("not app.is_platform_admin()"), expected
(3 rows)
```

```sql
select schemaname, tablename, policyname from pg_policies
where coalesce(qual,'') ~ 'app\.has_capability\(' or coalesce(with_check,'') ~ 'app\.has_capability\('
order by tablename, policyname;
```
```
 schemaname |      tablename      |      policyname
------------+---------------------+-----------------------
 public     | evaluation_reason_codes | evaluation_reason_codes_insert   <- flagged above
 public     | evaluation_reason_codes | evaluation_reason_codes_update   <- flagged above
 public     | memberships          | memberships_insert    <- D5, expected (tenant.manage_members)
 public     | memberships          | memberships_select    <- D5, expected (tenant.view)
 public     | memberships          | memberships_update    <- D5, expected (tenant.manage_members)
 public     | tenants              | tenants_update         <- D5, expected (tenant.manage_settings)
(6 rows)
```

Every row is either (a) one of the two newly flagged `evaluation_reason_codes` write policies (not implemented, reported above), or (b) an expected, already-documented D1 denial check or D5 capability check. `app.is_platform_admin(` and bare `app.has_capability(` no longer appear in any D4 policy, `app.is_platform_governance_actor()` is the only bypass in every D5/D6 policy, and no `pg_proc` security-definer function other than `app.is_platform_admin()` itself, `app.is_platform_governance_actor()`, `app.has_capability`, and the pre-approved D1-denial helpers references `app.is_platform_admin(` in its body.

### Documentation errata (item 5)

The header of `20260914120200_supplier_evaluation.sql` and the header/comments of `20260922130000_uniform_tenant_authorization.sql` both name `apps/web/lib/domain/supplier-evaluation-adapter.ts` as the TypeScript reference their SQL fact-derivation mirrors. That file does not exist in this repository — `apps/web/lib/domain/` has `evaluation-engine.ts`, `evaluation-engine-errors.ts`, `supplier.ts`, `supplier-evidence.ts`, and `supplier-final-decision.ts`, but no `supplier-evaluation-adapter.ts`. Both migrations are applied and immutable, so this is recorded here only, not edited in either file.

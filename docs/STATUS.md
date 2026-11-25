# MITIGA — status board

State of each capability as of 24 Nov 2026, on `main` at `31a39cc`. Every row is derived from migrations, routes and tests, not from task contracts. A contract records intent; this file records what the repository contains.

Update this file in the same pull request as any change that moves a capability between states (see `CONTRIBUTING.md`).

## How to read it

| State | Meaning |
|---|---|
| `built` | A migration or a real route exists, and a test exercises it. |
| `partial` | Part of the capability meets the `built` rule; the note says which part does not. |
| `prototype` | Reachable only when `ENABLE_PROTOTYPE_ROUTES=true` (`apps/web/lib/prototype-routes.ts`). Fixture data, not product functionality. |
| `not started` | No route, RPC or worker implements it. |
| `unknown` | The repository does not settle it either way; the note says what was checked. |

Paths are relative to the repository root. Migrations are under `supabase/migrations/`, SQL suites under `supabase/tests/`, application code and tests under `apps/web/`.

Verification on this commit: `npm test` in `apps/web` ran 418 tests, 0 failures; `supabase/tests/run-local-verification.sh` passed with 629 `ok` assertions across 19 suites.

## Capabilities

| Capability | State | Evidence | Note |
|---|---|---|---|
| Authentication (sign-in, sign-out, password reset, session refresh) | `built` | `app/page.tsx`, `app/auth-actions.ts`, `app/auth/confirm/route.ts`, `middleware.ts`; `tests/domain/auth-session.test.ts`, `tests/app/middleware-session-refresh-only.test.ts` | Email and password only. |
| Tenancy and authorization | `built` | `20260912120100_identity_and_tenancy.sql`, `20260912120160_identity_and_tenancy_rls.sql`, `20260922130000_uniform_tenant_authorization.sql`, `20260922140000_platform_admin_operational_boundary.sql`; suites `010`, `060`, `070`; `tests/supabase/tenant-context.test.ts` | Capability-based; platform administrators have no bypass into tenant operations. |
| Policy versioning | `built` | `20260912120200_risk_policy.sql`, `20260926100000_cra_engine_v2.sql` (publish validator, immutability triggers); suites `010`, `090` | Database only. No real screen creates or publishes a version; see "Policy editor". The hosted demo policy is loaded by `supabase/scripts/hosted/demo-tenant-mitiga.sql`. |
| CRA v2 engine | `built` | `20260926100000_cra_engine_v2.sql` (`app.evaluate_cra`); suite `090` (121 assertions, 24-case casebook); `lib/domain/cra-engine.ts`, `tests/domain/cra-engine.test.ts` | The policy numbers are DRAFT until the compliance lead signs them off (ADR 0012, decision 6). |
| Customer assessment | `built` | `20260927100000_customer_assessment.sql`, `20261006100000_customer_assessment_form.sql`, `20261006110000_bound_factor_facts.sql`; routes `/workspace/customers`, `/workspace/customers/new`, `/workspace/customers/[customerId]`; suites `100`, `110`; `tests/app/customer-actions-boundary.test.ts` | |
| Transaction triggers | `built` | `20261125100000_transaction_triggers.sql` (`public.run_transaction_check`); suite `140`; `components/workspace/transaction-trigger-panel.tsx`, `tests/domain/transaction-check.test.ts` | Runs on aggregated totals a user types in. The ruleset thresholds are constants in the SQL function `app.transaction_ruleset_v1()`, not rows in a policy table. |
| Decision chain (MLRO, then board on escalation) | `built` | `20261123100000_customer_decisions.sql` (`public.record_customer_decision`); suite `120`; `tests/domain/customer-decision.test.ts` | |
| Required-action completions | `built` | `20261126100000_action_completions_and_audit_pack.sql` (`public.record_action_completion`); suite `150` | |
| Audit pack | `built` | Route `/workspace/customers/[customerId]/audit-pack`; `20261126100000_action_completions_and_audit_pack.sql` (`public.record_audit_pack_generated`); suite `150`; `tests/domain/audit-pack.test.ts`, `tests/app/audit-pack-boundary.test.ts` | A print-ready page plus a JSON download (`components/workspace/audit-pack-toolbar.tsx`). No server-generated PDF or CSV file was found. |
| Bulk import (CSV) | `built` | `20261129100000_customer_bulk_import.sql` (`public.import_customers`); route `/workspace/customers/import`; suite `180`; `tests/domain/customer-import.test.ts` | |
| Portfolio report | `built` | Route `/workspace/customers/report`; `20261130100000_portfolio_report_audit.sql`; suite `190`; `tests/domain/portfolio-report.test.ts` | Includes a CSV export (`lib/domain/portfolio-report.ts`). |
| Member invitations | `built` | `20260913090000_auth_tenant_bootstrap.sql`, `20261127100000_member_invitations.sql`; route `/workspace/access`; suites `030`, `160`; `tests/app/access-invitations-boundary.test.ts` | Creating an account for a new email uses the Supabase admin API on the server (`lib/supabase/invitations-repository.ts`). |
| Platform console | `built` | `20261124100000_platform_console.sql`; routes `/platform`, `/platform/new`, `/platform/tenants/[tenantId]`; suite `130`; `tests/app/platform-console-boundary.test.ts` | |
| Operator work queue | `built` | Route `/workspace` (`components/workspace/operator-work-queue.tsx`); `lib/domain/work-queue.ts`, `tests/domain/work-queue.test.ts` | No migration of its own; it reads existing customer and assessment data. |
| Supplier slice | `built` | `20260914120100_suppliers.sql`, `20260914120200_supplier_evaluation.sql`, `20260915120000_supplier_final_decisions.sql`; routes `/workspace/suppliers`, `/workspace/suppliers/[supplierId]`; suites `040`, `050` | Reference implementation only; not extended (ADR 0012, decision 3). |
| Test-environment role switcher | `built` | `lib/demo-switcher.ts`, `app/demo-actions.ts`; `tests/app/demo-switcher.test.ts` | Off unless three server variables are set. Must be off before the first real client. |
| Periodic review scheduling | `partial` | `20260927100000_customer_assessment.sql` (`next_review_due`); suites `100`, `170`; `lib/domain/workspace-dashboard.ts` | The due date is computed, stored and shown. No job, reminder or automatic re-assessment was found. |
| Transactional email | `partial` | `docs/auth/hosted-auth-configuration.md`, `docs/auth/templates/`; `tests/app/auth-email-boundary.test.ts`; `20260912120600_notifications.sql` | Auth emails are sent by Supabase Auth through SMTP, configured outside the repository. Application-owned sending has tables (`notification_requests`, `notification_templates`) but no sender. |
| Policy editor | `prototype` | `app/(prototype)/policies/page.tsx`, `app/(prototype)/policies/[id]/page.tsx` | Fixture screens only. |
| Case management | `prototype` | `app/(prototype)/cases/`; `20260912120400_cases.sql`; suites `010`, `020` | The tables and their authorization are real and tested. The only screens are fixture prototypes. |
| HTTP API | `not started` | `find apps/web/app -name route.ts` returns only `app/auth/confirm/route.ts` | `public.api_clients` exists as a table (`20260912120500_integrations.sql`, suite `020`). There is no endpoint and no key issuance. |
| Webhooks | `not started` | No sender, worker or signing code in `apps/web/app` or `apps/web/lib` | `webhook_endpoints` and `webhook_deliveries` exist as tables (`20260912120500_integrations.sql`, suite `020`). |
| MFA / SSO | `not started` | Searched `apps/web/app`, `apps/web/lib` and `supabase/migrations` for `mfa`, `totp`, `sso`, `saml`: no implementation | |
| Billing | `not started` | Searched the same paths for `billing`, `stripe`, `invoice`, `subscription`: no implementation | |
| Transaction ingestion | `not started` | `public.run_transaction_check` accepts totals only (`20261125100000_transaction_triggers.sql`) | No raw transaction table or intake route. |
| Vendor connectors | `not started` | No connector code under `apps/web/lib` | Screening results are entered as assessment facts. |
| Hosted database deployment | `unknown` | `20261006120000_extensions_search_path_for_digest.sql` (its header describes a failure observed in the hosted project), `supabase/scripts/hosted/demo-tenant-mitiga.sql` | A hosted project exists and has run these migrations. Which migrations are applied today is not recorded in the repository. `supabase migration list` against the project resolves it. |

## Count by state

| State | Count |
|---|---|
| `built` | 16 |
| `partial` | 2 |
| `prototype` | 2 |
| `not started` | 6 |
| `unknown` | 1 |

## Known gaps in the evidence

- **`audit_events` immutability has a trigger but no direct test.** `trg_audit_events_append_only` exists (`20260912120700_audit.sql`). No suite attempts an `UPDATE` or `DELETE` on `audit_events`; a search of `supabase/tests/*.sql` for both statements found none.
- **The other prototype routes are not listed as capabilities.** `company`, `operator`, `super-admin`, `entities`, `evaluations`, `tenants`, `onboarding`, `invite` and `denied` under `app/(prototype)/` are fixture screens. The real equivalents are the `/workspace` and `/platform` routes above.

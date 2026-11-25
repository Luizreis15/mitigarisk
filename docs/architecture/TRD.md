# MITIGA — technical reference (TRD)

An entry point to the technical reasoning, not a restatement of it. The decisions live in the twelve ADRs under `docs/adr/`; this page says which invariants no change may violate, which ADR answers which question, and how the runtime is shaped. Where this page and an ADR disagree, the ADR is right and this page has a defect.

For what is built today, read `docs/STATUS.md`. For bounded contexts and provider boundaries, read `PLATFORM-ARCHITECTURE.md` and `../contracts/INTEGRATION-BOUNDARIES.md`.

Paths are relative to the repository root unless they start with `apps/web/`. Migrations are in `supabase/migrations/`; SQL suites are in `supabase/tests/`.

## 1. The five invariants

No change may violate these. Each one names the ADR that establishes it and the mechanism that enforces it. Where the enforcement is incomplete, that is stated.

### 1.1 Policy is data, never code

- **Established by:** ADR 0007 (the engine takes a versioned policy as input) and ADR 0012, decision 2 (categories, value→points maps, overrides, bands and required actions are the policy). No ADR states the rule in these exact words.
- **Enforced by:** the policy lives in rows (`policy_versions`, `policy_categories`, `policy_category_factors`, `policy_overrides`, `policy_cra_bands`). Publishing runs `trg_policy_versions_cra_publish_validation` (`20260926100000_cra_engine_v2.sql`); suite `090-cra-engine-v2.sql` proves a malformed policy cannot be published (weights not summing to 100, gaps or overlaps in bands, invalid points maps, unknown override effects).
- **Known exception:** the transaction trigger thresholds are constants in the SQL function `app.transaction_ruleset_v1()` (`20261125100000_transaction_triggers.sql`), versioned by a label inside the function, not by a policy row. Changing a threshold today requires a migration.

### 1.2 The evaluator is a pure function

No clock, no randomness, no network, no database.

- **Established by:** ADR 0007 (pure, typed, framework-independent TypeScript with no I/O) and ADR 0012, decision 4.
- **Enforced by:**
  - TypeScript reference: `apps/web/lib/domain/cra-engine.ts` imports no client and performs no I/O. `apps/web/tests/domain/cra-engine.test.ts` runs the 24-case casebook and asserts determinism.
  - Transaction evaluator: `app.evaluate_transaction_triggers(jsonb)` is declared `immutable`.
  - Both evaluators are checked against the same fixtures by the SQL suites `090` and `140`.
- **Where the rule is narrower than its wording:** the database evaluator `app.evaluate_cra` is declared `stable`, not `immutable`. It reads the published policy rows for the given version and writes nothing; its body uses no clock and no randomness. "No database" therefore holds for the TypeScript reference and for the transaction evaluator, and means "reads only the immutable published policy" for `app.evaluate_cra`. Suite `090` asserts the result is deterministic and that the function is not executable by `authenticated` or `anon`.
- **Not enforced by a test:** no test inspects either evaluator's source for clock or randomness calls.

### 1.3 Evidence is append-only, enforced by trigger

Published policy versions, assessments, decisions and audit events cannot be changed or deleted, whatever role attempts it.

- **Established by:** ADR 0004.
- **Enforced by:** `BEFORE UPDATE OR DELETE` triggers that raise `23001`.

| Evidence | Trigger | Test |
|---|---|---|
| Published policy version and its children | `app.forbid_published_policy_version_mutation`, `trg_policy_*_guard` | Suites `010`, `090` |
| Customer assessments | `trg_customer_assessments_append_only` | Suite `100` (update and delete refused, even as superuser) |
| Customer decisions | `trg_customer_decisions_append_only` | Suite `120` |
| Transaction checks | `trg_customer_transaction_checks_append_only` | Suite `140` |
| Action completions | `trg_customer_action_completions_append_only` | Suite `150` |
| Supplier final decisions | append-only trigger | Suite `050` |
| Audit events | `trg_audit_events_append_only` (`20260912120700_audit.sql`) | **None found.** No suite attempts an `UPDATE` or `DELETE` on `audit_events`. |

### 1.4 The system recommends; only an identified human decides

- **Established by:** ADR 0007 (the decision boundary is structural), ADR 0004 and ADR 0012 (guiding principle).
- **Enforced by:**
  - The engine result has no decision field: `apps/web/tests/domain/evaluation-engine.test.ts` asserts that `decision` and `finalDecision` are absent.
  - A decision is written only by `public.record_customer_decision` (`20261123100000_customer_decisions.sql`), which stores the caller as decider. Suite `120` proves that an admin of another tenant and a platform administrator cannot decide, that the board decides only after an MLRO escalation, and that nothing can be decided after the final level.
  - The supplier slice follows the same rule: suite `050` proves `decided_by` cannot be forged.

### 1.5 The tenant is a hard boundary

- **Established by:** ADR 0003 (capability-based row-level security) and ADR 0011 (a requested tenant id is a lookup key, never authorization).
- **Enforced by:** negative-authorization tests.
  - Suite `010-rls-tenant-isolation.sql`: cross-tenant writes and reads are refused.
  - Suite `060-uniform-authorization.sql`: suspended tenants and cross-tenant references.
  - Suite `070-platform-admin-operational-boundary.sql`: a platform administrator, even one who also holds a tenant membership, cannot read or write tenant operations.
  - `apps/web/tests/supabase/tenant-context.test.ts`: an invalid tenant selection fails closed and is never replaced by another tenant.

## 2. ADR index

| ADR | Question it answers | Read it when |
|---|---|---|
| 0001 Modular monolith and trunk-based delivery | Why one deployable and one permanent branch? | You want to extract a service or keep a long-lived branch. |
| 0002 English-first and market-neutral product | What language and locale assumptions may the product and data model make? | You add copy, a locale-dependent field, or a country-specific rule. |
| 0003 Capability-based authorization | How does a row-level security policy know who may do what? | You add a table, a capability, a role or an RLS policy. |
| 0004 Immutable audit and evidence | What cannot be changed, and what enforces that? | You add a table that holds evidence, or need to correct a finalized record. |
| 0005 TASK-002 scope boundaries | What did the foundation deliberately leave out? | You find a gap in plans, quotas, background jobs or generated types and wonder whether it was missed. |
| 0006 Auth and tenant bootstrap RPCs | How do multi-step membership flows stay atomic and audited? | You add or change an invitation, activation or tenant-creation flow. |
| 0007 Deterministic evaluation engine | How does a score get computed, and what counts as a recommendation? | You change scoring, missing-data handling, thresholds or reason codes. Read ADR 0012 with it, which amends its authority. |
| 0008 Vercel preview adapter | How does one build target both Cloudflare and Vercel? | You touch `vite.config.ts` or the deployment build. |
| 0009 Supabase auth session foundation | How do the browser and the server share a session? | You touch sign-in, cookies or the Supabase clients. |
| 0010 Real auth route integration | Why are real routes separate from the prototype routes? | You want to put a real session check in front of a fixture screen. |
| 0011 Tenant authorization boundary | How is a tenant selected and proven, and what is middleware not for? | You add a tenant-scoped route or are tempted to authorize in middleware. |
| 0012 Customer CRA engine as MVP core | What is the product, and where does scoring authority live? | Before any product feature. It also amends ADR 0007. |

## 3. Runtime shape

**Where scoring authority lives.** In the database. The score, band, due-diligence level, reason codes and required actions that count are computed inside `security definer` RPCs from persisted inputs and the tenant's published policy version. A caller never supplies a result (ADR 0012, decision 4).

| Operation | RPC | Evaluator it calls |
|---|---|---|
| Customer assessment | `public.run_customer_assessment` | `app.evaluate_cra` |
| Transaction check | `public.run_transaction_check` | `app.evaluate_transaction_triggers` |
| Supplier evaluation (reference slice) | `public.run_supplier_evaluation` | weighted engine in the same function |
| Human decision | `public.record_customer_decision` | none: it records a decision, it does not compute one |

Each write RPC checks authorization explicitly, writes its audit event in the same transaction, and stores an append-only row.

**What the TypeScript engine is for.** `apps/web/lib/domain/cra-engine.ts` and `apps/web/lib/domain/evaluation-*.ts` are a non-authoritative reference and test oracle. They document the algorithm and let tests detect drift from the SQL implementation: both run the same casebook (`apps/web/tests/fixtures/cra-casebook-v1.json`), and `apps/web/tests/domain/customer-assessment-sql-sync.test.ts` and `tenancy-sql-sync.test.ts` fail when a mirrored constant drifts. The TypeScript engine never writes a result. Extending the engine means changing the SQL first and keeping the reference in step.

**What the client layer may and may not do.**

| May | May not |
|---|---|
| Call one RPC per operation through the request's own cookie-bound Supabase client | Compute or store a score, band or decision |
| Validate input shape before the call | Trust a tenant id, actor id, capability or role sent by the browser |
| Present results and map stable codes to display copy | Reference a service-role credential in client code (`apps/web/tests/supabase/no-service-role-in-client-boundary.test.ts`) |
| Refresh the session in middleware | Authorize in middleware (`apps/web/tests/app/middleware-session-refresh-only.test.ts`) |
| | Use `localStorage` or `useSearchParams` for authorization in workspace components (`apps/web/tests/app/workspace-component-boundary.test.ts`) |

The one server-side use of an administrative client is creating an account for an invited email (`apps/web/lib/supabase/invitations-repository.ts`); the membership itself is still created by `public.invite_member` as the inviting admin.

## 4. Deliberately not decided yet

Stop looking for these: no ADR decides them, and nothing in the repository implements them.

| Open question | What exists today |
|---|---|
| HTTP API shape | `PLATFORM-ARCHITECTURE.md` states general rules (authentication, idempotency, stable error codes). `docs/product/PRODUCT-DIRECTION-MVP-25.md` names two endpoints as scope. There is no route, no key issuance and no ADR. The `api_clients` table is a placeholder. |
| Webhook delivery semantics | `webhook_endpoints` and `webhook_deliveries` model a delivery state machine (ADR 0005). No worker, retry policy, signing scheme or provider is chosen. |
| Policy editor model | A published version is immutable and a correction is a new version (ADR 0004). How a user authors, copies and publishes a version is undecided; the only screens are prototypes. |
| List-versioning strategy | Whether occupation, country and similar lists are versioned with the policy or separately is undecided. Today a factor carries its own inline value→points map. |

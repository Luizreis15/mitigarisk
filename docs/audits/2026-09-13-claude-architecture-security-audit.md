# MITIGA architecture and security audit — 2026-09-13

- Auditor: Claude Code, independent audit role (TASK-021)
- Audit baseline: annotated Git tag `audit-baseline-2026-09-13-r2`
- **Resolved commit SHA: `93d02fd8b206e0dea2b36af0dec9f1e91847196a`** (`docs(audit): advance baseline after TASK-018 integration`). Verified via `git rev-parse audit-baseline-2026-09-13-r2^{commit}` and `git rev-list -n 1 audit-baseline-2026-09-13-r2`; the checked-out `HEAD` of branch `audit/claude-architecture-security-2026-09-13` matches exactly. No discrepancy between the task contract's stated baseline and the actual tag.
- Companion audit: TASK-020 (Cursor, product/experience audit), coordinated per `docs/audits/README.md`. This report does not duplicate TASK-020's UI/copy/accessibility scope except where a finding is inseparably a security concern (e.g. what a page reveals).
- No code, schema, or hosted system was changed to produce this report. No `.env*` file was read. No hosted Supabase or Vercel project was accessed. No credential was requested.

## Executive summary

MITIGA's implemented foundation (identity, tenancy, capability-based authorization, immutable evidence, deterministic evaluation scoring, and the real-but-minimal `/workspace` authentication boundary) is **structurally sound and fail-closed everywhere it was exercised**: every RLS-protected table restricts to the caller's own tenant, every authorization-relevant Postgres function raises rather than silently permits on failure, session identity is always re-derived from a verified Supabase call, no service-role credential is reachable from browser code (verified both at runtime and by source inspection), and the deterministic evaluation engine validates every input at runtime rather than trusting TypeScript types alone. **No critical, currently-exploitable vulnerability was found.**

The audit did find real gaps, all evidence-backed and none requiring speculation:

- **The real tenant-authorization boundary does not exist yet.** TASK-019 — the task that was to add server-authorized tenant selection and session-refresh middleware — has no handoff and no merged code at this baseline (CLA-001). Every prior task (TASK-009 ADR 0007, TASK-013 ADR 0009, TASK-015, TASK-018) correctly deferred this work *to* TASK-019, and the deferral chain is honest and consistent — but the chain currently terminates in nothing. This is the single largest completeness gap in the repository.
- **A real, provenance-spoofing gap exists in six columns** across `policy_versions`, `api_clients`, `webhook_endpoints`, `notification_templates`, and `cases` — a tenant member already holding the relevant in-tenant `*.manage` capability can attribute an action to an arbitrary user ID, including one that never performed it (CLA-003). This does not cross a tenant boundary or escalate privilege, but it directly undermines the "responsible actor" invariant that `docs/architecture/PLATFORM-ARCHITECTURE.md` and `.cursor/rules/20-data-security.mdc` both name as a required audit-evidence field.
- **A code comment inside `apps/web/lib/supabase/session.ts` is self-contradictory and factually wrong** about whether session-refresh middleware exists (CLA-002) — a documentation-accuracy defect with real risk, since a future engineer trusting the wrong half of the comment could assume a protection is in place that isn't.
- The **role → capability grant matrix still has no recorded product-owner ratification**, three tasks after it was first flagged as needing one, and every real-auth feature since TASK-013 was built on top of it unratified (CLA-010).

Fourteen findings are recorded below (CLA-001–CLA-014): 0 critical, 2 high, 2 medium, 7 low, 3 observation. None is a currently-exploitable cross-tenant data leak, secret exposure, or authentication bypass in shipped code. Section "Release gates" states precisely what must close before real (non-Development, non-fixture) tenant data or users are in scope.

## Methodology

Full-repository read at the frozen commit: `AGENTS.md`, `CLAUDE.md`, `apps/web/AGENTS.md`, `docs/architecture/PLATFORM-ARCHITECTURE.md`, `docs/architecture/VERCEL-PREVIEW-ADAPTER.md`, `docs/governance/MULTI-AGENT-DEVELOPMENT.md`, `docs/governance/MERGE-RUNBOOK.md`, `docs/contracts/INTEGRATION-BOUNDARIES.md`, `docs/reviews/TASK-002-integration-review.md`, `docs/audits/README.md`, all ten accepted ADRs (`docs/adr/0001`–`0010`), every task contract and handoff `docs/tasks/TASK-001` through `TASK-021` (including both TASK-005 files), all `docs/security/*.md`, `.cursor/rules/*.mdc`, `SECURITY.md`, `CONTRIBUTING.md`, every file under `apps/web/lib/domain/**`, `apps/web/lib/supabase/**`, `apps/web/lib/i18n/**`, `apps/web/app/**`, `apps/web/components/auth/**` and `apps/web/components/workspace/**`, the relevant `apps/web/components/prototype/**` and `apps/web/lib/demo/**` files touching the newest routes (entities, super-admin tenants), all twelve `supabase/migrations/*.sql` in filename order, `supabase/seed.sql`, all three `supabase/tests/*.sql` suites plus `supabase/tests/README.md`/`run-local-verification.sh`, `apps/web/vite.config.ts`, `apps/web/vercel.json`, `apps/web/scripts/verify-vercel-build.mjs`, `.github/workflows/quality.yml`, `.githooks/pre-commit`, and every test file under `apps/web/tests/**`.

Four parallel evidence-gathering passes (task-contract/ADR reconciliation; auth/session/authorization; database/RLS/tenant isolation; evaluation-engine/new-routes/deployment) were run read-only, each required to cite exact file paths and line numbers or exact quoted snippets for every claim. Every finding below was independently spot-verified by direct file reads before being recorded (exact line numbers quoted in this report were re-read personally, not taken on trust from a single pass).

## Required local checks — exact results

```text
$ cd apps/web && npm test
ℹ tests 106
ℹ pass 106
ℹ fail 0

$ cd apps/web && npx tsc --noEmit -p tsconfig.json
(no output — zero diagnostics)

$ cd apps/web && npm run build
✓ built in ~2s per environment (rsc/ssr/client)
Route (app) list includes all 21 routes (/, /cases, /cases/:id, /company,
/company/admin, /company/admin/members, /denied, /entities, /entities/:id,
/evaluations/:id, /evaluations/new, /invite, /onboarding, /operator,
/policies, /policies/:id, /reset-password, /super-admin,
/super-admin/tenants, /super-admin/tenants/:id, /tenants, /workspace)
Build complete.

$ cd apps/web && npm run verify:vercel
✓ built in ~17s
✓ .vercel/output/ is a genuine Vercel Build Output API v3 deployment:
  config.json (v3), a Node.js function with a real handler, and a
  static/_next client bundle.

$ ./scripts/check-secrets.sh
Secret check passed.

$ ./scripts/verify-web.sh
(oxlint: no output — clean)
vinext build succeeded
Web verification passed.
```

Supplementary (not in TASK-021's required list, run for additional evidence):

```text
$ cd apps/web && npm audit --omit=dev --audit-level=high
found 0 vulnerabilities

$ ./supabase/tests/run-local-verification.sh
(applies all 12 migrations, seed.sql, and all three numbered SQL
verification suites against a disposable, credential-free local
PostgreSQL instance — no hosted project, no Docker)
==> all checks passed
```

**Manual Development checklist status: pending.** `docs/security/TASK-015-manual-test-checklist.md`'s 11-step manual checklist requires a configured Development environment and existing test Auth users, both of which require hosted Supabase access this audit does not have and must not request. Reported as pending per TASK-021's explicit instruction, not weakened or simulated.

## Task contract reconciliation (TASK-001 through TASK-019)

Every task contract and handoff through TASK-019 was read and cross-checked against actual code/commits. Full detail is folded into the findings below; summary:

- **No scope-creep violation was found.** Every task's actual diff stays within its declared "in scope" file globs, with one trivial, disclosed exception (TASK-002 added a one-line `apps/web/tsconfig.json` change not itemized in its original file list, but stated in its own handoff).
- **No renamed/missing/invented migration, RPC, capability key, or role key** was found anywhere a document references one — all cross-references (ADR 0003's "17 capabilities / 6 roles," ADR 0006's five RPC names, TASK-006's migration filenames) resolve correctly against the actual schema at this commit.
- **No TODO/FIXME/XXX markers** exist in tracked source or docs — this repository's convention is to record deferred work formally in ADRs and task handoffs, and that convention was followed consistently.
- **The TASK-018 → TASK-019 dependency chain is the one substantive break**: TASK-018 is merged (confirmed: its merge commit is an ancestor of this baseline, immediately followed by the baseline-advance commit), but TASK-019 itself has no handoff, no merged commits, and no code (`apps/web/middleware.ts` does not exist; `apps/web/lib/domain/workspace-access.ts` has no tenant-selection logic). See CLA-001.
- **The role → capability matrix ratification gap** (first flagged in TASK-002's own handoff and its integration review) remains open three tasks later with no recorded resolution — see CLA-010.

## Findings

### CLA-001 — Real tenant authorization boundary (TASK-019) does not exist at this baseline

- **Severity:** High. **Confidence:** High.
- **Affected boundary:** `apps/web/lib/domain/workspace-access.ts`, `apps/web/app/workspace/page.tsx`, `apps/web/middleware.ts` (absent), `docs/tasks/TASK-019-claude-tenant-authorization-boundary.md` (no handoff section).
- **Evidence:** `find apps/web -iname "middleware*" -not -path "*/node_modules/*"` returns only a Vinext-generated build artifact under `apps/web/dist/`, never a source `middleware.ts`. `docs/tasks/TASK-019-claude-tenant-authorization-boundary.md` ends at its contract (no "## Handoff" section). TASK-015's own handoff (`docs/tasks/TASK-015…md`, "Known limitations") and TASK-018's own handoff (`docs/tasks/TASK-018…md:191-192`, "`/workspace` still does not select a tenant... that remains TASK-019") both name TASK-019 as the owner of this work.
- **Failure/threat scenario:** This is not itself an exploitable defect in shipped code — `/workspace` today only ever shows an aggregate membership count, never tenant-specific data, so there is nothing for a client-supplied tenant ID to currently subvert. The risk is forward-looking and structural: the entire product's plan to expose real, tenant-scoped operational data depends on a server-side "prove membership, then check capability" boundary that does not exist in code yet. If a future task wires a real per-tenant route directly to `identity.userId` without this boundary (for example, trusting a URL path segment as the active tenant), there is currently no reusable, tested primitive to prevent it — `requireAuthenticatedIdentity()` only proves *who* signed in, never *which tenant* they may act in.
- **Impact:** Tenant isolation (blocking, not yet breached), integrity (blocking), rollback (none — no code exists to roll back).
- **Recommended remediation:** Resume TASK-019 exactly as scoped (it was explicitly paused, not abandoned, per the task's own "Inputs and dependencies" section, which is now satisfied). Do not let any future task build a real, tenant-scoped product route ahead of it.
- **Acceptance test:** TASK-019's own acceptance criteria 1–6, already fully specified in its contract, including the full negative matrix (no session, expired session, no membership, suspended/invited/removed membership, arbitrary cross-tenant ID, stale selection, missing capability, RPC failure, multiple memberships).
- **Owner:** Claude Code (TASK-019's declared owner).
- **Classification:** Release blocker — for any task that would expose real, tenant-scoped operational data. Not a blocker for the current fixture-only preview, which this finding does not affect.

### CLA-002 — Self-contradictory, factually incorrect comment about session-refresh middleware

- **Severity:** Medium. **Confidence:** High.
- **Affected boundary:** `apps/web/lib/supabase/session.ts:39-42`.
- **Evidence — exact quote, re-read directly at this commit:**
  ```
  } catch {
    // Called from a Server Component, where cookies are read-only.
    // Safe as long as middleware.ts refreshes the session on every
    // request (it does — see apps/web/middleware.ts).
  }
  ```
  This directly contradicts the file's own top-of-file comment sixteen lines earlier (`session.ts:14-24`): *"a middleware that refreshes the session on every request is the recommended way to make that safe in general — deliberately deferred to the future UI integration task, since `apps/web/middleware.ts` sits outside this task's declared file scope."* Both comments exist in the same file at the same commit; the inline one (inside the `catch` block that actually matters operationally) was never updated when the top-of-file comment was corrected during TASK-015, and `apps/web/middleware.ts` in fact does not exist (confirmed under CLA-001).
- **Failure/threat scenario, traced precisely:** `createServerSupabaseClient()`'s `setAll` silently no-ops (via the `catch`) when called from a Server Component, which is exactly where `resolveRequestIdentity()`/`/workspace` call it. When a user's access token needs refreshing, `client.auth.getUser()` computes a refreshed token in memory for that single request, but the refreshed cookie value is never written back to the browser (no middleware exists to do so, and a Server Component cannot set response cookies). On the next navigation the browser still presents the stale token; this repeats until the underlying refresh token itself is exhausted or rotated, at which point `getUser()` returns `AuthSessionMissingError`/`session_expired`, `resolveRequestIdentity()` throws, and `requireAuthenticatedIdentity()` redirects to `/`. **Net effect: an active, legitimately-signed-in user can be logged out earlier than necessary on read-only navigation of `/workspace`**, a fail-safe (not fail-open) degradation — but the comment actively hides that this degradation exists.
- **Impact:** Availability/UX (early logout — fails safe, not fails open); documentation-integrity risk for whoever next reads this file and trusts the wrong comment.
- **Recommended remediation:** (a) immediately fix the comment at `session.ts:41-42` to match the true, deferred status (a one-line, no-code-behavior change, in scope for a documentation-only follow-up commit); (b) implement TASK-019's middleware scope item, which closes the underlying degradation.
- **Acceptance test:** No code assertion possible for a comment; verify by reading — the comment must not claim `apps/web/middleware.ts` exists until it does.
- **Owner:** Claude Code.
- **Classification:** Pre-MVP. Not release-blocking on its own (fails safe), but should be fixed before real-session usage grows, and before another engineer builds on the false assumption.

### CLA-003 — Provenance/actor columns not pinned to `auth.uid()` on six columns across five tables

- **Severity:** High. **Confidence:** High.
- **Affected boundary:** `supabase/migrations/20260912120200_risk_policy.sql` (`policy_versions.created_by`, `.published_by`), `20260912120500_integrations.sql`/`20260912120800_security_and_english_first_hardening.sql` (`api_clients.created_by` on UPDATE, `api_clients.revoked_by`, `webhook_endpoints.created_by` on UPDATE), `20260912120600_notifications.sql`/`20260912120800…sql` (`notification_templates.created_by` on UPDATE), `20260912120400_cases.sql`/`20260912120800…sql` (`cases.closed_by`).
- **Evidence:** `policy_versions_insert`'s `WITH CHECK` (`20260912120200_risk_policy.sql:135-138`) tests only the `policy.manage` capability, never `created_by = auth.uid()`; `policy_versions_update`'s `WITH CHECK` (`:143-152`) tests only capability, never `published_by = auth.uid()`. The hardening migration's `policy_versions_publication_provenance` CHECK (`20260912120800…sql:86-92`) enforces only *non-null-ness* of `published_by`, not that it equals the caller. `api_clients_update`/`webhook_endpoints_update`/`notification_templates_update` (all replaced in the hardening migration, `20260912120800…sql:306-309,317-320,333-342`) check only the relevant `*.manage` capability, with no provenance clause and no identity-freeze trigger for these three tables (unlike `webhook_deliveries`, which does get `guard_webhook_delivery_history`, or `cases`, which gets `guard_case_identity` for every column *except* `closed_by`, per `20260912120800…sql:234-255` — `assigned_to`/`closed_by` are conspicuously absent from that trigger's frozen-column list).
- **Failure/threat scenario:** A tenant member who already legitimately holds `policy.manage`, `policy.publish`, `integration.manage`, `notification.manage`, or `case.manage` for their own tenant — not a cross-tenant or unauthorized actor — can set or later rewrite one of these six columns to an arbitrary `auth.users.id`, including a user who never performed the action, or (since nothing checks the referenced id belongs to the same tenant) a user in a different tenant entirely. This does not grant unauthorized data access and does not cross the RLS tenant boundary for reads, but it corrupts the specific evidentiary claim `docs/architecture/PLATFORM-ARCHITECTURE.md`'s "Risk and audit invariants" section requires every risk result to carry ("responsible actor or service"), and directly violates `.cursor/rules/20-data-security.mdc`'s explicit rule: "Audit evidence is append-only and records actor, action, target, timestamp, and correlation ID." A policy authored or published under a forged `created_by`/`published_by`, or an API client/webhook/notification-template creation misattributed, is exactly the kind of evidence integrity a risk-management product cannot allow, since these fields would be relied on in a compliance or incident review.
- **Impact:** Auditability (high — corrupts the specific field the architecture doc calls out by name), integrity (high), tenant (low — no cross-tenant read/write access is gained).
- **Recommended remediation:** Add `WITH CHECK` provenance pins (`column = auth.uid()`) to each INSERT policy that doesn't already have one, and add identity-freeze triggers (following the exact pattern of `app.guard_case_identity`/`app.guard_webhook_delivery_history`, already proven in this codebase) blocking UPDATE of these columns entirely, or restricting `revoked_by`/`closed_by` specifically to be settable only once, only by `auth.uid()`, on the specific status transition that requires them (revocation, closure).
- **Acceptance test:** For each of the six columns, attempt an INSERT/UPDATE setting the value to a UUID that is not `auth.uid()`; expect rejection with the same `23001`/RLS-denial pattern already used for `evaluations.actor_id`/`cases.opened_by`/`case_evidence.uploaded_by`/`case_decisions.decided_by`. Add these as new numbered assertions in a follow-up `supabase/tests/*.sql` suite (this audit does not add one — out of scope per TASK-021).
- **Owner:** Claude Code (requires a new forward-only migration — not performed by this audit, which does not touch schema).
- **Classification:** Pre-MVP. Should close before any real tenant provisions real policies, API clients, webhooks, notification templates, or cases — i.e., before CLA-001/CLA-010 close and real usage begins. Not a blocker for the current fixture-only preview (none of these tables have any real rows yet — confirmed by both the empty `supabase/seed.sql` fictional-only data and zero application code touching `api_clients`/`webhook_endpoints`/`notification_templates`, per the database audit pass).

### CLA-004 — Evaluation engine does not itself re-authorize `policyVersionId`/`correlationId`, by design; mitigated today only by database constraints a future adapter must not bypass

- **Severity:** Low (documented design boundary, not a current defect). **Confidence:** High.
- **Affected boundary:** `apps/web/lib/domain/evaluation-engine.ts:34-37`.
- **Evidence:** `EvaluationEngineInput.policyVersionId`/`.correlationId` are explicitly documented as "opaque, already-authorized values... passed through, not validated against a database" (`evaluation-engine.ts:34,36`); ADR 0007 states directly: "The engine receives `policyVersionId` and `correlationId` as opaque, already-authorized values and passes them through unchanged; it performs no lookup, no tenant check, and no audit write of its own — those remain the responsibility of the adapter." Independently confirmed by the database audit pass: `evaluations.policy_version_id` carries a composite foreign key to `policy_versions (id, tenant_id)` (added by the hardening migration, `20260912120800…sql:69-73`, replacing the original single-column FK), and `evaluations_insert`'s RLS additionally requires `evaluation.run` capability *for that specific tenant_id* — meaning a caller cannot currently persist an evaluation whose `policy_version_id` belongs to a different tenant than the `tenant_id` on the row, even though the pure engine itself performs no such check. This exact cross-tenant-policy-reference case is positively tested in `supabase/tests/020-integration-hardening.sql:242-259` ("evaluation cannot reference another tenant policy").
- **Failure/threat scenario:** If a *future* adapter persists `EvaluationEngineResult` to the database while trusting a caller-supplied `policyVersionId` without independently re-verifying it belongs to the calling tenant *before* relying on any value derived from it (not just the final INSERT, which the database constraint would catch), a confused-deputy scenario is possible earlier in that adapter's own logic. The pure engine provides zero protection against this by design.
- **Impact:** Tenant, integrity — currently not exploitable (no adapter exists to exploit; the eventual database-level INSERT is already protected).
- **Recommended remediation:** When the future adapter (not scoped to any task yet) is built, its own task contract should explicitly require it to re-verify `policyVersionId` ownership against the calling tenant before any use, not rely solely on the eventual INSERT's FK/RLS rejection.
- **Owner:** Whoever is assigned the future Evaluation API adapter task.
- **Classification:** Accepted limitation, already disclosed in ADR 0007 — recorded here to ensure the disclosure is carried into that future task's contract, not lost.

### CLA-005 — Vercel build path depends on undocumented internals of two beta packages, mitigated by a manual workaround with no dedicated regression check

- **Severity:** Low. **Confidence:** Medium.
- **Affected boundary:** `apps/web/vite.config.ts:63-75` (the `resolve.alias` workaround), `apps/web/package.json` (`"vinext": "1.0.0-beta.9"`, `"nitro": "^3.0.260903-beta"`).
- **Evidence:** ADR 0008 documents the workaround's own origin directly: *"Rather than depend on undocumented resolver internals of two beta packages (`vinext@1.0.0-beta.9`, `nitro@3.0.260903-beta`), `vite.config.ts`'s Vercel branch aliases the three bare specifiers straight to their real `.css` files."* `apps/web/scripts/verify-vercel-build.mjs` asserts the *shape* of the Vercel build output (Build Output API v3, a function with a real handler, a static bundle) but does not assert anything about CSS content/correctness.
- **Failure/threat scenario:** A future `vinext`/`nitro` version bump that changes package internal file layout could silently produce a build that still passes `verify:vercel`'s shape checks while rendering with broken or missing styles on the actual Vercel deployment — a build-stability/regression risk rather than a security one.
- **Impact:** Availability/build-stability, not tenant/security.
- **Recommended remediation:** Pin `nitro`/`vinext` to exact versions (not `^`-ranged) and require re-running `verify:vercel` plus a manual visual check before either is bumped; consider adding a lightweight content assertion to `verify-vercel-build.mjs` checking that a known CSS class/token appears in the built static output.
- **Acceptance test:** After any `vinext`/`nitro` bump, `npm run verify:vercel` passes and a manual (or automated) visual check of `.vercel/output/static` confirms Tailwind classes render.
- **Owner:** Claude Code / Codex.
- **Classification:** Post-MVP.

### CLA-006 — Local SQL test coverage gaps: idempotency constraints and a DELETE-on-published-policy path are declared but never exercised; `README.md` omits the newest test file

- **Severity:** Low. **Confidence:** High.
- **Affected boundary:** `supabase/tests/010-rls-tenant-isolation.sql`, `020-integration-hardening.sql`, `030-auth-tenant-bootstrap.sql`, `supabase/tests/README.md`.
- **Evidence:** No test in any of the three suites attempts a duplicate-`idempotency_key` INSERT against `webhook_deliveries`/`notification_requests` to prove the `unique (endpoint_id, idempotency_key)`/`unique (tenant_id, idempotency_key)` constraints actually reject a replay (the constraints exist — `20260912120500_integrations.sql:56`, `20260912120600_notifications.sql:43` — only the proof-by-test is missing). `010-rls-tenant-isolation.sql`'s test 5 (`:165-203`) only exercises UPDATE against a published `policy_versions` row, never DELETE, even though `policy_versions_delete`'s RLS policy (`20260912120200_risk_policy.sql:154-157`) would permit an attempt that the immutability trigger must then reject — that trigger path is undocumented by any test. `supabase/tests/README.md:12-18` lists only `010` and `020`; `030-auth-tenant-bootstrap.sql` (13 assertions, confirmed executed by `run-local-verification.sh`'s glob) is not mentioned at all.
- **Impact:** Test-coverage/documentation hygiene — the underlying constraints and triggers are correctly declared in the schema; this finding is about proof, not about a missing control.
- **Recommended remediation:** Add a duplicate-idempotency-key negative test to `020` or a new suite; add a DELETE-on-published-`policy_versions` negative test; update `README.md` to list `030`.
- **Owner:** Claude Code.
- **Classification:** Post-MVP.

### CLA-007 — RPC doc comments overstate their own enforcement (say "capability-checked," actually enforced entirely by RLS)

- **Severity:** Observation. **Confidence:** High.
- **Affected boundary:** `supabase/migrations/20260913090000_auth_tenant_bootstrap.sql` — `public.invite_member()`'s comment (`:200-201`, "Capability-checked (tenant.manage_members)...") and `public.set_membership_status()`'s comment.
- **Evidence:** Neither function contains an explicit in-body capability check; both rely entirely on the underlying `memberships_insert`/`memberships_update` RLS policies (`security invoker`, confirmed by direct reading of both function bodies). This is intentional and correctly fail-closed per ADR 0006's stated design ("RLS and the trigger are the real enforcement boundary"), and is explicitly disclosed as an accepted residual risk in `docs/security/TASK-006-threat-model-addendum.md:22-29` for `set_membership_status` specifically — but `invite_member`'s comment still describes itself as doing the check, which it doesn't.
- **Impact:** None (the underlying RLS enforcement is real and tested) — documentation precision only.
- **Recommended remediation:** Reword the comment to match ADR 0006's own accurate framing ("relies on the memberships RLS policies to decide whether the caller may act").
- **Owner:** Claude Code.
- **Classification:** Accepted limitation / documentation only.

### CLA-008 — TASK-009's task contract text still uses an illustrative recommendation vocabulary ("allow"/"decline") that the shipped code and database intentionally do not use

- **Severity:** Observation. **Confidence:** High.
- **Affected boundary:** `docs/tasks/TASK-009-claude-deterministic-evaluation-engine.md:31` vs. the shipped `DecisionBand` type (`approve`/`review`/`reject`) and ADR 0007.
- **Evidence:** ADR 0007 (`:26-33`) explicitly documents the deliberate deviation and its reasoning; the task contract file itself was never amended with a clarifying note, so a literal read of the original contract still appears to contradict the (correct, reasoned) shipped behavior.
- **Impact:** None to running code — purely a risk that a future reader trusts the original contract's illustrative wording over the ADR's binding decision.
- **Recommended remediation:** Add a short "Implementation note: see ADR 0007" line to the TASK-009 contract rather than editing the historical acceptance-criteria text.
- **Owner:** Claude Code.
- **Classification:** Accepted limitation / documentation only.

### CLA-009 — Two disagreeing threshold-resolution implementations coexist in the domain layer

- **Severity:** Low. **Confidence:** High.
- **Affected boundary:** `apps/web/lib/domain/policy.ts` (`resolveDecisionBand`, from TASK-002) vs. `apps/web/lib/domain/evaluation-policy-config.ts`/`evaluation-scoring.ts` (from TASK-009).
- **Evidence:** ADR 0007 (`:76-85`) states directly that `resolveDecisionBand()`'s "first-match `>=`/`<=` scan over an unvalidated, caller-ordered array... can double-match an exact boundary," and that the new engine deliberately does not reuse it, "but does not modify or remove `resolveDecisionBand()`... that function may still be used elsewhere." Confirmed: `resolveDecisionBand` is still exported from `apps/web/lib/domain/index.ts` (barrel `export * from "./policy"`) and is not marked deprecated.
- **Failure/threat scenario:** If any future code calls `resolveDecisionBand()` directly (it is currently only exercised by its own unit test) to resolve a score against thresholds, it can produce an ambiguous or first-match-dependent result exactly at a boundary value, disagreeing with what the audited, tested engine (`evaluation-scoring.ts`'s `resolveBand`) would produce for the identical input.
- **Impact:** Design debt / correctness risk for any future caller of the older function.
- **Recommended remediation:** Either deprecate `resolveDecisionBand()` with a comment pointing to the engine's resolver, or fix its boundary semantics to match and add a test proving both agree at every threshold boundary.
- **Owner:** Claude Code.
- **Classification:** Post-MVP.

### CLA-010 — Role → capability grant matrix still has no recorded product-owner ratification

- **Severity:** Medium. **Confidence:** High.
- **Affected boundary:** `supabase/migrations/20260912120100_identity_and_tenancy.sql` (the `role_capabilities` seed), `docs/adr/0003-capability-based-authorization.md`.
- **Evidence:** TASK-002's own handoff (`docs/tasks/TASK-002…md`) first flagged this: "product sign-off on the role→capability seed before any UI is built on top of it." `docs/reviews/TASK-002-integration-review.md:57-60` repeats it as a "Residual decision." No later ADR or task handoff through TASK-019 records that this ratification happened, yet TASK-013 through TASK-018 (real sign-in, real session, real `/workspace`) were all built directly on top of this same unratified seed.
- **Failure/threat scenario:** Not itself a vulnerability — the seed is internally consistent and every check against it is fail-closed — but it is a business/process risk: the specific bundle of capabilities each role grants (e.g. what `operator` or `auditor` can actually do) was an implementer default, never confirmed against actual product policy, and real users could be granted an unintended combination once real tenants exist.
- **Impact:** Tenant/authorization correctness at the business-policy level (not the enforcement-mechanism level, which is sound).
- **Recommended remediation:** Human product-owner review and explicit written ratification (or a documented amendment) of the seeded role → capability matrix before any real, non-Development tenant is provisioned.
- **Owner:** Human decision (product owner).
- **Classification:** Release blocker — for real customer-facing tenant provisioning specifically. Does not block the current internal Development/fixture-only state.

### CLA-011 — Secret-hash column exposure decision still pending, ahead of any real integrations feature

- **Severity:** Low (currently schema-only, unused by any application code). **Confidence:** High.
- **Affected boundary:** `supabase/migrations/20260912120500_integrations.sql` (`api_clients.key_hash`, `webhook_endpoints.secret_hash`).
- **Evidence:** `docs/security/TASK-002-threat-model.md:68-70` and `docs/reviews/TASK-002-integration-review.md:61-62` both flag this as requiring "an explicit private-schema or column-exposure decision before real credentials are issued." Confirmed: `grep -rln "api_clients\|webhook_endpoints" apps/web/lib apps/web/app` returns no matches — no application code reads or writes either table at this commit.
- **Impact:** None currently (no real API client or webhook has ever been issued through this schema). Relevant only once the integrations feature is built.
- **Recommended remediation:** Before building real API-client/webhook issuance UI, decide whether hash columns move to a private (non-PostgREST-exposed) schema, or add explicit tests proving the hash column is never returned to a client that shouldn't see it (even a hash may warrant protection depending on the hashing scheme chosen).
- **Owner:** Claude Code / human decision on the exposure model.
- **Classification:** Post-MVP / accepted limitation until the integrations feature is scoped.

### CLA-012 — TASK-018's own accessibility acceptance criterion (keyboard/focus verification) was not actually performed

- **Severity:** Low. **Confidence:** High.
- **Affected boundary:** `apps/web/components/workspace/*.tsx`, `docs/tasks/TASK-018-cursor-authenticated-workspace-experience.md`.
- **Evidence:** TASK-018's own handoff, "Known limitations" (`docs/tasks/TASK-018…md:195-196`): *"Visual keyboard/focus verification at 375px and desktop widths was not performed here"* — self-reported, not inferred, because no browser tool was available to that agent session.
- **Impact:** The component code follows accessible patterns by construction (semantic elements, `aria-*` attributes per the source), but the specific acceptance criterion asking for verified keyboard/focus order at two viewport widths was not actually confirmed.
- **Recommended remediation:** Perform the verification (manual or automated, e.g. Playwright + `axe-core`) before treating TASK-018's acceptance criteria as fully closed.
- **Owner:** Cursor / Codex.
- **Classification:** Pre-MVP. This overlaps with TASK-020's accessibility scope; not duplicated in depth here.

### CLA-013 — Idempotency-bearing and append-only-evidence tables (`webhook_deliveries`, `notification_requests`, `cases`, `case_evidence`, `case_decisions`) remain schema-only, with zero application code touching them

- **Severity:** Observation. **Confidence:** High.
- **Affected boundary:** `supabase/migrations/20260912120400_cases.sql`, `20260912120500_integrations.sql`, `20260912120600_notifications.sql`; absence of corresponding files under `apps/web/lib/supabase/**`.
- **Evidence:** `grep -rln "webhook_deliveries\|notification_requests\|case_evidence\|case_decisions\|from(\"cases\")" apps/web/lib apps/web/app` returns zero matches.
- **Impact:** None — this is by design, matching ADR 0005's explicit scope boundary ("background-job/worker infrastructure... deliberately not built yet"). Recorded for the 35-day roadmap, not as a defect.
- **Recommended remediation:** None required now; track as a feature-completeness item, not a security gap.
- **Owner:** N/A.
- **Classification:** Post-MVP / expected by design.

### CLA-014 — Plain, unmapped `Error` objects in not-yet-wired RPC wrappers would leak raw Postgres/Supabase error text if connected to UI without following the existing `authErrorPresentationCode` pattern

- **Severity:** Low (future-integration hazard; no current exposure). **Confidence:** High.
- **Affected boundary:** `apps/web/lib/supabase/authorization.ts` (`hasCapability`), `memberships.ts` (`inviteMember`, `acceptInvitation`, `setMembershipStatus`), `tenant-bootstrap.ts` (`createTenant`).
- **Evidence:** Each throws a plain `Error` embedding `error.message` from the underlying RPC (e.g. `` `has_capability RPC failed: ${error.message}` ``, `` `Failed to bootstrap tenant: ${error.message}` ``). Confirmed via grep across `apps/web/app` and `apps/web/components`: none of these four functions is currently called from any route, Server Action, or component — this is a live gap only once they are wired up, not today.
- **Failure/threat scenario:** When a future task connects any of these to a real UI flow (tenant creation, invitations, capability pre-checks), if it surfaces the caught error's `.message` directly to the end user (as `apps/web/lib/supabase/auth.ts`'s functions deliberately do *not* — they route through `authErrorPresentationCode()`, which strips the message to a stable code), it would leak raw Supabase/Postgres error text, potentially including internal identifiers or SQL fragments.
- **Impact:** Information disclosure (future, not current).
- **Recommended remediation:** When wiring any of these four functions into a Server Action or route, follow `apps/web/lib/supabase/auth.ts`'s existing pattern exactly (typed error class + a presentation-code mapping function), not `error.message` directly. Worth stating explicitly in whichever future task's contract wires these up.
- **Owner:** Whoever is assigned the future tenant-administration/invitation UI task.
- **Classification:** Pre-MVP / future-integration hazard, disclosure recommended in the relevant future task's guardrails.

## Verified strengths (controls confirmed effective, not findings)

These are recorded because a security audit that only lists gaps understates what is actually working, and several controls were specifically exercised (not just read) during this audit:

- **Tenant isolation is complete across every table.** All fourteen application tables were individually checked for `tenant_id` presence, RLS enablement, and correct policy scoping; no gap was found. Composite foreign keys (`(id, tenant_id)` pattern) additionally prevent a child row from citing a different tenant's parent even if `tenant_id` were otherwise miskeyed — and the hardening migration closed a real historical gap here (single-column FKs on `evaluations.policy_version_id`/`cases.evaluation_id`) before this baseline.
- **Every authorization-relevant function fails closed.** No `SECURITY DEFINER` function, RPC, or trigger was found that silently defaults to a permissive outcome on an unhandled branch or RPC failure — confirmed by direct reading of `app.has_capability`, `app.is_platform_admin`, `public.record_audit_event`, `public.bootstrap_tenant`, `public.invite_member`, `public.accept_invitation`, `public.set_membership_status`, and `app.guard_membership_transition`.
- **Membership lifecycle transitions are fully guarded**, including a self-service invite-accept path added specifically to close a real gap discovered during TASK-006's own local verification (a fail-closed default the original design had missed).
- **Immutability guarantees for published policies and completed evaluations are strengthened, not weakened, by the hardening migration** — including closing a reparenting gap in `policy_factors`/`policy_thresholds`/`evaluation_reason_codes` that the original triggers had missed (checking only the new parent's status, not both old and new).
- **No service-role credential is reachable from browser code.** Verified both at runtime (`server-browser-guard.test.ts` dynamically imports `server.ts` with a faked `window` global and asserts it throws) and by source inspection (`no-service-role-in-client-boundary.test.ts`, `no-privileged-config-in-client-components.test.ts`, `workspace-component-boundary.test.ts`), plus an independent full-tree grep for `SERVICE_ROLE`/`service_role` across `apps/web/app`, `apps/web/components`, `apps/web/lib/i18n` returning zero matches outside the two server-only files that are supposed to reference it.
- **`resolveRequestIdentity()` fails closed on RPC failure**, with an exact code citation (`identity.ts:44-47`) confirming it throws rather than defaulting the caller to non-admin-but-still-proceeding.
- **Password-reset never reveals whether an email exists**, matching Supabase's own API design; confirmed at both the code and UI-copy level.
- **The deterministic evaluation engine validates every runtime-relevant input**, including the two specific checks (`contractVersion`, `decisionBand`) this audit was asked to confirm are enforced at runtime, not merely typed at compile time — both confirmed present and independently unit-tested with values that deliberately defeat the TypeScript type system.
- **Vercel/Cloudflare build-target isolation is complete and CI-enforced**: the two deployment paths share no plugin, no binding config, and `verify-vercel-build.mjs` asserts at build time that no Cloudflare artifact leaks into the Vercel output.
- **New fixture routes (entities, platform tenant governance) correctly avoid any real Supabase/network call**, are visibly labeled as fictional through the same shared prototype banner every earlier fixture route uses, and share no component or state with the real `/workspace` route — no confusion vector was found between real and fixture surfaces.

## Threat summary

No exploitable, currently-live vulnerability was found in shipped code. The realistic threat model at this baseline is:

1. **An already-privileged tenant insider misattributes an action** (CLA-003) — requires an existing, legitimate `*.manage` capability in the affected tenant; does not require compromising anyone else's credentials or crossing a tenant boundary for data access.
2. **A future engineer builds on an incomplete or misdocumented boundary** — CLA-001 (no tenant-authorization primitive exists to build on safely), CLA-002 (a comment claims a protection exists that doesn't), CLA-004/CLA-014 (documented boundaries a future adapter must not silently cross).
3. **A business-policy gap becomes a security gap once real users exist** — CLA-010 (unratified role/capability matrix), CLA-011 (pending secret-exposure decision, only relevant once integrations ship).

No finding in this report describes a way to read or write another tenant's data, bypass sign-in, or exfiltrate a secret from the code at this commit.

## Release gates (must close before real, non-Development tenant or user data)

1. **CLA-010** — human product-owner ratification of the role → capability matrix.
2. **CLA-001** — TASK-019 (tenant authorization boundary + session-refresh middleware) completed and its own full acceptance-criteria/negative-test matrix passing.
3. **CLA-003** — provenance-pinning migration for the six unpinned columns, with acceptance tests.
4. **CLA-002** — the false comment corrected (trivial, but should not ship uncorrected once CLA-001 lands and the file is touched anyway).
5. `docs/security/TASK-015-manual-test-checklist.md`'s 11-step manual checklist actually executed against a configured Development environment by a human/Codex with hosted access (this audit could not perform it).

CLA-011 gates only the integrations feature specifically, not general release.

## Recommended 35-day sequence

- **Week 1:** Human decisions that unblock everything downstream — role/capability ratification (CLA-010); secret-hash exposure model decision if integrations are planned within the window (CLA-011).
- **Weeks 1–2:** Resume and complete TASK-019 (CLA-001), including its full negative authorization matrix and session-refresh middleware; correct the stale comment in the same pass (CLA-002).
- **Week 2:** Provenance-pinning migration and tests for the six columns (CLA-003), following the exact pattern already proven for `evaluations`/`cases`/`case_evidence`/`case_decisions`.
- **Weeks 2–3:** TASK-018's deferred accessibility verification (CLA-012); resolve the `resolveDecisionBand` duplication (CLA-009); close the SQL test-coverage gaps and README drift (CLA-006); correct the two documentation-precision items (CLA-007, CLA-008).
- **Weeks 3–4:** Human/Codex execution of the manual Development checklist against a real configured environment; first real, tenant-scoped product route built on top of TASK-019's now-complete boundary, explicitly required to follow the CLA-004/CLA-014 guardrails disclosed above.
- **Weeks 4–5:** Vercel build-stability hardening (CLA-005) — pin exact `vinext`/`nitro` versions, add a content-level regression check.
- **Ongoing / post-window:** Background-job/worker infrastructure and idempotency exercise for webhooks/notifications (CLA-013); integrations feature build using the CLA-011 decision.

## Limitations of this audit

- No hosted Supabase or Vercel project was accessed; every RLS/immutability/idempotency claim about production behavior is verified only against the local, disposable, credential-free PostgreSQL harness (`supabase/tests/run-local-verification.sh`), which is a faithful reproduction by design (see `docs/architecture/PLATFORM-ARCHITECTURE.md`'s Supabase boundary and the harness's own README) but cannot detect hosted-project configuration drift (Auth provider settings, actual environment variable values, network/CDN behavior).
- The manual Development test checklist (`docs/security/TASK-015-manual-test-checklist.md`) was not executed — it requires hosted access this audit is explicitly barred from using, and is reported as pending per the task contract's own instruction.
- No browser was available to this audit; all frontend/accessibility observations are from source reading, not rendered/interactive verification (TASK-020, running in parallel, owns that verification lane).
- This report reconciles TASK-001 through TASK-019 per TASK-021's own contract text. TASK-020 (the sibling product/experience audit) is coordinated per `docs/audits/README.md` but not independently re-verified here; Codex's consolidation pass is expected to reconcile both reports against each other.
- No exploit was attempted against any finding; every threat scenario above is a traced code-path analysis, not a proof-of-concept.

## Security/tenant/privacy/audit impact of this audit itself

None — this task performed no write to application code, schema, or any hosted system. It read `apps/web/.env.example`'s file name only when confirming what is/isn't ignored by git (never its contents), never read `.env`/`.env.local`, never requested or handled a credential, and never connected to a hosted Supabase or Vercel project. The only artifacts produced are this report and the handoff appended to `docs/tasks/TASK-021-claude-architecture-security-audit.md`.

## Finding counts

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 (CLA-001, CLA-003) |
| Medium | 2 (CLA-002, CLA-010) |
| Low | 7 (CLA-004, CLA-005, CLA-006, CLA-009, CLA-011, CLA-012, CLA-014) |
| Observation | 3 (CLA-007, CLA-008, CLA-013) |
| **Total** | **14** |

CLA-013 is an observation of expected, by-design scope (matches ADR 0005), not a gap.

# MITIGA consolidated system audit — 2026-09-14

## Audit statement

This report consolidates the independent Cursor product/experience audit
(CUR-001–CUR-030) and Claude Code architecture/security audit
(CLA-001–CLA-014), then reconciles both against the implementation of TASK-019
merged into the consolidation branch. The source audits examined the frozen
baseline `audit-baseline-2026-09-13-r2` (`93d02fd`). This consolidation reflects
the later integrated state at `3c91650`.

No hosted Supabase or Vercel system was accessed while producing the source
audits. No `.env` file or credential was read. The hosted authentication and
visual acceptance checks remain explicitly pending.

## Executive conclusion

MITIGA has a structurally sound MVP foundation and no critical, currently
demonstrated authentication bypass, cross-tenant disclosure, or committed
secret. The platform is not yet ready for real customer operations: most
operational routes remain fixture-driven, hosted authentication has not been
verified end to end, and four high-priority controls or trust issues remain.

TASK-019 closes the largest baseline gap: the application now has a
request-scoped, server-validated tenant-selection boundary, negative
cross-tenant tests, session-refresh middleware, and a reusable
membership-plus-capability authorization primitive. The human owner ratified
that verified identity plus active membership permits entry to the generic
`/workspace` shell; each future operational route must enforce its specific
capability server-side.

## Consolidated disposition

### Open high-priority findings

1. **Identity confusion between real and demo experiences** — CUR-001. A real
   session can navigate from `/workspace` into a fixture screen that says
   “Signed in as” a fictional actor. This is a trust/review blocker before a
   customer-facing demonstration.
2. **Prototype sign-out does not terminate the real session** — CUR-002. The
   demo chrome navigates to `/` while retaining authentication cookies.
3. **Password recovery is request-only** — CUR-004. There is no complete
   recovery-session/new-password surface.
4. **Provenance columns are not pinned to `auth.uid()`** — CLA-003. Six actor
   columns across five schema tables permit an already-authorized tenant actor
   to misattribute who performed an action. This must close before real writes.

### Resolved by TASK-019

- CUR-003 and CLA-001: real tenant-selection/authorization boundary was absent.
  The boundary, middleware, and negative matrix now exist; 152 tests pass.
- The `/workspace` shell capability ambiguity within CLA-010 is resolved by
  human ratification in ADR 0011. The broader role-to-capability matrix remains
  unratified.
- Invalid, malformed, stale, and cross-tenant `?tenant=` values now fail closed
  into one non-disclosing typed state and never silently auto-select a tenant.

### Partially resolved

- CLA-002: session-refresh middleware now exists, making the old inline claim
  true, but the earlier comment in `lib/supabase/session.ts` still describes
  middleware as deferred. Documentation must be made internally consistent.
- CLA-010: shell-entry policy is ratified; the full role-to-capability grant
  matrix still requires product-owner review before real tenant provisioning.
- CLA-012/CUR-016: source review exists, but headed browser validation of focus,
  keyboard and responsive behavior remains pending.

### Open medium-priority themes

- Demo tenant coherence: Helix/Northstar flow mismatch and capabilities combined
  across fixture memberships (CUR-005, CUR-006, CUR-026).
- Information architecture: duplicate Super Admin and case surfaces
  (CUR-007, CUR-008).
- Product truthfulness: global “prototype” metadata on real routes and a toast
  that says a fictional notification occurred (CUR-009, CUR-025).
- Test depth: limited rendered-component/end-to-end coverage (CUR-010).
- Accessibility: tab semantics, Suspense fallbacks, reduced-motion behavior,
  and mobile navigation coverage (CUR-012, CUR-027; CUR-014 is low but related).
- Documentation hygiene: duplicate TASK-005 and missing TASK-003 handoff
  (CUR-011, CUR-029).
- Product policy: full role/capability matrix remains unratified (CLA-010).

## Security and release gates

Before real, non-Development tenant data or real customer operations:

1. Ratify the complete role-to-capability matrix; record the decision.
2. Add a forward-only provenance-pinning migration and negative SQL tests for
   CLA-003. Human approval is required before applying it outside local tests.
3. Execute the TASK-015 and TASK-019 hosted Development checklists with test
   accounts; record evidence without storing credentials or personal data.
4. Remove identity/session ambiguity between real and demo routes
   (CUR-001/CUR-002).
5. Complete the password recovery flow and approve its hosted redirect policy.
6. Require `resolveAuthorizedTenantContext()` with the route-specific
   capability for every future real operational route.
7. Map repository/RPC errors to stable presentation codes before exposing any
   new wrapper to UI (CLA-014).
8. Re-authorize policy ownership before a future evaluation adapter invokes or
   persists deterministic engine output (CLA-004).

## Accepted strengths

- API-first modular-monolith boundaries are coherent.
- Identity is re-derived through verified Supabase Auth APIs.
- Tenant RLS and capability helpers fail closed in local SQL verification.
- Browser-reachable code does not use service-role configuration.
- The deterministic engine validates contract version, policy configuration,
  thresholds and decision bands at runtime and remains free of I/O.
- Recommendation and customer decision remain separate concepts.
- English-first, UTC and market-neutral presentation discipline is generally
  maintained.
- Demo mutation, email and support actions are generally labelled as local and
  non-persistent.
- Cloudflare/Vinext and Vercel Build Output API v3 verification pass locally.

## Known limitations and deferred risks

- Most Company, Operator, case, policy, entity, evaluation and Super Admin
  routes remain fixture prototypes, not authenticated operational surfaces.
- Append-only/idempotent database structures are mostly schema-only; adapters
  and business workflows are not yet implemented (CLA-013).
- Two threshold-resolution implementations disagree at boundaries (CLA-009).
- SQL tests do not yet exercise all idempotency and published-policy deletion
  cases (CLA-006).
- Vinext/Nitro beta internals create a build-maintenance risk (CLA-005).
- Integration secret-hash exposure requires a decision before that feature is
  implemented (CLA-011).
- The hosted deployment and all visual states have not yet been independently
  accepted.

## Evidence status

- Cursor audit: accepted after formatting normalization at `b2ba20a`.
- Claude audit: integrated at `773f78d`.
- TASK-019: reviewed after fail-closed correction at `a9aa334`, then integrated.
- Local combined verification: 152/152 tests, TypeScript, secret scan,
  `verify-web`, and Vercel Build Output API v3 all passed.
- Hosted and headed-browser verification: pending.

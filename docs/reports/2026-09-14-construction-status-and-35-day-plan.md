# MITIGA construction status and 35-day delivery plan — 2026-09-14

## Current construction state

MITIGA currently combines a production-oriented technical foundation with a
broad fixture prototype used to validate product workflows.

### Implemented foundations

- TypeScript modular-monolith web application with bounded domain modules.
- Supabase schema baseline for identity, tenancy, policies, evaluations,
  cases, integrations, notifications and append-only audit evidence.
- RLS, capability helpers, membership lifecycle RPCs and local negative SQL
  verification.
- Deterministic, versioned evaluation engine with typed domain failures,
  runtime threshold/decision-band validation and no I/O.
- Cloudflare/Vinext build plus genuine Vercel Build Output API v3 adapter.
- Real email/password sign-in, sign-out, reset request and verified server
  identity boundary using public Supabase configuration.
- Real `/workspace` shell with safe configuration/read states.
- Request-scoped active-membership repository, server-validated tenant
  selection, session-refresh middleware, and reusable capability boundary.
- English-first typed copy catalog and approved MITIGA brand mark.

### Implemented as demonstrations only

- Tenant/workspace chooser prototype.
- Company dashboard and membership administration.
- Entity intake and evaluation-start flow.
- Evaluation detail and deterministic-result presentation.
- Operator queue, case detail, evidence/decision timeline.
- Risk-policy workbench.
- Platform Super Admin tenant-governance directory.

These routes use fictional fixtures and local interaction states. They do not
write Supabase, send email, grant support access, run the engine from the UI,
or persist customer decisions.

### Not yet implemented end to end

- Hosted authentication acceptance and complete password recovery.
- Real tenant-scoped Company/Operator operational routes.
- Persistence adapter for policies, evaluation inputs/results, cases and audit
  evidence.
- Real invitation/member administration workflow.
- Background jobs, notifications, webhooks and integrations.
- Customer reporting/export and operational observability.
- Full browser automation, responsive/accessibility acceptance and client
  visual approval.

## Delivery principles for the remaining 35 days

1. One real vertical slice at a time; do not convert all fixture routes at once.
2. A real route must prove identity, membership and its specific capability on
   every request.
3. Every write must be idempotent where retried, tenant-scoped, actor-pinned,
   correlated and auditable.
4. Fixtures remain visibly separate until their replacement is complete.
5. One implementation owner per boundary; the other agent reviews.
6. Hosted, production, customer-data and destructive decisions require human
   approval.

## Step-by-step plan

### Days 1–3 — close trust and release blockers

- Ratify the full role-to-capability matrix.
- Correct real/demo identity and sign-out ambiguity.
- Align the stale session middleware comment.
- Define and locally test the provenance-pinning migration for CLA-003; do not
  apply it to hosted environments without approval.
- Specify the password recovery completion task and hosted redirect decision.
- Complete the hosted Development authentication checklist with assisted
  access.

**Exit evidence:** signed decision record, green local checks, negative SQL
tests, recorded hosted checklist, no credentials in evidence.

### Days 4–7 — visual and operational acceptance baseline

- Review all 21 routes at mobile and desktop widths.
- Validate keyboard order, focus, reduced motion, loading/error/empty states,
  and English-first copy.
- Record Lucimara/owner visual decisions and unresolved changes.
- Fix high-priority trust issues and the highest-confidence accessibility
  findings.

**Exit evidence:** visual checklist, approved/rejected/deferred register,
screenshots containing fixtures only, and regression checks.

### Days 8–14 — first real tenant-scoped vertical slice

- Select one MVP slice: recommended entity intake → deterministic evaluation
  result.
- Load only an authorized published policy version for the selected tenant.
- Validate/normalize input, execute the pure engine and persist the immutable
  result through a narrow server adapter.
- Pin actor, tenant, policy/model versions and correlation ID.
- Add cross-tenant, duplicate/idempotency and failure-compensation tests.

**Exit evidence:** one real workflow in Development, no fixture identity,
traceable audit event, tested rollback/remediation.

### Days 15–21 — case workflow and human decision

- Create a case from an eligible evaluation without silently converting the
  recommendation into a decision.
- Implement assignment, evidence metadata, notes and explicit human decision.
- Preserve append-only evidence and actor provenance.
- Keep uploads/storage out unless explicitly approved and scoped.

**Exit evidence:** evaluation-to-case trace, capability checks, immutable
decision evidence and negative tenant tests.

### Days 22–27 — membership and administration slice

- Connect invitation acceptance and membership lifecycle through existing
  audited RPCs.
- Complete password recovery.
- Resolve demo IA conflicts and maintain a clear real/demo boundary.
- Add rendered component and selected browser automation coverage.

**Exit evidence:** tested owner/admin/member paths, no enumeration, audit events,
and manual recovery proof.

### Days 28–32 — hardening and staging readiness

- Close remaining pre-MVP audit findings.
- Exercise SQL idempotency/deletion gaps.
- Normalize error presentation and logging/correlation behavior.
- Pin/review build dependencies and verify Cloudflare plus Vercel artifacts.
- Run dependency, secret, tenant-isolation and accessibility gates.

**Exit evidence:** release-candidate checklist and zero unresolved critical/high
findings approved for release.

### Days 33–35 — client acceptance and controlled release decision

- Execute complete end-to-end acceptance with fictional or approved test data.
- Re-run visual approval with Lucimara.
- Produce final customer-facing progress report, known-limitations statement,
  rollback runbook and next-phase backlog.
- Create an immutable release candidate tag.
- Obtain explicit human production approval; deployment is a separate action.

**Exit evidence:** signed acceptance register, final audit delta, release tag,
and explicit go/no-go decision.

## Assisted-access checklist

The human operator enters all credentials directly; no credential is copied to
chat, source, screenshots or logs.

1. Open the public Vercel deployment and record its exact URL/deployment ID.
2. Confirm the two public Supabase variables exist for the target environment.
3. Confirm Preview versus Production target intentionally; do not reuse a
   branch-specific variable with Production.
4. Sign in with an approved Development test account.
5. Confirm session persistence and `/workspace` redirect behavior.
6. Test no-membership, one-membership and multi-membership accounts.
7. Attempt malformed, stale and unauthorized tenant selections; verify the
   generic fail-closed state.
8. Sign out from the real workspace and verify the protected route redirects.
9. Request password reset without checking whether an address exists; complete
   the flow only after redirect policy approval.
10. Review browser/server logs for correlation and absence of secrets/PII.
11. Record pass/fail evidence and close the browser session.

## Visual approval checklist

Review at approximately 375 px mobile width and a standard desktop viewport:

- `/`, `/reset-password`, `/workspace`;
- `/tenants`, `/company`, `/company/admin`, `/company/admin/members`;
- `/entities`, `/entities/:id`, `/evaluations/new`, `/evaluations/:id`;
- `/operator`, `/cases`, `/cases/:id`;
- `/policies`, `/policies/:id`;
- `/super-admin`, `/super-admin/tenants`, `/super-admin/tenants/:id`;
- `/invite`, `/onboarding`, `/denied`.

For each route record: approved, changes requested, deferred, or not applicable;
responsive layout; keyboard/focus; copy truthfulness; real/demo label; loading,
empty, error and denied states; and screenshot reference where safe.

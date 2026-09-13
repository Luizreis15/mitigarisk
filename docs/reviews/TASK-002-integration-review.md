# TASK-002 — Integration security and compatibility review

- Reviewer: Codex merge owner
- Date: 2026-09-12
- Source branch: `feat/claude-platform-foundation`
- Integration branch: `integration/foundation`
- Hosted Supabase impact: none

## Outcome

Approved for the integration branch after corrective hardening. The original
delivery established a strong tenant/RLS/domain foundation, but it was not
eligible for `main` unchanged.

## Blocking findings corrected

1. Broad `FOR ALL` policies on API clients, webhook endpoints, and
   notification templates also granted `DELETE`, contradicting the stated
   retention model. Webhook and notification histories were also writable by
   authenticated managers.
2. Evaluations could reference another tenant's policy, and cases could
   reference another tenant's evaluation, because the original foreign keys
   did not include `tenant_id`.
3. Policy factors and evaluation reason codes could be reparented from a
   finalized parent to a draft/pending parent, bypassing immutability checks.
4. Suspended tenants still retained active capabilities.
5. Tenant members could create tenant-less platform audit events.
6. Notification locale defaults and one seed tenant still carried
   Brazil-specific assumptions after ADR 0002 established English-first,
   market-neutral product behavior.
7. The backend case status omitted `waiting_evidence`, which is already part
   of the approved Operator workflow.
8. Claude's ADR numbers collided with the accepted English-first ADR 0002.
9. The merged runtime dependency tree reported high-severity advisories in
   the prototype runtime and build stack.

## Corrections

- Added migration
  `20260912120800_security_and_english_first_hardening.sql`.
- Added behavioral SQL regressions in
  `supabase/tests/020-integration-hardening.sql` and made the local runner
  execute every numbered verification suite.
- Added composite tenant foreign keys and published-policy enforcement.
- Protected evaluation identity/input evidence and delivery-history identity.
- Replaced broad write policies with operation-specific policies.
- Enforced authenticated actor provenance on evaluations, cases, evidence,
  and decisions.
- Changed notification defaults to `en-US`, aligned seed tenants with the
  market-neutral frontend, and added `waiting_evidence` to the domain model.
- Renumbered TASK-002 ADRs to 0003–0005.
- Updated the compatible React, Vinext, Vite, and Cloudflare toolchain; a
  full `npm audit` now reports zero known vulnerabilities.
- Extended CI to run dependency audit, unit tests, TypeScript checks, web
  gates, and the disposable PostgreSQL RLS/immutability suites.

## Residual decision

The role-to-capability matrix is still an implementer default and requires
product-owner ratification before production authorization is enabled.
Secret-hash columns also require an explicit private-schema or column-exposure
decision before real credentials are issued.

# TASK-014 — Cursor company and membership administration workspace

## Objective

Build the English-first Company Admin workspace for the Northstar test-company
scenario: company profile, members, invitations, roles/capabilities, and clear
empty/loading/error states. This is a frontend contract/prototype task; it must
not claim that real user administration is already connected.

## Context

The real data model already has tenants, memberships, roles, capabilities,
invitation acceptance, suspension, and audit foundations. Supabase Auth/session
integration is owned by TASK-013. This task makes the Company Admin experience
reviewable now, using typed local fixtures and clear prototype labelling.

## In scope

- Work only in `apps/web/app/**`, `apps/web/components/**`,
  `apps/web/lib/demo/**`, `apps/web/lib/i18n/**`, and this task file.
- Add Company Admin navigation/views for company profile and members.
- Use a fictional `Northstar Gaming Ltd.` tenant fixture with Company Admin,
  Risk Analyst, Operator, and Auditor membership examples, plus pending invite
  and suspended/removed states where useful.
- Explain roles through capabilities rather than role-name promises alone.
- Provide local-only invite, suspend/reactivate, and role-change UI states with
  confirmation copy that says no action is saved in the prototype.
- Include responsive and accessible empty/loading/error/no-permission states.
- Preserve existing Company, Operator, Super Admin, workbench, policy,
  evaluation, and case flows.

## Out of scope

- Supabase imports/calls, auth/session work, real invitation emails, mutation,
  persistence, Vercel configuration, service-role usage, real Lucimara data,
  billing, or database/schema/RLS changes.

## Acceptance criteria

1. Company identity, membership status, role, capability, and tenant scope are
   visually distinct and English-first.
2. The UI never implies a member/role edit, invitation, suspension, or email
   actually persisted or was delivered.
3. All fixtures are fictional and market-neutral; no real email address, UUID,
   credential, or customer data is displayed.
4. The Company Admin can navigate from workspace/company context into member
   administration and back without breaking existing routes.
5. `./scripts/check-secrets.sh`, `./scripts/verify-web.sh`, and the Vercel
   preview build verification pass.

## Required handoff

Create `feat/cursor-company-membership-administration` from the latest
approved preview integration branch. Use Conventional Commits, do not merge,
and append the standard handoff: outcome, commits, changed files, checks,
security/tenant impact, limitations, and recommended reviewer.

## Handoff notes (Cursor)

_To be completed by Cursor._

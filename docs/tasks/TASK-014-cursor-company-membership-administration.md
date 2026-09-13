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

Outcome:
English-first Company Admin workspace for the fictional Northstar Gaming Ltd.
tenant: profile, members, capability-explained roles, pending/suspended/removed
fixtures, and local-only invite, role-change, and suspend/reactivate confirmations
that never claim persistence or email delivery.

Branch and commit:
`feat/cursor-company-membership-administration` from `origin/preview/vercel-adapter`
(`5da36f7`). Commits: `354a199` feat(web); this commit docs(task).

Files changed:
- `apps/web/app/company/admin/page.tsx`
- `apps/web/app/company/admin/members/page.tsx`
- `apps/web/app/company/page.tsx`
- `apps/web/app/denied/page.tsx`
- `apps/web/components/prototype/app-shell.tsx`
- `apps/web/components/prototype/company-admin-state.tsx`
- `apps/web/components/prototype/empty-workspace.tsx`
- `apps/web/lib/demo/company-admin.ts`
- `apps/web/lib/demo/labels.ts`
- `apps/web/lib/demo/session.ts`
- `apps/web/lib/demo/types.ts`
- `apps/web/lib/i18n/messages.ts`
- `docs/tasks/TASK-014-cursor-company-membership-administration.md`

Decisions and assumptions:
- Company Admin is a distinct prototype view (`company-admin`) so profile and
  members use route navigation instead of in-page Company scroll sections.
- Role bundles (`tenant_admin`, `risk_analyst`, `operator`, `auditor`) are
  labelled as convenience bundles; capability chips are the authoritative
  explanation. UI hiding is not authorization.
- Confirmations and toasts state that invitations are not sent and membership
  edits are not saved; fixture rows are not mutated.
- Empty, loading, error, and denied states are query-driven (`state=`) and
  linked from `/tenants` prototype scenarios.
- Helix Company, Operator, Super Admin, workbench, policy, evaluation, and case
  routes are unchanged aside from a capability-gated administration entry from
  the Company workspace.

Checks run and exact results:
- `./scripts/check-secrets.sh` — Secret check passed.
- `./scripts/verify-web.sh` — oxlint clean; `vinext build` succeeded; Web
  verification passed. Routes include `/company/admin` and
  `/company/admin/members`.
- `npm run verify:vercel` (in `apps/web`) — Vercel Build Output API v3
  verification passed (config.json v3, Node.js function with handler,
  static/_next client bundle).

Security/tenant/audit impact:
- No Supabase, auth, email, mutation, or persistence. Tenant scope is visual
  only. No real emails, UUIDs, credentials, or customer data. Prototype notice
  remains on the shell.

Migration and rollback notes:
- No migrations. Rollback is revert of this branch; no hosted change was made.

Known limitations:
- Session remains the existing local prototype actor. TASK-013 owns real
  Auth/session. Browser end-to-end click-through was not available (no browser
  tools; local HTTP from this agent could not reach the isolated vinext
  listener). Interactive invite/suspend/role dialogs were not click-verified.

Recommended reviewer:
Codex (merge owner) and an independent frontend/security pass on copy honesty
and capability-vs-role presentation.

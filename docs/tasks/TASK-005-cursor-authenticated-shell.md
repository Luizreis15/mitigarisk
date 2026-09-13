# TASK-005 — Cursor authenticated product shell and tenant onboarding

## Objective

Build the English-first frontend experience that follows authentication:
tenant selection, first-company onboarding, role-aware navigation states, and
empty states for Company, Operator, and Super admin views.

## Scope

- Work only in apps/web/app/**, apps/web/components/**, apps/web/lib/i18n/**,
  apps/web/lib/demo/**, and this task file.
- Keep all visible product text English-first and market-neutral.
- Create a navigable prototype for:
  - tenant selection;
  - company onboarding progress;
  - pending/invited membership state;
  - empty Company, Operator, and Super admin states;
  - denied-access state for a missing capability.
- Reuse the approved MITIGA design system and responsive patterns.
- Use local fixtures and typed view models only; no production mutation,
  provider calls, credential reads, or direct Supabase queries.
- Preserve existing routes and add only routes justified by the flow.

## Out of scope

- Real login, magic links, SSO, session persistence, Supabase calls, database
  migrations, email delivery, billing, or changes to RLS/domain contracts.

## Acceptance criteria

1. Every user-facing string lives in the English catalog.
2. The onboarding and permission states are understandable without demo data.
3. Mobile and desktop remain usable and visually aligned with the approved
   sober, premium design language.
4. Existing routes still build: /, /company, /operator, /super-admin.
5. No Portuguese runtime copy, country-specific formats, secrets, or network
   calls are introduced.
6. ./scripts/check-secrets.sh and ./scripts/verify-web.sh pass.

## Required handoff

Commit on feat/cursor-authenticated-shell using Conventional Commits. Add
the standard handoff to this file: outcome, commits, changed files, checks,
security/tenant impact, limitations, and a recommended reviewer. Do not merge.

## Handoff notes (Cursor)

```text
Outcome:
English-first authenticated product shell on feat/cursor-authenticated-shell. Login continues to the workspace picker. Prototype users can open tenant selection, first-company onboarding, a pending invite, empty Company/Operator/Super admin workspaces, and a missing-capability denied state. Existing routes /, /company, /operator, and /super-admin still build.

Branch and commit:
feat/cursor-authenticated-shell
- 1ba8c9b feat(web): add authenticated workspace shell and onboarding states
- (this file) docs(task): record TASK-005 Cursor handoff

Files changed:
apps/web/app/page.tsx, apps/web/app/company/page.tsx, apps/web/app/operator/page.tsx, apps/web/app/super-admin/page.tsx
apps/web/app/tenants/page.tsx, apps/web/app/onboarding/page.tsx, apps/web/app/invite/page.tsx, apps/web/app/denied/page.tsx
apps/web/components/prototype/app-shell.tsx, apps/web/components/prototype/workspace-chrome.tsx, apps/web/components/prototype/empty-workspace.tsx
apps/web/lib/demo/types.ts, apps/web/lib/demo/session.ts, apps/web/lib/i18n/messages.ts, this task file.

Decisions and assumptions:
- Post-login navigation is a local membership picker, not a session. Fixtures in apps/web/lib/demo/session.ts are typed view models only.
- New routes /tenants, /onboarding, /invite, and /denied are justified by the authenticated flow; role URLs are unchanged.
- Empty role views use ?state=empty so they are readable without operational demo records.
- Role switcher hides other role links when membership capabilities are supplied; UI hiding is not authorization. Denied copy states a real session would be denied server-side.
- Accept/decline and onboarding continue/finish only raise local toasts. No persistence, provider, or mutation.
- Visible copy stays in the English catalog. Presentation remains en-US / UTC / USD from existing presentation helpers.

Checks run and exact results:
- ./scripts/check-secrets.sh: Secret check passed.
- ./scripts/verify-web.sh: Web verification passed.
  - oxlint (shadcn ignore patterns): pass, exit 0
  - npm run build: pass; routes /, /company, /denied, /invite, /onboarding, /operator, /super-admin, /tenants

Security/tenant/audit impact:
Fictional memberships and actors only. No secrets, Supabase, credential validation, or network calls. Tenant records stay hidden on invited and empty states. Capability filtering is prototype navigation, not RLS or server enforcement. No audit events are written.

Migration and rollback notes:
No migrations. Rollback is revert of this branch. Do not merge until Codex review.

Known limitations:
- No real login, magic links, SSO, or session persistence.
- Onboarding progress is React state and resets on refresh.
- Invite accept/decline does not change membership fixtures.
- Empty states are query-parameter scenarios, not live provisioned tenants.
- Browser interaction was not exercised in this environment; verification is lint + production build.
- No new screenshots were committed (public/ is out of scope).

Recommended reviewer:
Codex merge owner; Claude Code for an independent check that no production auth or tenant mutation leaked into the prototype.
```

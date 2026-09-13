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

# TASK-004 — Cursor English-first product refactor

## Objective

Convert the approved visual prototype into an English-first, market-neutral product foundation without changing its accepted design language.

## Dependencies

- ADR 0002 is authoritative.
- Start from the staged frontend in `integration/foundation`, not from `main` or the old Cursor branch.

## In scope

- Replace routes with `/`, `/company`, `/super-admin`, and `/operator`.
- Set document language and metadata to English.
- Externalize all user-facing copy into a typed English message catalog.
- Replace Portuguese fictional data and organization names with English-market-neutral fixtures.
- Add locale-aware formatters for dates, numbers, currencies, and time zones using platform APIs.
- Keep locale selection behind a small typed configuration boundary; default temporarily to `en-US`.
- Regenerate desktop and mobile approval screenshots.
- Preserve all accepted visual hierarchy, navigation, accessibility, and prototype-only warnings.

## Out of scope

- Additional languages, live translation services, Supabase, Resend, real authentication, or country-specific compliance claims.
- Visual redesign, new dependencies, or changes to platform migrations.

## Acceptance criteria

1. No Portuguese customer-facing string remains in runtime product files or fixtures.
2. User-visible copy is not hardcoded in route or presentation components.
3. Dates, numbers, currencies, and time zones are formatted through typed locale utilities.
4. URLs and navigation use English terms.
5. Fictional data is globally plausible and carries no real personal information.
6. The four views remain responsive, accessible, and mutually navigable.
7. Secret scan, lint, and production build pass.
8. Handoff explains every market-neutrality decision and includes new screenshots.

## Expected handoff

Commit on a new `feat/cursor-english-first` branch. Do not merge. Return the standard handoff and exact verification results.

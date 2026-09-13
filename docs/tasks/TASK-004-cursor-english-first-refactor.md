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

## Handoff notes (Cursor)

Screenshots:

- `apps/web/public/prototype/login-desktop.png`
- `apps/web/public/prototype/login-mobile.png`
- `apps/web/public/prototype/company-desktop.png`
- `apps/web/public/prototype/company-mobile.png`
- `apps/web/public/prototype/super-admin-desktop.png`
- `apps/web/public/prototype/super-admin-mobile.png`
- `apps/web/public/prototype/operator-desktop.png`
- `apps/web/public/prototype/operator-mobile.png`

```text
Outcome:
English-first, market-neutral frontend prototype on feat/cursor-english-first. Routes are /, /company, /super-admin, and /operator. Design language is unchanged.

Branch and commit:
feat/cursor-english-first (see Conventional Commits on this branch)

Files changed:
apps/web/app/**, apps/web/components/prototype/**, apps/web/lib/demo/**, apps/web/lib/i18n/**, apps/web/public/prototype/**, this task file. Removed /empresa and /operador.

Decisions and assumptions:
- ADR 0002 is source of truth: English catalog is the product copy, not a translation layer over Portuguese.
- Default presentation is locale en-US, timeZone UTC, currency USD, amounts as integer minor units. The boundary is PresentationConfig; no country-specific identity, address, or tax formats were added.
- Demo tenants are fictional international digital businesses (Helix Commerce Ltd., Nimbus Payments Inc., Cedar Marketplaces, Atlas Digital Services). Names are invented and globally plausible.
- Display messages are never used as identifiers; reason codes and audit actions stay English technical tokens.
- USD is a temporary default, not a US-only product claim.

Checks run and exact results:
- ./scripts/check-secrets.sh: Secret check passed.
- apps/web lint (oxlint with shadcn ignore patterns): pass, exit 0
- apps/web `npm run build`: pass; routes /, /company, /super-admin, /operator
- wrangler preview :8788: HTTP 200 on all four routes; new desktop and mobile screenshots captured

Security/tenant/audit impact:
Fictional data only. No secrets, provider SDKs, or network calls. Prototype banners remain. Locale/currency/time-zone are presentation settings, not authorization. Audit fixtures still carry actor, target, UTC timestamp, and correlation id.

Migration and rollback notes:
No migrations. Rollback is revert of this branch. Portuguese routes are removed and should not be restored as product URLs.

Known limitations:
- Search still uses local toast feedback and does not filter tables.
- Only English exists in the catalog; no second locale was added (out of scope).
- Native <meter> rendering remains OS-dependent.
- Role switcher is prototype navigation, not access control.

Recommended reviewer:
Codex merge owner; independent check that no Portuguese copy remains in runtime files.
```


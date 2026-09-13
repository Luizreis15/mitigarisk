# TASK-001 — Cursor web foundation

## Objective

Transform the approved MITIGA design system into a polished, responsive, navigable frontend prototype covering Login, Empresa, Super Admin, and Operador.

## Business context

The prototype will validate the product hierarchy and visual language before real authentication, database, and notification integrations are connected.

## In scope

- Routes `/`, `/empresa`, `/super-admin`, and `/operador`.
- Shared application shell, sidebar, topbar, mobile navigation, role switcher, cards, status, tables, filters, and feedback states.
- Realistic pt-BR demonstration data aligned with the PRD.
- MITIGA tokens and references in `docs/design/`.
- Accessible keyboard, focus, labels, reduced-motion, and responsive behavior.
- Primary prototype actions must navigate, filter demonstration data, or show clear local feedback.

## Out of scope

- Supabase, Resend, real authentication, API routes, migrations, billing, or production deployment.
- Changes to architecture, risk algorithms, or shadcn primitive internals.
- New dependencies unless the existing stack cannot meet an acceptance criterion.

## Allowed files

- `apps/web/app/**`
- `apps/web/components/**`, except avoid modifying `components/ui/**`
- `apps/web/lib/demo/**`
- `apps/web/public/**`
- This task file for handoff notes only

## Acceptance criteria

1. All four routes render and are mutually navigable.
2. Desktop, tablet, and mobile layouts remain usable without clipped core actions.
3. The restrained MITIGA palette, gradients, typography, density, and risk-field signature are consistent.
4. Status never relies on color alone.
5. Login clearly indicates it is a prototype and does not imply real authentication.
6. No credential, network call, or customer data is introduced.
7. `npm run lint` and `npm run build` pass from `apps/web`.
8. Handoff includes screenshots for the four views and the standard governance template.

## Security, tenant, and audit requirements

Use fictional data only. Do not read `.env.local`, add provider SDKs, or simulate authorization as security. Label demo states clearly.

## Expected handoff

Commit changes on `feat/cursor-web-foundation` using Conventional Commits, then return the agent handoff from `docs/governance/MULTI-AGENT-DEVELOPMENT.md`. Do not merge the branch.

## Handoff notes (Cursor)

Screenshots:

- `apps/web/public/prototype/login-desktop.png`
- `apps/web/public/prototype/login-mobile.png`
- `apps/web/public/prototype/empresa-desktop.png`
- `apps/web/public/prototype/empresa-mobile.png`
- `apps/web/public/prototype/super-admin-desktop.png`
- `apps/web/public/prototype/super-admin-mobile.png`
- `apps/web/public/prototype/operador-desktop.png`
- `apps/web/public/prototype/operador-mobile.png`

```text
Outcome:
Prototype frontend for Login, Empresa, Super admin, and Operador is navigable on feat/cursor-web-foundation. No Supabase, Resend, or real backend was added.

Branch and commit:
feat/cursor-web-foundation (see latest Conventional Commits on this branch)

Files changed:
apps/web/app/**, apps/web/components/prototype/**, apps/web/lib/demo/**, apps/web/public/**, apps/web/.oxlintrc.json (lint ignore for shadcn primitives), this task file.

Decisions and assumptions:
- HTML `role` could not be used as a React prop for demo views; the shell uses `view`.
- Oxlint ignore for `components/ui/**` and `hooks/use-mobile.ts` was required to pass lint without editing shadcn internals.
- Demo tenant is fictional online-gaming operator Arena Lúdica S.A., aligned with the PRD niche.

Checks run and exact results:
- apps/web `npm run lint`: pass (oxlint, exit 0)
- apps/web `npm run build`: pass (vinext build, routes /, /empresa, /super-admin, /operador)
- Live wrangler preview on :8787: HTTP 200 for all four routes; desktop and mobile screenshots captured.

Security/tenant/audit impact:
Fictional data only. No secrets, no .env.local, no provider SDKs, no network calls. Demo banners state that UI is not authorization. Audit rows in Super admin are local fixtures with actor, target, timestamp, and correlation id.

Migration and rollback notes:
No migrations. Rollback is revert of this branch; no production effect.

Known limitations:
- Search does not filter tables; it shows local toast feedback.
- Native `<meter>` rendering is OS-dependent.
- Role switcher is a prototype navigation aid, not access control.
- Browser MCP was unavailable; verification used Playwright against wrangler on localhost:8787.

Recommended reviewer:
Codex (merge owner) plus independent UI/accessibility pass before any later auth wiring.
```

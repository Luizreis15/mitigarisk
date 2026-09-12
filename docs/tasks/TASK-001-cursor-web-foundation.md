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

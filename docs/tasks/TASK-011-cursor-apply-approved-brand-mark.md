# TASK-011 — Cursor apply approved MITIGA brand mark

## Objective

Replace the temporary, code-drawn MITIGA mark in the product interface with the
approved MITIGA visual symbol already stored in the repository, and align the
small application-brand surfaces for a review-ready preview deployment.

## Canonical asset

`apps/web/public/mitiga-symbol.png` is the approved symbol for this task. It
is the folded-ribbon M mark. Do not redraw, recolor, crop, distort, add effects
to, or generate a replacement logo. The current hand-drawn SVG/component mark
is temporary and must not remain the product's primary visual mark.

## In scope

- Work only in `apps/web/app/**`, `apps/web/components/**`,
  `apps/web/public/**`, `apps/web/lib/i18n/**`, and this task file.
- Update `MitigaMark` and every visible product use of the mark to use the
  approved asset, preserving accessible text alternatives and compact/sidebar
  behaviour.
- Ensure the icon is crisp and proportionate on light and dark surfaces; do
  not apply a CSS gradient, shadow, altered opacity, mask, or color treatment
  to the logo itself.
- Align favicon/application metadata with the approved mark when technically
  appropriate using existing local assets only.
- Preserve the existing MITIGA wordmark text treatment unless a small spacing
  adjustment is needed to accommodate the real mark.
- Check login, sidebar, top-level product shells, and mobile layouts.

## Out of scope

- New logo design, image generation, full visual redesign, external CDN/media
  calls, Supabase, Vercel deployment/configuration, authentication, backend,
  or product-copy changes unrelated to brand accessibility.

## Acceptance criteria

1. The folded-ribbon M from `mitiga-symbol.png` is the only primary visible
   MITIGA symbol across the application; the temporary drawn mark is removed
   from active UI use.
2. The asset keeps its native proportions and transparent background, has
   useful alt/sr-only text, and remains legible at desktop and mobile sizes.
3. No logo recoloring, gradients, shadows, distortion, or remote assets are
   added.
4. Existing routes remain functional and no runtime Portuguese copy appears.
5. `./scripts/check-secrets.sh` and `./scripts/verify-web.sh` pass.

## Required handoff

Create `feat/cursor-apply-approved-brand-mark` from current `main`. Use
Conventional Commits, do not merge, and append the standard handoff: outcome,
commits, changed files, checks, security/tenant impact, limitations, and
recommended reviewer.

## Handoff notes (Cursor)

_To be completed by Cursor._

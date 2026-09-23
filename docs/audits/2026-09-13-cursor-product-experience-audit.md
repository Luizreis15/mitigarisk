# Cursor product and experience audit — 2026-09-13

## Baseline

- Annotated tag: `audit-baseline-2026-09-13-r2`
- Tag object: `ff1db457703b0521a1c88120c98709fd38d5e470`
- **Audited commit SHA:** `93d02fd8b206e0dea2b36af0dec9f1e91847196a`
- Commit subject: `docs(audit): advance baseline after TASK-018 integration`
- Branch used for this report: `audit/cursor-product-experience-2026-09-13`
- Confirmation: `git rev-parse 'audit-baseline-2026-09-13-r2^{commit}'` equals the SHA required by TASK-020.

No application code, hosted system, secret file, or merge was changed during this audit.

## Method and limitations

**Verified facts** come from files at `93d02fd`, local check output, and task/ADR text.

**Inferences** are labeled as such (for example, what a signed-in user would perceive after following a demo link).

**Needs browser / human confirmation:** no browser tools were available. Responsive layout, focus order, contrast, and toast behavior were not click-tested. Screenshots were not captured. `.env` / `.env.local` were not read. Hosted Supabase and Vercel were not accessed. TASK-015's Development checklist was not re-run.

TASK-021 (architecture/security audit) is a sibling contract on the same baseline and is out of scope here except as a dependency for backend findings.

## Executive summary

The product at this baseline is a **split experience**: real email/password auth plus a fail-closed `/workspace`, sitting on the same origin as a large **ungated fixture prototype**. ADR 0010 documents that split as intentional. The highest product-experience risk is not missing copy on the prototype (most operational screens honestly say they do not persist); it is **identity confusion** when a real session can open `/tenants` and immediately see “Signed in as Elena Park”, while prototype “Sign out” only navigates to `/` and does not call `signOutAction`.

TASK-019 (server tenant selection and session-refresh middleware) is **not implemented**. There is no `apps/web/middleware.ts`. Operational Company/Operator/Policy/Case routes remain demo/fixture.

Local automated checks at this SHA all passed (106 tests, TypeScript, vinext build, Vercel output, secret scan, web verification). There are **no automated UI tests** for prototype pages or rendered `/workspace` states.

**Finding counts:** critical 0 · high 4 · medium 13 · low 6 · observation 7 (CUR-001–CUR-030).

---

## Route inventory

Build output at this SHA lists: `/`, `/cases`, `/cases/:id`, `/company`, `/company/admin`, `/company/admin/members`, `/denied`, `/entities`, `/entities/:id`, `/evaluations/:id`, `/evaluations/new`, `/invite`, `/onboarding`, `/operator`, `/policies`, `/policies/:id`, `/reset-password`, `/super-admin`, `/super-admin/tenants`, `/super-admin/tenants/:id`, `/tenants`, `/workspace`.

| Path | File | Classification | Evidence |
|---|---|---|---|
| `/` | `apps/web/app/page.tsx` | **mixed** | Real `SignInForm` when `hasPublicSupabaseConfig()`; always also links to `/tenants` sample data (`page.tsx` 58–77). Does not call `requireAuthenticatedIdentity()`. |
| `/reset-password` | `apps/web/app/reset-password/page.tsx` | **real (incomplete)** | Request-only Server Action. No recovery-session / new-password UI in `apps/web`. |
| `/workspace` | `apps/web/app/workspace/page.tsx` | **real** | `requireAuthenticatedIdentity()` after public config (`page.tsx` 14–28). Membership **count** query only. Links to fictional `/tenants`. |
| `/tenants` | `apps/web/app/tenants/page.tsx` | **demo/fixture** | `sessionActor` Elena Park; `WorkspaceChrome` prototype banner. |
| `/onboarding` | `apps/web/app/onboarding/page.tsx` | **demo/fixture** | Local step state + toast; no backend. |
| `/invite` | `apps/web/app/invite/page.tsx` | **demo/fixture** | Fixture membership from query `membership`. |
| `/denied` | `apps/web/app/denied/page.tsx` | **demo/fixture** | Capability label from `useSearchParams()`. |
| `/company` | `apps/web/app/company/page.tsx` | **demo/fixture** | Helix `currentTenant`; URL `state=empty`. |
| `/company/admin` | `apps/web/app/company/admin/page.tsx` | **demo/fixture** | Northstar fixtures + URL state. |
| `/company/admin/members` | `apps/web/app/company/admin/members/page.tsx` | **demo/fixture** | Invite/suspend toasts only. |
| `/operator` | `apps/web/app/operator/page.tsx` | **demo/fixture** | Helix cases; URL empty state. |
| `/cases`, `/cases/:id` | `apps/web/app/cases/**` | **demo/fixture** | Operator workbench fixtures; recommendation vs decision copy present. |
| `/entities`, `/entities/:id` | `apps/web/app/entities/**` | **demo/fixture** | Northstar intake tenant. |
| `/evaluations/new` | `apps/web/app/evaluations/new/page.tsx` | **demo/fixture** | Structured intake; no score; local toast. |
| `/evaluations/:id` | `apps/web/app/evaluations/[id]/page.tsx` | **demo/fixture** | Helix evaluation fixtures. |
| `/policies`, `/policies/:id` | `apps/web/app/policies/**` | **demo/fixture** | Policy workbench fixtures. |
| `/super-admin` | `apps/web/app/super-admin/page.tsx` | **demo/fixture** | Platform overview fixtures. |
| `/super-admin/tenants`, `/super-admin/tenants/:id` | `apps/web/app/super-admin/tenants/**` | **demo/fixture** | TASK-017 governance fixtures. |

There is no middleware file. Prototype routes are **inaccessible as real product** (no server identity) but **publicly reachable** as UI.

---

## Task contracts TASK-001 through TASK-019

| Task | Status at baseline | Handoff | Unfinished / stale vs UI |
|---|---|---|---|
| 001 web foundation | Implemented | Yes | Prototype origin of current shell. |
| 002 platform/Supabase | Implemented (schema/RLS/domain) | Yes (Claude) | Not wired to UI except auth/membership count. |
| 003 integration gates | Implemented (tooling) | **Missing in the task file** | Scripts/CI exist; CUR-029. |
| 004 English-first | Implemented | Yes | Catalog remains English; metadata still says “prototype” (CUR-009). |
| 005 authenticated shell | Implemented as **demo** tenant picker | Yes in `TASK-005-cursor-authenticated-shell.md` | Duplicate file `TASK-005-cursor-authenticated-product-shell.md` has **no handoff** (CUR-011). `/tenants` is not real tenant selection (TASK-019). |
| 006 auth/tenant bootstrap RPCs | Implemented in SQL | Yes (Claude) | UI does not call tenant bootstrap. |
| 007 evaluation-to-case flow | Demo UI | Yes | Fixture only. |
| 008 case workbench | Demo UI | Yes | Fixture only; a11y tablist issue (CUR-012). |
| 009 evaluation engine | Domain + tests | Yes | Not invoked from `/evaluations/new` (intake is local). |
| 010 policy workbench | Demo UI | Yes | Fixture only. |
| 011 brand mark | Implemented | Yes | `MitigaMark` + `/mitiga-symbol.png`. |
| 012 Vercel adapter | Implemented | Yes | `verify:vercel` passes. |
| 013 auth session foundation | Implemented | Yes | Cookie session for `/`, `/reset-password`, `/workspace` only. |
| 014 company memberships | Demo Northstar admin | Yes | Toasts; no writes. |
| 015 real auth routes | Implemented | Yes | Recovery **request** only; checklist item 11 keeps demo ungated. |
| 016 entity intake | Demo Northstar | Yes | Cross-tenant demo jump from Helix Company (CUR-005). |
| 017 platform governance | Demo Super Admin | Yes | Second platform surface besides `/super-admin` (CUR-007). |
| 018 workspace presentation | Implemented | Yes | Honest `/workspace`; still links to `/tenants`. |
| 019 tenant authorization | **Contract only** | **No** | No membership list, no tenant select, no middleware (CUR-003). |

ADR 0002 (English-first, market-neutral) and ADR 0010 (real auth beside prototype) are the binding product-experience ADRs. No Portuguese runtime copy or Brazil-specific CPF/BRL/timezone strings were found under `apps/web`. Presentation defaults are `en-US` / `UTC` / `USD` (`apps/web/lib/i18n/presentation.ts` 12–16).

---

## Flow coherence

Intended real path: `/` sign-in → `/workspace` (email + membership count or empty/admin/config/read-failure) → sign-out Server Action.

Intended demo path: `/` “Continue with sample data” → `/tenants` (Elena Park) → Company / Operator / Super Admin / onboarding / invite.

**Breaks in the story (facts):**

1. `/workspace` offers “Open sample data preview” → `/tenants` (`workspace-demo-preview.tsx` 21–27), required by TASK-018 but mixing a verified session with a hardcoded actor (`tenants/page.tsx` 41–44, `session.ts` 8–12).
2. Helix Company primary CTA “create evaluation” links to `/evaluations/new` (`company/page.tsx` 139–144) while intake fixtures are Northstar (`entity-intake.ts` 51, 118–128).
3. Company overview unions capabilities from Helix **and** Northstar memberships (`company/page.tsx` 74–83).
4. Two Super Admin UIs: `/super-admin` (TASK-005 meters) and `/super-admin/tenants` (TASK-017). Role switcher sends “super-admin” to `/super-admin` only (`labels.ts` 6–10).
5. Cases exist as in-page Company sections **and** `/cases` operator workbench.

Prototype copy generally separates recommendation vs human decision (`recommendation-notice.tsx`, `messages.flow.recommendationBody`) and persistence vs toast (membership and governance catalogs). That honesty does not extend to the word “Sign out” on demo chrome.

---

## Finding register

Findings are severity-ranked. IDs are stable `CUR-###`.

### CUR-001 — Real session can be shown a fictional signed-in identity

- **Severity:** high
- **Confidence:** high
- **Classification:** pre-MVP (release blocker **if** the preview URL is treated as a customer-facing product; otherwise accepted limitation until a human decides demo hosting)
- **Owner:** Cursor (chrome/copy) + human decision (whether demo stays on the same origin)
- **Affected:** `apps/web/components/workspace/workspace-demo-preview.tsx` 21–27; `apps/web/app/tenants/page.tsx` 41–44; `apps/web/lib/demo/session.ts` 8–12; `apps/web/lib/i18n/messages.ts` 544 (`tenants.actorLine`: “Signed in as {name} · {email}”).
- **Evidence:** Authenticated `/workspace` links to `/tenants`. That page interpolates `sessionActor.name` / `sessionActor.email` (`elena.park@demo.mitiga.local`) as “Signed in as”. Prototype banner says no authentication is connected (`messages.prototype.notice`), which **contradicts** a user who just authenticated.
- **Impact:** Users (or reviewers) can believe MITIGA swapped their account for Elena Park, or that sample companies are theirs. Trust and support load; not a leak of other tenants’ real data.
- **Remediation:** If a verified session exists, demo chrome must not use “Signed in as” with fixture identity; use “Viewing fictional sample data” and keep the real email distinct or omit actor impersonation. Alternatively host demo on a separate preview.
- **Acceptance:** With a real session cookie, `/tenants` never claims the fixture actor is the signed-in user. Browser check at 375px and desktop.

### CUR-002 — Prototype “Sign out” does not sign out

- **Severity:** high
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/components/prototype/workspace-chrome.tsx` 36–38; `apps/web/components/prototype/app-shell.tsx` 308–314, 411–413.
- **Evidence:** Controls labeled `messages.nav.signOut` are `Link href="/"`, not `signOutAction`. Real sign-out exists only on `/workspace` (`workspace-session-actions.tsx`). TASK-015 checklist item 8 verifies sign-out **from `/workspace` only**.
- **Impact:** After CUR-001, a user who “signs out” from demo chrome keeps cookies; `/workspace` still shows their email.
- **Remediation:** Rename demo control to “Back to sign-in” when no session; if a session exists, call `signOutAction` or hide demo sign-out.
- **Acceptance:** After using the control with a real session, `/workspace` redirects to `/`.

### CUR-003 — TASK-019 tenant boundary is absent; operational UI is not a product workspace

- **Severity:** high
- **Confidence:** high
- **Classification:** pre-MVP (expected next backend/UI slice; not a regression of TASK-018)
- **Owner:** Claude Code (boundary) then Cursor (presentation)
- **Affected:** no `apps/web/middleware.ts`; `apps/web/app/workspace/page.tsx` has no tenant picker; all `/company/**`, `/operator`, `/cases/**`, `/entities/**`, `/evaluations/**`, `/policies/**`, `/super-admin/**` are client fixture pages.
- **Evidence:** TASK-019 requires session-refresh middleware and server-validated tenant selection on `/workspace`. Workspace copy already says tenant navigation waits for the server (`messages.workspace.tenantContextUnavailable`).
- **Impact:** The 35-day MVP cannot offer Company/Operator work on real memberships yet. Preview users may still **think** `/company` is that work (banner mitigates; CUR-001 weakens the mitigation).
- **Remediation:** Implement TASK-019 exactly; do not gate fixture routes with real auth while they still render Elena Park (ADR 0010).
- **Acceptance:** TASK-019 automated matrix plus workspace tenant selection without URL-trusted tenant IDs.

### CUR-004 — Password recovery has no complete-reset surface

- **Severity:** high
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor + Claude Code; **human** must approve Auth redirect URLs / templates (protected)
- **Affected:** `apps/web/app/reset-password/page.tsx`; `requestPasswordResetAction` in `auth-actions.ts`; no `updateUser` / recovery session handler under `apps/web`.
- **Evidence:** TASK-015 checklist item 9 only confirms the request success copy. Search of `apps/web` finds no recovery token exchange or new-password form.
- **Impact:** A Development user who receives a reset email has no in-app place to set a new password.
- **Remediation:** Add a recovery completion route that uses the verified session from the email link; keep non-enumeration on the request form.
- **Acceptance:** Documented redirect; form pending/error; no email existence leak.

### CUR-005 — Helix Company flow opens Northstar entity intake

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP (prototype quality)
- **Owner:** Cursor
- **Affected:** `apps/web/app/company/page.tsx` 139–144; `apps/web/lib/demo/entity-intake.ts` 51, 118–128; `apps/web/lib/demo/data.ts` 12–18.
- **Evidence:** Company heading is Helix Commerce Ltd.; Create evaluation → `/evaluations/new`; intake tenant is `northstarCompany`; capability helper reads `mem_helix_company`.
- **Impact:** Reviewers cannot tell which fictional company owns intake; future wiring may copy the wrong tenant.
- **Remediation:** Drive intake from the same demo tenant as Company, or label the jump as “Northstar demonstration”.
- **Acceptance:** One tenant name from Company CTA through entity list and intake.

### CUR-006 — Company workspace unions two tenants’ capabilities

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/app/company/page.tsx` 74–83.
- **Evidence:** Capabilities flatten `mem_helix_company` **or** `mem_northstar_admin`. Role switcher can then expose Company Admin because `tenant.manage_members` is present.
- **Impact:** Demo “authorization” looks cross-tenant. UI hiding is already not authorization; this also confuses the story.
- **Remediation:** Scope Company overview to Helix membership only; Admin to Northstar.
- **Acceptance:** Helix Company view cannot open `/company/admin` via role switcher unless that membership is the selected demo context.

### CUR-007 — Duplicate Platform Super Admin surfaces

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/app/super-admin/page.tsx`; `apps/web/app/super-admin/tenants/page.tsx`; `apps/web/lib/demo/labels.ts` 9.
- **Evidence:** TASK-017 handoff notes leftover usage meters on `/super-admin` vs new governance directory. Role switcher targets `/super-admin`, not `/super-admin/tenants`.
- **Impact:** Two “platform” homes; governance can be missed.
- **Remediation:** Make `/super-admin` a hub that links to tenants governance, or redirect.
- **Acceptance:** One primary Super Admin landing; governance reachable in one click.

### CUR-008 — Duplicate case queues (Company page vs `/cases`)

- **Severity:** medium
- **Confidence:** high
- **Classification:** post-MVP unless it blocks operator training
- **Owner:** Cursor
- **Affected:** `apps/web/app/company/page.tsx` (in-page cases/alerts); `apps/web/app/cases/page.tsx`; `apps/web/components/prototype/app-shell.tsx` 56–61 (Company nav scrolls in-page; does not link `/cases`).
- **Evidence:** Operator workbench is a separate route; Company nav “Cases” is `scrollToSection`.
- **Impact:** Two case UIs with different filters.
- **Remediation:** Company “Cases” links to `/cases` or a single in-page module; document operator vs company.
- **Acceptance:** One queue per role in the demo.

### CUR-009 — Document identity still says “prototype” on real auth routes

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/lib/i18n/messages.ts` 4–8; `apps/web/app/layout.tsx` 8–10 (title/description applied globally).
- **Evidence:** `messages.meta.title` is “MITIGA — risk management prototype”; description lists login and workspace selection as a navigable prototype. Real `/` and `/workspace` inherit this.
- **Impact:** Browser tab and SEO/bookmark text undercut TASK-015/018 honesty.
- **Remediation:** Route-level titles: sign-in / workspace vs “Demonstration preview”.
- **Acceptance:** `/` and `/workspace` titles do not say the authenticated account is a prototype; demo routes may.

### CUR-010 — Frontend behavior is almost untested

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/tests/**` — 24 files, all Node `node:test`; no page render tests for prototype; workspace tests are classifier + import boundary only.
- **Evidence:** `workspace-component-boundary.test.ts` reads source text; no assertion that `/workspace` renders `no_membership` copy. Prototype pages have no tests.
- **Impact:** Copy/navigation regressions will not fail CI.
- **Remediation:** Add source-boundary tests for prototype “Sign out” href vs Server Action; optional shallow render tests for view-model → catalog.
- **Acceptance:** A broken `actorLine` or workspace kind mapping fails `npm test`.

### CUR-011 — Duplicate TASK-005 contract without handoff

- **Severity:** medium
- **Confidence:** high
- **Classification:** accepted documentation debt / pre-MVP hygiene
- **Owner:** Codex
- **Affected:** `docs/tasks/TASK-005-cursor-authenticated-product-shell.md` vs `docs/tasks/TASK-005-cursor-authenticated-shell.md`.
- **Evidence:** Same objective; only the latter has Cursor handoff.
- **Impact:** Agents may implement the shell twice or treat demo `/tenants` as TASK-019.
- **Remediation:** Mark the duplicate as superseded.
- **Acceptance:** One canonical TASK-005 pointer.

### CUR-012 — Keyboard/semantics gaps on demo workbench and Suspense

- **Severity:** medium
- **Confidence:** medium (code fact; browser unconfirmed)
- **Classification:** pre-MVP a11y
- **Owner:** Cursor
- **Affected:** `apps/web/app/cases/page.tsx` 76–93 (`role="tablist"` on links with `aria-current="page"`, no `role="tab"` / `aria-selected`); `apps/web/app/denied/page.tsx` 65–67 and several pages wrap `useSearchParams` in `Suspense` **without** fallback (`company/page.tsx` 63–67, `operator/page.tsx` 41–45, `policies/page.tsx` 34–38).
- **Evidence:** Intake/admin/governance loading views use `aria-busy`/`aria-live`; company/operator/cases do not.
- **Impact:** Screen readers get a fake tablist; possible blank flash on filter pages.
- **Remediation:** Use tabs correctly or a labeled radio/link group; add `Suspense` fallbacks.
- **Acceptance:** Keyboard and SR pass on `/cases` and `/company` (needs browser).

### CUR-013 — Sign-in page ignores an existing session

- **Severity:** medium
- **Confidence:** high for code; medium for UX impact
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/app/page.tsx` (only `hasPublicSupabaseConfig()`).
- **Evidence:** No `getUser()` / redirect to `/workspace` when a cookie exists. Demo entry remains.
- **Impact:** Signed-in users can submit the form again or enter sample data without a session reminder.
- **Remediation:** If session valid, offer “Continue to workspace” and keep demo clearly secondary.
- **Acceptance:** With a valid cookie, `/` does not look like a cold start (browser).

### CUR-014 — Mobile shell drops navigation items

- **Severity:** low
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/components/prototype/app-shell.tsx` 294–314 (`items.slice(0, 3)` plus Sign out).
- **Evidence:** Company-admin has more than three destinations (`app-shell.tsx` 62–80).
- **Impact:** Members/governance links may exist only in the desktop/sheet menu.
- **Remediation:** Overflow “More” sheet on small viewports.
- **Acceptance:** All role routes reachable at 375px width (browser).

### CUR-015 — Demo role switcher presents workspace switching as product navigation

- **Severity:** low
- **Confidence:** high
- **Classification:** accepted limitation if banner stays; else pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/components/prototype/app-shell.tsx` 348–366; `messages.nav.switchView`.
- **Evidence:** Switching uses `rolePaths` links, filtered by the **page-supplied** capability list, not a server.
- **Impact:** Fine for a prototype; harmful if CUR-001 is unfixed.
- **Remediation:** Label as “Demonstration workspace”.
- **Acceptance:** Visible “fictional” wording next to the switcher.

### CUR-016 — Prior UI tasks never browser-verified `/workspace` or new governance

- **Severity:** low
- **Confidence:** high
- **Classification:** process
- **Owner:** Cursor / Codex
- **Affected:** TASK-018 handoff (browser unavailable); TASK-017 same.
- **Evidence:** Task files state no screenshots. This audit also had no browser.
- **Impact:** Responsive/focus regressions possible despite passing builds.
- **Remediation:** Human or headed browser pass of `/`, `/workspace`, `/tenants`, `/company`, `/cases`, `/super-admin/tenants`.
- **Acceptance:** Written checklist with viewport widths.

### CUR-017 — Demo denied/invite authorization from the URL

- **Severity:** low
- **Confidence:** high
- **Classification:** accepted limitation (ADR 0010 / TASK-005) **until** routes become real
- **Owner:** n/a while demo; Claude+Cursor when converting
- **Affected:** `apps/web/app/denied/page.tsx` 34–39; `apps/web/app/invite/page.tsx` 21–22; `state=` query on members/entities/governance.
- **Evidence:** `useSearchParams` selects capability, membership id, or empty/denied/loading.
- **Impact:** None for real data; must not be copied into TASK-019.
- **Remediation:** Keep conversion off these patterns.
- **Acceptance:** TASK-019 tests forbid URL-trusted tenant/capability.

### CUR-024 — Fixture narrative copy lives outside the message catalog

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP (ADR 0002)
- **Owner:** Cursor
- **Affected:** `apps/web/lib/demo/data.ts` (evaluation `recommendation`, alert titles, case `lastNote`); rendered on `/cases/:id` and Company/Operator tables.
- **Evidence:** User-visible English is stored on fixture objects rather than `messages.ts`. ADR 0002 requires externalized runtime copy.
- **Impact:** Future locale work and copy review miss operational sentences.
- **Remediation:** Move displayed fixture sentences into the catalog keyed by stable IDs.
- **Acceptance:** No user-facing sentence remains only in `lib/demo/data.ts`.

### CUR-025 — Escalate toast can be read as a real notification

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/lib/i18n/messages.ts` 493 (`toastEscalateBody`: “A fictional analyst was notified.”); `apps/web/app/operator/page.tsx`.
- **Evidence:** Past tense “was notified” plus “fictional analyst” still asserts a notify event. Other toasts say “No message was sent.”
- **Impact:** Weaker honesty than adjacent operator actions.
- **Remediation:** Align with “No message was sent.”
- **Acceptance:** Escalate copy does not claim a notification occurred.

### CUR-026 — Platform tenant detail opens global Helix Company/Operator, not that tenant

- **Severity:** medium
- **Confidence:** high
- **Classification:** pre-MVP
- **Owner:** Cursor
- **Affected:** `apps/web/app/super-admin/tenants/[id]/page.tsx` 274–278 (`Link` to `/company` and `/operator`).
- **Evidence:** Buttons sit on a specific governed tenant row but always open Helix fixture workspaces (`currentTenant`).
- **Impact:** Reviewers infer platform support can open that tenant’s operations (TASK-017 copy elsewhere denies impersonation).
- **Remediation:** Label as “Open Helix demonstration” or remove until TASK-019.
- **Acceptance:** The destination tenant name matches the row, or the control is clearly sample-only.

### CUR-027 — In-page nav smooth-scroll ignores `prefers-reduced-motion`

- **Severity:** medium
- **Confidence:** high for code; browser unconfirmed for impact
- **Classification:** pre-MVP a11y
- **Owner:** Cursor
- **Affected:** `apps/web/components/prototype/app-shell.tsx` 100–102 vs `apps/web/app/globals.css` reduced-motion rules that do not cover JS `scrollIntoView`.
- **Evidence:** `behavior: 'smooth'` is unconditional.
- **Impact:** Vestibular/motion-sensitive users get animated jumps on Company/Operator section nav.
- **Remediation:** Use `auto` when `matchMedia('(prefers-reduced-motion: reduce)')`.
- **Acceptance:** Browser check with reduced-motion enabled.

### CUR-028 — Case “record decision” updates only an in-memory timeline

- **Severity:** low
- **Confidence:** high
- **Classification:** accepted demo limitation unless copy claims the card changed
- **Owner:** Cursor
- **Affected:** `apps/web/app/cases/[id]/page.tsx` 72–90 vs the decision card still reading fixture `recordedDecision`.
- **Evidence:** `append` pushes `local_*` events; the decision summary field is not updated. TASK-008 already said fixtures are not the source of truth.
- **Impact:** Timeline looks like an audit log of a decision the summary does not show.
- **Remediation:** Disable the summary, or keep both views in sync locally, with existing “never persist” copy.
- **Acceptance:** After a local decision action, summary and timeline do not contradict.

### CUR-029 — TASK-003 has no handoff section

- **Severity:** low
- **Confidence:** high
- **Classification:** documentation hygiene
- **Owner:** Codex
- **Affected:** `docs/tasks/TASK-003-codex-integration-foundation.md`.
- **Evidence:** File ends at acceptance criteria; `scripts/check-secrets.sh` and `quality.yml` exist.
- **Impact:** Merge history of the integration gates is not reconstructible from the contract.
- **Remediation:** Append a late handoff pointing at the commits that landed the scripts.
- **Acceptance:** TASK-003 contains Outcome / Checks like sibling tasks.

### CUR-030 — Recommendation vocabulary is not one product glossary (positive-adjacent)

- **Severity:** observation
- **Confidence:** medium
- **Classification:** pre-MVP copy alignment, not a defect until a human picks terms
- **Owner:** human (risk-decision language) then Cursor
- **Evidence:** ADR 0007 / engine use `approve` / `review` / `reject`. TASK-010 UI uses “accept path / additional evidence.” Case actions include escalate/RFI. TASK-009 contract text historically said allow/decline.
- **Impact:** Training and future real UI may disagree with stored `DecisionBand`.
- **Remediation:** One glossary in the catalog; do not treat this as an engine bug.
- **Acceptance:** Human-approved terms mapped in `messages.ts` only.

### CUR-018 — English-first and market-neutral UI copy (positive)

- **Severity:** observation
- **Confidence:** high
- **Classification:** accepted
- **Owner:** n/a
- **Evidence:** No Portuguese/CPF/CNPJ/BRL/São Paulo matches in `apps/web` `ts/tsx/json`. Catalog is English. Dates go through `Intl` + UTC.
- **Impact:** ADR 0002 appears held for runtime UI.
- **Remediation:** none.
- **Acceptance:** keep catalog discipline.

### CUR-019 — Prototype persistence/email/support copy is generally honest

- **Severity:** observation
- **Confidence:** high
- **Classification:** accepted
- **Owner:** n/a
- **Evidence:** Company admin and platform governance strings state toasts do not save, email, or impersonate (`messages.ts` around 249–277, 413–439). Intake `ackTitle`: “Intake was not saved”.
- **Impact:** Reduces false operational trust **inside** those screens.
- **Remediation:** none besides CUR-001/002 labels.

### CUR-020 — Approved brand mark is in use

- **Severity:** observation
- **Confidence:** high
- **Classification:** accepted
- **Owner:** n/a
- **Evidence:** `mitiga-mark.tsx` 6–32; layout icons `/mitiga-symbol.png`. Compact mark uses `brandMarkAlt`; full mark uses empty `alt` beside visible wordmark (decorative pattern).
- **Remediation:** none required.

### CUR-021 — Ungated fixture routes match ADR 0010

- **Severity:** observation
- **Confidence:** high
- **Classification:** accepted limitation
- **Owner:** human (hosting policy)
- **Evidence:** ADR 0010: fixture routes were not wrapped in real session checks so Elena Park is not presented as the authenticated user **on those routes by design** — but `/workspace` now deep-links into them (CUR-001).
- **Remediation:** do not “fix” by wrapping `/company` in `requireAuthenticatedIdentity()` while fixtures remain.

### CUR-022 — Local quality gates pass at the audited SHA

- **Severity:** observation
- **Confidence:** high
- **Classification:** accepted
- **Evidence:** see Checks below.

### CUR-023 — Sibling TASK-021 owns architecture/RLS/session-cookie depth

- **Severity:** observation
- **Confidence:** high
- **Classification:** n/a
- **Evidence:** `docs/tasks/TASK-021-claude-architecture-security-audit.md` on the same tag. This report does not re-audit RLS or cookie flags.

---

## Accessibility, responsive, navigation (synthesis)

| Area | Fact | Gap |
|---|---|---|
| Skip links | Prototype chrome and `/workspace` frame have skip-to-content | Not browser-verified |
| Auth forms | Labels, `aria-busy` on submit, `role="alert"` on sign-in errors | Errors not `aria-describedby` on fields |
| Empty/error/denied | URL-driven demo states exist for admin, entities, governance | Company/operator empty via `state=empty` only; no loading on those pages |
| Focus | Buttons `min-h-11` widely used | CUR-012 tablist; CUR-014 mobile overflow |
| Contrast | Tokens/sober palette in CSS | Banner `#eef4f2` / `#3d4d57` unmeasured |

## Privacy / tenant representation

- Real PII on screen: verified email on `/workspace` only (plus whatever the user types on `/`).
- Fixtures use `*.demo.mitiga.local` and fictional names.
- Tests use `example@demo.mitiga.local`.
- This audit did not open `.env`.
- Tenant isolation in **UI**: `/workspace` shows a count, not tenant rows (TASK-018). Demo UIs show named fictional tenants. Server RLS is TASK-021.

## Test and build evidence

See Checks. Product-experience coverage is concentrated on domain evaluation, tenancy keys, auth error mapping, and workspace **classification**. There is no end-to-end or component test that a user can reach Helix from login without a real session.

---

## Recommended 35-day frontend/product sequence

This is a delivery **suggestion** for Codex/Cursor/Claude. It does **not** approve Auth policy, hosted projects, email templates, tenant suspension, or production.

1. **Days 1–7 — Claude TASK-019** on `/workspace` only (membership list, explicit multi-tenant choice, capability RPC, session-refresh middleware). Do not convert `/company`.
2. **Days 5–10 — Cursor honesty patch (CUR-001, CUR-002, CUR-009, CUR-013)** so a real cookie and Elena Park cannot be read as the same person; document-title split; `/` continue-to-workspace. Human decides if sample data stays on the preview origin.
3. **Days 8–14 — Cursor demo coherence (CUR-005, CUR-006, CUR-007, CUR-008)** one tenant per flow; one Super Admin landing.
4. **Days 12–18 — Recovery completion (CUR-004)** after human Auth redirect configuration.
5. **Days 15–22 — First real operational slice** only after 019: likely entity list **or** tenant-scoped workspace home — not the whole prototype.
6. **Days 18–28 — A11y + tests (CUR-010, CUR-012, CUR-014, CUR-016, CUR-024, CUR-027)** including a headed pass at ~375px and desktop, catalogued fixture sentences, and reduced-motion on section scroll.
7. **Days 25–35 — Freeze demo vs real** in copy and IA; remaining fixture routes stay labeled; no silent “this is now live.”

Protected questions for the human owner (not decided here): whether the Vercel preview may keep an ungated demo next to real login; password-reset email URLs; when Northstar test users may be used in a recorded browser pass.

---

## Checks run and exact results

Recorded 2026-09-14 against `93d02fd8b206e0dea2b36af0dec9f1e91847196a`. `.env` not read.

```text
cd apps/web && npm test
```

`tests 106`, `pass 106`, `fail 0`, `duration_ms 759.247517`.

```text
cd apps/web && npx tsc --noEmit -p tsconfig.json
```

Passed with no diagnostics (silent). Then `npm run build` ran in the same `&&` chain.

```text
cd apps/web && npm run build
```

`vinext build` completed; route table includes `/workspace` and the demo routes listed above.

```text
cd apps/web && npm run verify:vercel
```

`.vercel/output` is genuine Vercel Build Output API v3 (`config.json` v3, Node.js function, static/_next bundle).

```text
./scripts/check-secrets.sh
```

`Secret check passed.`

```text
./scripts/verify-web.sh
```

oxlint completed with no reported issues (UI folder ignored per script); second `vinext build` succeeded; `Web verification passed.`

Browser inspection: **unavailable**. No screenshots.

---

## Security / tenant / privacy / audit impact of this audit

Documentation only. No mutations, no hosted access, no secrets in this report.

Rollback: delete the audit branch or revert the documentation commits.

---

## Recommended reviewer

Codex (merge owner), coordinating with TASK-021 so product findings CUR-001–CUR-004 are not filed twice as security issues unless Claude independently confirms session-cookie behavior.

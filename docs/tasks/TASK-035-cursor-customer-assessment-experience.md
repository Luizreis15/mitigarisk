# TASK-035 — Customer and CRA assessment experience (Cursor)

Owner: Cursor · Reviewer: orchestrator (Claude, Cowork) · Approver/merge: Edu
Status: **Approved — 6 Oct 2026 (Edu)**
Branch: `feat/cursor-customer-assessment-experience`, created from `feat/customer-assessment` (PR #5). Do this in the Cursor worktree. Phase B is then rebased onto `feat/cra-lucimara-decisions` (TASK-034) once that handoff lands.

## Objective

This is the first screen a client and Lucimara can actually use for the product's core: register a fictional customer, run a CRA assessment and understand the result (score, band, due-diligence level, overrides, required actions, MLRO approval and next review date). All of it is backed by the real, audited database RPCs from TASK-033 and TASK-034.

## Product truths that must remain explicit

- All demo content is fictional.
- **The database decides.** The UI never computes, derives or forwards a score, band or outcome. It only sends the facts and renders the persisted result.
- An assessment is a risk classification, not a final decision. When `approvals_required` contains `MLRO`, the screen shows "MLRO sign-off required". The sign-off action itself comes in a later task, so show it as pending and not actionable.
- `REJECT` (a reject override hit) is shown as "Do not onboard — report to MLRO", with the override reasons.
- Platform administrators have no operational access (the routes deny them, as the supplier routes do).

## In scope

### Phase A: no dependency, start immediately

1. **Routes** (real and authenticated, following `app/workspace/suppliers/*`):
   - `/workspace/customers`: the list (name, external reference, nationality and residence, latest band and DD level, next review due), an empty state, and a "New customer" entry when the caller has `customer.manage`.
   - `/workspace/customers/new` (or an inline panel): the create form. Fields: external reference, full name, date of birth, country of birth, nationality, residence country (ISO alpha-2 select), and onboarding channel (face to face or non-face to face). Validation messages come from the domain `validateCreateCustomerInput`, if it exists; otherwise add a small pure validator in `lib/domain/customer.ts` with tests.
   - `/workspace/customers/[customerId]`: the profile, the latest assessment summary, and the assessment history (date, policy label, score, band, DD level, outcome, assessed by).
   - A workspace navigation entry for "Customers", visible with `customer.view`.
2. **Server Actions** in `app/workspace/customers/actions.ts`, with the **same posture as `app/workspace/suppliers/actions.ts`**:
   - the caller's cookie-backed client only (never a service-role client);
   - `resolveAuthorizedTenantContext` with the required capability on every call;
   - thin calls to `createCustomer` and `runCustomerAssessment`;
   - typed error codes mapped to catalog messages.
   - The correlation id for an assessment is generated server-side when the form renders and carried in a hidden field. A double submit is then idempotent; a replay with different facts surfaces the 23505 conflict as a friendly message.
3. **Result presentation** (a workspace component, reusable later in the audit pack):
   - the overall score and category scores as bars;
   - a band badge (LOW/MEDIUM/HIGH) and the DD level (SDD/CDD/EDD);
   - the outcome;
   - the overrides that fired, with a plain-English reason for each;
   - required actions as a checklist (display only);
   - required approvals;
   - missing factors and reason codes in an expandable "Why this result" section;
   - the next review date and the policy label/version.

   Non-technical readers must be able to follow it; the raw codes stay visible under the expandable section.

### Phase B: after TASK-034 delivers `getCustomerAssessmentForm`

4. **The assessment form on the customer page** is generated from `getCustomerAssessmentForm`:
   - one control per factor, grouped by category in `position` order, each with an explicit "Not known" option that sends the fact as absent;
   - one **required** control per override, where "None" or "No" is the `negative_value`;
   - an override marked `provisional` gets a small "provisional (pending compliance confirmation)" tag;
   - labels for factor keys and values come from the typed message catalog, with a readable fallback (key → "Sentence case") so a new policy value never breaks the screen;
   - never show weights or points (the RPC does not return them).
5. **Error states:**
   - `P0003` (no published policy): "Your company has no published risk policy yet";
   - `22023` (invalid facts): this should not happen with a generated form, so show a generic error with the correlation id;
   - denied: the standard denied page.

## Out of scope

- Any migration, RLS policy, RPC, seed or capability change.
- Changes to the repositories, apart from consuming TASK-034's function.
- The MLRO sign-off action, the Board escalation, trigger rules, the HTTP API, the audit-pack export and the supplier flow.

## Acceptance criteria

1. Locally (fresh `supabase db reset`, signed in as the seeded demo operator), these flows work in the browser:
   - create a customer;
   - run an assessment with a clean profile and get LOW/SDD;
   - assess the same customer as a confirmed PEP and get HIGH/EDD with "MLRO sign-off required";
   - assess with a confirmed sanctions match and get the REJECT presentation.
2. The auditor sees the list and the history, but no create or assess controls. A platform administrator is denied.
3. All new copy is in the typed catalog. The pages are keyboard accessible and responsive. Screenshots at narrow and wide widths are attached to the handoff.
4. Source-boundary tests prove that the actions never import a service-role client and never compute a score. `npm test`, tsc, lint, build, the Vercel build/verify and secrets all pass.

## Rules

- Reuse the existing MITIGA components and tokens. Synthetic data only.
- No `.env`, no hosted services, no push or merge. Conventional Commits in English.
- If a needed backend behaviour is missing, stop and report it; do not work around it in the UI.

## Expected handoff

The standard template, plus:
- the route map;
- screenshots of the four flows;
- the capability-based visibility matrix;
- the SHA.

## Handoff — Phase A

**Outcome:** Phase A implemented on `feat/cursor-customer-assessment-experience` (from `origin/feat/customer-assessment`, PR #5). Customers can be listed, created and opened; the customer page shows the profile, the latest persisted CRA result through a new reusable result component, and the full assessment history. Phase B (the generated assessment form) is not implemented or stubbed; the customer page carries a labelled, control-free placeholder for it. No migration, RLS, RPC, seed, capability or repository change. Nothing pushed, merged, or opened as a PR.

**Commits:**

```text
223736a docs(task): add TASK-035 contract
4cc2eee feat(web): add customer list, creation, profile, and CRA result presentation
946388e test(web): add customer source-boundary and CRA result presentation tests
```

The next commit records this handoff; the branch tip is reported in the reply (a commit cannot contain its own hash).

### Route map

| Route | Gate | Content |
|---|---|---|
| `/workspace` (existing) | active membership | New "Customers" entry card, rendered only when `has_capability(tenant, 'customer.view')` is true for the server-verified tenant; a failed capability read hides it. |
| `/workspace/customers?tenant=` | `customer.view` | List: name, external reference, nationality / residence, latest band, DD level, next review due; empty state; "New customer" button only with `customer.manage`. |
| `/workspace/customers/new?tenant=` | `customer.view`, then `customer.manage` (otherwise redirected to the list) | Create form: external reference, full name, date of birth, country of birth, nationality, residence country (ISO alpha-2 selects), onboarding channel. Submits to `createCustomerAction`; success redirects to the profile. |
| `/workspace/customers/[customerId]?tenant=` | `customer.view` | Profile, latest assessment (result component) or "No assessment yet", phase B placeholder (only with `assessment.run`), assessment history. Malformed or cross-tenant id: generic "Customer not found". |

Every route: missing public Supabase config → `/workspace`; platform administrator → `/workspace`; tenant not proven or capability missing → `/workspace` (same as the supplier routes).

### Capability-based visibility matrix

| Element | tenant_admin | risk_analyst | operator | auditor | platform admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Workspace "Customers" entry (`customer.view`) | ✓ | ✓ | ✓ | ✓ | — (no tenant workspace) |
| Customer list + history (`customer.view`) | ✓ | ✓ | ✓ | ✓ | denied (redirect) |
| "New customer" button / `/new` route (`customer.manage`) | ✓ | ✓ | ✓ | — (redirected to list) | denied |
| `createCustomerAction` (`customer.manage`) | ✓ | ✓ | ✓ | `ForbiddenError` | `ForbiddenError` (explicit guard) |
| Phase B placeholder panel (`assessment.run`) | ✓ | ✓ | ✓ | — | denied |

Capabilities are always read from the database (`resolveAuthorizedTenantContext` / `has_capability`); the UI infers nothing from roles or the URL.

### Files changed

- `apps/web/app/workspace/customers/actions.ts` (new): `createCustomerAction` — cookie-backed client only, platform-admin guard, `resolveAuthorizedTenantContext(..., 'customer.manage')`, domain `validateCreateCustomerInput`, thin `createCustomer` RPC call, typed error name → catalog message.
- `apps/web/app/workspace/customers/page.tsx`, `new/page.tsx`, `[customerId]/page.tsx` (new).
- `apps/web/app/workspace/page.tsx`, `components/workspace/workspace-experience.tsx`: Customers entry gated on `customer.view`.
- `apps/web/components/workspace/customer-list.tsx`, `customer-create-form.tsx`, `customer-profile.tsx`, `customer-assessment-result.tsx` (reusable result), `customer-assessment-history.tsx`, `customer-band-badge.tsx`, `customer-assessment-form-placeholder.tsx`, `workspace-customer-entry.tsx` (new).
- `apps/web/components/workspace/workspace-real-frame.tsx`: optional `kicker` / `fictionalNotice` props (defaults keep the supplier pages unchanged).
- `apps/web/lib/i18n/messages.ts`: new `customerWorkspace` catalog (all new copy, including band/DD/outcome/approval labels and plain-English override, action, category and factor labels for Template v1).
- `apps/web/lib/i18n/customer-assessment.ts` (new): pure view model of a persisted result (code → catalog label, readable fallback for unknown codes).
- `apps/web/lib/i18n/countries.ts` (new): ISO 3166-1 alpha-2 list, names from `Intl.DisplayNames`.
- `apps/web/lib/i18n/presentation.ts`: `formatDate`.
- `apps/web/tests/app/customer-actions-boundary.test.ts`, `apps/web/tests/i18n/customer-assessment-presentation.test.ts` (new, 16 tests).

### Checks (Node v24.11.1, npm 11.6.2, run in `apps/web` unless noted)

| Check | Exit code |
|---|---|
| `npm ci` | 0 |
| `npm test` | 0 — 301 passed (285 baseline + 16 new), 0 failed |
| `npx tsc --noEmit -p tsconfig.json` | 0 |
| `npm run lint` | 0 |
| `npm run build` | 0 (routes `/workspace/customers`, `/new`, `/:customerId` listed) |
| `npm run build:vercel` | 0 |
| `npm run verify:vercel` | 0 — genuine Build Output API v3 |
| `./scripts/check-secrets.sh` (repo root) | 0 |
| `git diff --check` (tree and `origin/feat/customer-assessment...HEAD`) | 0 |

### Screenshots

None. `docker info` fails on this machine (Docker is not running), so the local Supabase stack (`supabase db reset` + seeded demo operator) could not be started, and the four browser flows of acceptance criterion 1 were not exercised. I also did not run the dev server against fixtures: `apps/web` has a `.env.local` (not read) that Vite would load, and the middleware would then contact whatever Supabase project it points to, which could be hosted. Verification relies on the tests above. The browser flows and narrow/wide screenshots remain open for phase B (or for a reviewer with Docker).

### Decisions

- **Result component takes a view model.** `buildAssessmentResultView()` (pure `.ts`) maps the stored `result` jsonb and stored columns to catalog labels; the `.tsx` only renders it. This keeps the component reusable for the audit pack and testable under `node --test` (which cannot import `.tsx`). It copies values verbatim: a test feeds an inconsistent result (score 99.25 with band LOW) and checks nothing is re-derived. Category bar widths are the persisted category score bounded to 0–100, used only for display.
- **MLRO and Board approvals** are shown as "MLRO sign-off required" / "Board approval required", each with a "Pending" badge and the note that sign-off is not available in this release. No button, no link.
- **REJECT** shows a destructive alert "Do not onboard — report to MLRO" listing the plain-English reason for each override that fired; the outcome label in the summary and history uses the same copy.
- **"Why this result"** is a native `<details>`/`<summary>` (keyboard accessible without JS) holding missing factors (label + raw key), override codes and every raw reason code.
- **Create form on its own route** (`/workspace/customers/new`), not inline, so the auditor's list has no create affordance at all and the route itself redirects without `customer.manage`.
- **Country selects** are built on the server (`countryOptions()`) and passed to the client form, so server and client render identical labels. Names come from `Intl.DisplayNames` (ADR 0002: no hard-coded country names); the stored value is always the alpha-2 code.
- **History "Assessed by"** shows "You" for the caller and a short user-id prefix otherwise, and the policy column shows a short policy-version id (full id in the `title` and in the result panel). See limitations.
- **`runCustomerAssessment` action deferred to phase B.** The contract lists it under phase A item 2, but the facts it forwards are shaped by the form `getCustomerAssessmentForm` generates (TASK-034), and this task was instructed not to implement or stub phase B. `actions.ts` documents this; the boundary tests already cover any future action in that file (platform-admin guard before capability resolution, no score/band/outcome fields read, no engine import).

### Known limitations

- **No policy label or assessor name.** `customer_assessments` exposes `policy_version_id` and `assessed_by` only, and no repository reads `policy_versions.version_label` or user display names. Adding those reads would be a repository change, which is out of scope. The UI shows ids. Phase B (or a small backend follow-up) should add a read path (for example, the policy label on the assessment read or a join), so "policy label/version" can be shown as the contract intends.
- **List does one latest-assessment read per customer** (`getLatestCustomerAssessment` per row, RLS-scoped). Fine at demo scale; a list-level read path would remove the N+1.
- Browser flows and screenshots not done (see above).
- No customer search, pagination or edit (not in scope).

### What phase B needs

1. TASK-034's `getCustomerAssessmentForm` on the rebased branch (`feat/cra-lucimara-decisions`).
2. Add `runCustomerAssessmentAction` to `app/workspace/customers/actions.ts`: platform-admin guard, `resolveAuthorizedTenantContext(..., 'assessment.run')`, facts built only from the generated controls ("Not known" → absent), correlation id generated in the page render and carried in a hidden field, thin `runCustomerAssessment` call; map `AssessmentCorrelationConflictError` (23505), `NoPublishedCraPolicyError` (P0003: "Your company has no published risk policy yet"), `InvalidAssessmentFactsError` (22023: generic error with the correlation id), `CustomerNotFoundForAssessmentError` and `ForbiddenError` into `customerWorkspace.errors`.
3. Replace `CustomerAssessmentFormPlaceholder` (rendered only with `assessment.run`) with the generated form; reuse `messages.customerWorkspace.factors` / `humanizeCode` for labels and add value labels and the "provisional" tag copy to the catalog.
4. Run the four browser flows on a fresh local `supabase db reset` (needs Docker) and attach narrow/wide screenshots.
5. Optionally, a backend read path for the policy label and assessor display name.

**Security / tenant / audit impact:** read paths go through the caller's RLS-scoped client and the existing repositories; the only write is the existing audited `create_customer` RPC. No service-role usage (enforced by test). No new data stored. **Rollback:** revert the two feature/test commits; no data or schema to roll back.

**Recommended reviewer:** the orchestrator (Claude, Cowork).

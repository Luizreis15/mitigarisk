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

## Handoff — Phase B

**Outcome:** Phase B implemented on `feat/cursor-customer-assessment-experience`, on top of TASK-034 (merge `62f40ec`, PR #7). The Phase A placeholder is replaced by the assessment form generated from `getCustomerAssessmentForm`, and the deferred `runCustomerAssessmentAction` now exists. After a successful run, the page redirects to itself, so the new persisted result renders through the Phase A result component and appears in the history. No migration, RLS, RPC, seed, capability or repository change. Nothing pushed, merged, or opened as a PR. **Browser verification was not possible:** `docker info` still fails (exit 1), so the local Supabase stack could not be started (details below).

**Commits:**

```text
05901ab feat(web): add the generated customer assessment form and run action
3919bda test(web): cover assessment facts building, form presentation, and the run action boundary
```

The next commit records this handoff; the branch tip is reported in the reply.

### What the customer page now does (`/workspace/customers/[customerId]`)

- **With `assessment.run`:** the server reads the form with `getCustomerAssessmentForm(client, tenantId)` and renders:
  - the current policy label (`policy_label`);
  - one select per factor, grouped by category (fieldset/legend), with categories and factors re-sorted by `position` in the view model rather than trusting array order. Options are the policy's values plus an explicit **"Not known"** option, which is selected by default and sends the fact as absent;
  - one **required** radio group per override (native `required` radios plus a server check), with the negative value labelled "None"/"No". `provisional` overrides get the tag "provisional (pending compliance confirmation)";
  - hidden fields: `tenantId`, `customerId`, the `correlationId` generated with `randomUUID()` on every server render, and `policyVersionId`.
- **Without `assessment.run` (auditor):** the form is never fetched or rendered. The auditor still sees the profile, latest result and history.
- **P0003:** the panel "Your company has no published risk policy yet" is shown instead of the form.
- **Any other form read error:** a generic "could not be loaded" alert.
- **Labels:** category, factor, override fact and value labels come from `messages.customerWorkspace` (`categories`, `factors`, `overrideFacts`, `factValues`). Fallbacks: for categories, the policy's own category label, then sentence case; for everything else, sentence case of the key (`humanizeCode`). Weights and points are never shown; the RPC does not return them, and tests check that the view and component never mention them.
- **Policy label:** shown on the latest result and on history rows whose `policyVersionId` matches the current form's policy. Other versions keep a short id (backend follow-up below).

### `runCustomerAssessmentAction` (`app/workspace/customers/actions.ts`)

Same posture as `createCustomerAction`: cookie-backed client only; platform admin returns `ForbiddenError` before any tenant work; `resolveAuthorizedTenantContext(..., 'assessment.run')` on every call. Then:
1. `customerId` and `correlationId` must be UUIDs (otherwise `InvalidAssessmentRequestError`).
2. **The form is re-fetched server-side.** If the submitted `policyVersionId` differs from it, the action returns `AssessmentPolicyChangedError` ("reload to use the current policy"); this avoids answers built for an older policy.
3. **`buildAssessmentFacts(form, readField)`** (pure, `lib/domain/customer-assessment-facts.ts`):
   - only keys the form lists are read, so any other submitted key is dropped by construction;
   - "Not known" or an empty factor is omitted;
   - a factor value that is not listed, or longer than `CRA_FACTOR_VALUE_MAX_LENGTH`, raises `InvalidFactorAnswerError`;
   - an absent override raises `MissingOverrideAnswerError`;
   - override values use a typed encoding (`string:none`, `boolean:false`), so the string `"true"` and the boolean `true` cannot collide. A value that is not in the override's list (strict equality) raises `InvalidOverrideAnswerError`.
4. Thin `runCustomerAssessment(client, { tenantId, customerId, facts, correlationId })`, then a redirect to the customer page.

| Situation | Presentation |
|---|---|
| 23505 `AssessmentCorrelationConflictError` (same rendered form re-submitted with different answers) | "This form was already submitted with different answers. Reload the page to run a new assessment." An identical double submit is idempotent: the RPC returns the existing row. |
| P0003 `NoPublishedCraPolicyError` | "Your company has no published risk policy yet" |
| 22023 `InvalidAssessmentFactsError` | Generic "could not be recorded. Nothing was stored." plus "Reference: <correlation id>" |
| P0002 `CustomerNotFoundForAssessmentError` | "This customer could not be found in your active company." |
| `ForbiddenError` (capability or RPC 42501) | redirect to the standard `/denied` page |
| Every error | the correlation id is returned and shown as a reference |

### Files changed

- `apps/web/app/workspace/customers/actions.ts`: `runCustomerAssessmentAction`.
- `apps/web/app/workspace/customers/[customerId]/page.tsx`: form fetch gated on `assessment.run`, render-time correlation id, P0003/error states, policy label.
- `apps/web/components/workspace/customer-assessment-form.tsx` (new, client form); `customer-assessment-form-placeholder.tsx` (deleted).
- `apps/web/components/workspace/customer-assessment-result.tsx`, `customer-assessment-history.tsx`: optional policy label.
- `apps/web/lib/domain/customer-assessment-facts.ts` (new, pure facts builder and typed errors).
- `apps/web/lib/i18n/customer-assessment-form.ts` (new, form view model); `customer-assessment.ts` (`policyLabel`); `messages.ts` (`assessmentForm`, `factValues`, `overrideFacts`, new error copy; placeholder copy removed).
- Tests: `tests/app/customer-actions-boundary.test.ts` (extended), `tests/domain/customer-assessment-facts.test.ts` (new, 8), `tests/i18n/customer-assessment-form-presentation.test.ts` (new, 6).

### Checks (Node v24.11.1, npm 11.6.2, in `apps/web` unless noted)

| Check | Exit code |
|---|---|
| `npm ci` | 0 |
| `npm test` | 0 — 327 passed (310 at the merge + 17 new), 0 failed |
| `npx tsc --noEmit -p tsconfig.json` | 0 |
| `npm run lint` | 0 |
| `npm run build` | 0 |
| `npm run build:vercel` | 0 |
| `npm run verify:vercel` | 0 |
| `./scripts/check-secrets.sh` (repo root) | 0 |
| `git diff --check` | 0 |

The intermediate feature commit `05901ab` alone fails one Phase A boundary assertion (the removed placeholder); `3919bda` updates it. Every gate above was run on the tip.

### Browser verification and screenshots

**Not done.** `docker info` exits 1 (the Docker daemon is not running), so `supabase start` / `supabase db reset` (local only) could not run, and no screenshots exist under `docs/orquestracao/screenshots/task-035/`. No hosted Supabase was contacted and no `.env`/`.env.local` was read. The four acceptance flows (create a customer, clean profile → LOW/SDD, confirmed PEP → HIGH/EDD with "MLRO sign-off required", confirmed sanctions → REJECT presentation) remain to be run by someone with Docker. The tests cover the logic: facts building, form presentation, result presentation on casebook CB-01/CB-11/CB-09, and the source boundaries. When Docker is available, the dev command must get the local URL and anon key through the process environment. Before relying on that, check whether Vite's `.env.local` loading would override them.

### Decisions

- **Factors default to "Not known"; overrides have no default.** This follows the contract literally: factors offer an explicit "Not known" option, while overrides are required. An analyst who skips a factor gets the policy's missing-data treatment, which is visible in "Why this result".
- **An invalid value is rejected, not dropped.** An unknown *key* is dropped (it is never read). A disallowed *value* for a known key fails the submission, because silently turning a tampered value into missing data would change the score.
- **Stale-policy guard.** The submitted `policyVersionId` must equal the re-fetched form's. This closes TASK-034's noted limitation (a form held open across a publish) with a friendly message instead of a 22023.
- **Denied → `/denied`.** The contract asks for the standard denied page. The existing `/denied` page shows a generic "requested capability" label, because `assessment.run` is not in its prototype capability list. The pages themselves still redirect to `/workspace` on missing capability, the same as the supplier routes.
- **Native radios for overrides,** so the values reach `FormData` reliably and `required` works without JavaScript.

### Known limitations and backend follow-ups

- **Policy label for past assessments:** `customer_assessments` exposes only `policy_version_id`, and no repository reads `policy_versions.label`. History rows for a non-current policy keep a short id. Follow-up: add the label to the assessment read (or a policy-label read) in the repository.
- **Assessor display name:** still a short user id ("You" for the caller); no profile read path.
- **List N+1:** one latest-assessment read per customer (unchanged from Phase A).
- **Browser flows and screenshots:** pending Docker (see above).

**Security / tenant / audit impact:** the only new write path is the existing audited `run_customer_assessment` RPC through the caller's RLS-scoped client. Facts are built only from the server-re-read form, and the database re-validates them (22023). No service-role usage (enforced by test), no score computed in the UI. **Rollback:** revert `05901ab` and `3919bda` (Phase A remains intact); no data or schema to roll back.

**Recommended reviewer:** the orchestrator (Claude, Cowork).

## Handoff — review fixes

Addresses `docs/orquestracao/REVIEW-TASK-035.md` (APPROVED WITH CONDITIONS) and REVIEW-TASK-034 I-1. Fix commit: `4f60001`. No migration, RLS, RPC, seed, capability or repository change.

### Finding → fix

| Finding | Fix |
|---|---|
| M1 — React 19 resets forms before each Server Action | Error results carry `attempt` (server `randomUUID`), `field` and the echoed `values`. Both forms are keyed by `attempt` and re-mount with `defaultValue`/`defaultChecked`. Create form: the 7 fields, sliced to 300 characters (`lib/domain/customer-form-state.ts`). Assessment form: only listed fields, and only values matching a listed option (`pickSubmittedAssessmentValues`, `withSubmittedValues`). The offending control gets `aria-invalid`/`aria-describedby`. `noValidate` is removed, so native `required` works. The server re-validates everything. |
| L1 — catalog lookup by inherited key | `customerErrorMessage` (`lib/i18n/customer-errors.ts`) uses `Object.hasOwn` with an `UnknownError` fallback. Tested with `constructor`, `__proto__` and `toString`. |
| L2 — `aria-required` on a plain fieldset | Removed. The radios keep `required`, the legend keeps "(required)", and the fieldset points at the error via `aria-describedby`. |
| L3 — facts builder hardening | Facts are a `Object.create(null)` object. `__proto__`/`constructor`/`prototype` throw `ReservedFactKeyError`. A repeated field throws `DuplicateAssessmentFieldError` (the reader uses `getAll`). Real factor values are submitted as `value:<v>`, so the `not_known` sentinel cannot collide with a policy value. A unit test covers each case. |
| L4 — weak source-boundary tests | The test walks the static import graph from `actions.ts` and every customer `page.tsx`. It asserts that `lib/supabase/server.ts` is unreachable, that no reachable module builds a raw `createClient` client, and that no reachable module references service-role helpers or `SERVICE_ROLE` (except `env.ts`, which defines them). A mutation check confirmed it fails on an injected import. Every literal FormData read in `actions.ts` must be on an allow-list and never match score/band/outcome. Only `readFormValue` and `fieldReader` read by variable. |
| Nits | `'/ 100'`, `'—'` and `'CUST-DEMO-010'` moved to the catalog. The visible score is `aria-hidden`, so the sr-only "{score} out of 100" is announced once. Unknown status/channel values fall back to `humanizeCode` (`lib/i18n/customer.ts`). Result list keys are `${code}-${index}`, and override radio ids are index-based. |
| REVIEW-TASK-034 I-1 — code points | `codePointLength` (`Array.from(value).length`) matches `char_length`. Tested with 64 emoji (accepted, 128 UTF-16 units) and 65 emoji (rejected). The casebook drift test uses the same counter. |

### Checks (in `apps/web` unless noted)

| Check | Exit code |
|---|---|
| `npm ci` | 0 |
| `npm test` | 0 — 345 passed, 0 failed (327 before + 18 new) |
| `npx tsc --noEmit -p tsconfig.json` | 0 |
| `npm run lint` | 0 |
| `npm run build` | 0 |
| `npm run build:vercel` | 0 |
| `npm run verify:vercel` | 0 |
| `./scripts/check-secrets.sh` (repo root) | 0 |
| `git diff --check` | 0 |

### Browser verification

**Still pending (condition C1).** `docker info` still exits 1, so the local stack could not start and there are no screenshots under `docs/orquestracao/screenshots/task-035/`. No hosted Supabase was contacted and `.env`/`.env.local` were not read.

### Notes

- The supplier forms have the same React 19 reset behaviour. This is out of scope here; recommend a follow-up that reuses the `attempt` + echoed-values pattern.
- The echoed create-form values are reflected only into the same user's form, via React-escaped `defaultValue`.

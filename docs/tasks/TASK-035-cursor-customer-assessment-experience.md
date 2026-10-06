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

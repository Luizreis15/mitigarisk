# ADR 0003 — Immutable evidence via triggers, not application discipline alone

- Status: accepted
- Date: 2026-09-12

## Context

`docs/architecture/PLATFORM-ARCHITECTURE.md` requires immutable published
policies and audit evidence, and states a recommendation must never
silently become the tenant's final business decision. Relying only on
"the application never issues an UPDATE" is not a real guarantee: any
future code path, script, or support action using the same database role
could violate it.

## Decision

- `policy_versions` (once `published`/`archived`), their `policy_factors`/
  `policy_thresholds`, `evaluations` (once `completed`/`failed`), their
  `evaluation_reason_codes`, `case_evidence`, `case_decisions`, and
  `audit_events` are all protected by `BEFORE UPDATE OR DELETE` (or
  `INSERT OR UPDATE OR DELETE`, where children must also stay closed once
  the parent is finalized) trigger functions that raise an exception
  (`errcode = '23001'`) regardless of caller role or RLS outcome. RLS is
  layered on top for who can attempt a write at all, but the trigger is the
  actual immutability guarantee.
- `audit_events` additionally has no client-facing INSERT policy at all:
  the only way to create one as an authenticated user is
  `public.record_audit_event()`, a `SECURITY DEFINER` function that stamps
  `actor_id = auth.uid()` itself, so a caller cannot forge another user's
  attribution. `service_role` (bypassing RLS) may still insert directly for
  `actor_type = 'service'/'system'` events — those are not attributable to
  a specific `auth.uid()` in the first place.
- A `policy_versions.status` transition from `published` to `archived` is
  the one allowed post-publication change, and only that column; every
  other column, and every row in `policy_factors`/`policy_thresholds`, is
  frozen from the moment of publication.
- An evaluation's `decision_band` is a recommendation column with no
  special protection against being non-final in the schema itself — that
  invariant ("never silently becomes the final business decision") is
  enforced structurally instead, by cases (`public.cases`,
  `public.case_decisions`) being the only place a human decision is
  recorded, and by evaluations having no column that means "this was
  acted on."

## Consequences

- These invariants hold even for a future service-role script, an
  admin console, or a bug in application code — not just for the current
  RLS-respecting client path.
- Every one of these triggers, plus the `record_audit_event` attribution
  guarantee, is exercised against a real (disposable, local, credential-free)
  Postgres instance in `supabase/tests/010-rls-tenant-isolation.sql` — see
  `supabase/tests/README.md`.
- A genuine correction to a finalized policy version or evaluation requires
  creating a new version/evaluation, never editing the old one. This is a
  deliberate constraint the eventual product UX must design around (e.g. "a
  new draft version copies factors from an archived one" rather than
  "edit and republish").

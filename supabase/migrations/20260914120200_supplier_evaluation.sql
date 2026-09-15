-- TASK-023: extend the existing evaluation bounded context
-- (20260912120300_evaluation.sql) for the real supplier evaluation slice,
-- and add the one atomic, capability-checked, audited write path a future
-- Evaluation API adapter needs.
--
-- Additive/expand-only: every new column is nullable or has a default, so
-- this is safe to apply over any existing evaluations row (docs/architecture/PLATFORM-ARCHITECTURE.md,
-- "expand/migrate/contract"). supplier_id is nullable because the
-- evaluations table is a shared bounded-context table that may one day
-- score a subject that is not a supplier; this task only ever writes it for
-- supplier evaluations.

alter table public.evaluations
  add column if not exists supplier_id uuid,
  add column if not exists data_quality text check (data_quality in ('complete', 'partial', 'insufficient')),
  add column if not exists missing_required_factor_keys jsonb not null default '[]'::jsonb;

alter table public.evaluations
  add constraint evaluations_supplier_fk
  foreign key (supplier_id, tenant_id) references public.suppliers (id, tenant_id);

create index if not exists idx_evaluations_supplier_id on public.evaluations (supplier_id);

-- The engine's EvaluationReason (apps/web/lib/domain/evaluation-reasons.ts)
-- carries a small, non-sensitive metadata record (factor key, normalized
-- score, weight share, or the final score — never a raw input value, per
-- that module's own contract) alongside each reason code. The existing
-- evaluation_reason_codes table only had room for weight_contribution;
-- this additive column keeps the rest so a completed evaluation's reason
-- codes stay fully explainable as immutable evidence, per docs/architecture/PLATFORM-ARCHITECTURE.md's
-- "Risk and audit invariants".
alter table public.evaluation_reason_codes
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Atomic, capability-checked, audited evaluation completion -----------------
-- Mirrors the RPC pattern in 20260913090000_auth_tenant_bootstrap.sql
-- (public.bootstrap_tenant et al.): the pure engine
-- (apps/web/lib/domain/evaluation-engine.ts) runs in the Node process, free
-- of any Supabase/network/clock dependency; this function is the one place
-- its result is persisted, so the completed evaluation row and its reason
-- codes either both exist or neither does — never a partial completed
-- state (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
-- acceptance criterion 6).
--
-- Idempotency (acceptance criterion 7): a second call with the same
-- (tenant_id, correlation_id) and the same input_hash returns the original,
-- already-persisted outcome untouched — no second row is ever inserted. A
-- second call with the same correlation_id but a *different* input_hash is
-- a genuine conflict (the caller's own idempotency key was not unique to
-- this request) and fails with a stable, typed error (sqlstate 23505)
-- rather than silently returning a result that does not match what was
-- asked for.
--
-- security invoker (not definer): the actual INSERTs below still go through
-- the evaluations/evaluation_reason_codes RLS policies as the calling user,
-- exactly as if they had called PostgREST directly. The explicit capability
-- check up front exists for a clean, early, typed error — RLS remains the
-- real enforcement boundary, per this task's "RLS is defense in depth, not
-- the only control."
create or replace function public.complete_supplier_evaluation(
  p_tenant_id uuid,
  p_supplier_id uuid,
  p_policy_version_id uuid,
  p_correlation_id uuid,
  p_input_hash text,
  p_normalized_input jsonb,
  p_score numeric,
  p_decision_band text,
  p_data_quality text,
  p_missing_required_factor_keys jsonb,
  p_reasons jsonb
) returns public.evaluations
language plpgsql
security invoker
as $$
declare
  v_existing public.evaluations;
  v_evaluation public.evaluations;
  v_supplier_reference text;
  v_reason jsonb;
begin
  -- security invoker means the calling role (authenticated) executes this
  -- body directly, and authenticated has no USAGE on schema app (see
  -- 20260912120150_authorization_helpers.sql's own comment on this exact
  -- point), so this must call the public.* PostgREST-facing wrappers, not
  -- app.* directly — the same convention public.bootstrap_tenant() and
  -- friends already follow in 20260913090000_auth_tenant_bootstrap.sql.
  if not (public.is_platform_admin() or public.has_capability(p_tenant_id, 'evaluation.run')) then
    raise exception 'Missing evaluation.run capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  if p_decision_band not in ('approve', 'review', 'reject') then
    raise exception 'Invalid decision band %', p_decision_band using errcode = '22023';
  end if;

  if p_data_quality not in ('complete', 'partial', 'insufficient') then
    raise exception 'Invalid data quality %', p_data_quality using errcode = '22023';
  end if;

  select * into v_existing
  from public.evaluations
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;

  if found then
    if v_existing.input_hash is distinct from p_input_hash then
      raise exception 'Correlation id % was already used with different evaluation input for tenant %',
        p_correlation_id, p_tenant_id
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  select reference into v_supplier_reference
  from public.suppliers
  where id = p_supplier_id and tenant_id = p_tenant_id;

  if v_supplier_reference is null then
    raise exception 'Supplier % not found in tenant %', p_supplier_id, p_tenant_id using errcode = 'P0002';
  end if;

  -- Inserted as 'pending' first, not 'completed': the reason-codes guard
  -- trigger (app.forbid_reason_code_mutation_after_completion(), in
  -- 20260912120300_evaluation.sql) rejects any insert into
  -- evaluation_reason_codes once its parent evaluation's status is already
  -- 'completed' or 'failed'. Reason codes are written below while the row
  -- is still 'pending', then the row is flipped to 'completed' as the last
  -- step; the evaluations immutability trigger only starts rejecting
  -- updates once old.status is already 'completed'/'failed', so this final
  -- transition is allowed. All of this runs inside the single implicit
  -- transaction of this function call: any exception anywhere above rolls
  -- back every step, so a partial ('pending' forever, or completed with no
  -- reason codes) evaluation can never be observed by another session.
  insert into public.evaluations (
    tenant_id, supplier_id, policy_version_id, subject_reference, input_hash,
    normalized_input, score, decision_band, status, correlation_id,
    actor_id, actor_type, data_quality, missing_required_factor_keys
  ) values (
    p_tenant_id, p_supplier_id, p_policy_version_id, v_supplier_reference, p_input_hash,
    p_normalized_input, p_score, p_decision_band, 'pending', p_correlation_id,
    auth.uid(), 'user', p_data_quality, p_missing_required_factor_keys
  )
  returning * into v_evaluation;

  for v_reason in select * from jsonb_array_elements(coalesce(p_reasons, '[]'::jsonb))
  loop
    insert into public.evaluation_reason_codes (tenant_id, evaluation_id, code, description, weight_contribution, metadata)
    values (
      p_tenant_id,
      v_evaluation.id,
      v_reason ->> 'code',
      v_reason ->> 'description',
      nullif(v_reason -> 'metadata' ->> 'weightShare', '')::numeric,
      coalesce(v_reason -> 'metadata', '{}'::jsonb)
    );
  end loop;

  update public.evaluations
  set status = 'completed', completed_at = now()
  where id = v_evaluation.id
  returning * into v_evaluation;

  perform public.record_audit_event(
    p_tenant_id, 'evaluation.completed', 'evaluation', v_evaluation.id::text, p_correlation_id,
    jsonb_build_object(
      'supplier_id', p_supplier_id,
      'policy_version_id', p_policy_version_id,
      'decision_band', p_decision_band,
      'data_quality', p_data_quality
    )
  );

  return v_evaluation;
end;
$$;

comment on function public.complete_supplier_evaluation(uuid, uuid, uuid, uuid, text, jsonb, numeric, text, text, jsonb, jsonb) is
  'Atomically persists one completed supplier evaluation and its reason codes, replays an identical prior correlation id, and rejects a reused correlation id whose input differs. Never leaves a partial completed evaluation.';

revoke all on function public.complete_supplier_evaluation(uuid, uuid, uuid, uuid, text, jsonb, numeric, text, text, jsonb, jsonb) from public;
grant execute on function public.complete_supplier_evaluation(uuid, uuid, uuid, uuid, text, jsonb, numeric, text, text, jsonb, jsonb) to authenticated;

-- Rollback: drop function public.complete_supplier_evaluation(...); drop
-- index idx_evaluations_supplier_id; drop constraint
-- evaluations_supplier_fk; drop columns missing_required_factor_keys,
-- data_quality, supplier_id from public.evaluations. No data migration is
-- required because every added column is nullable or defaulted.

-- TASK-028: close the platform-admin operational bypass on every remaining
-- tenant-operational surface, and make policy publication order-of-truth
-- tamper-proof. Closes probe G from the TASK-026 independent review
-- (docs/orquestracao/REVIEW-TASK-026.md): a platform administrator with no
-- tenant membership created a draft policy, added a single 0-100 "approve"
-- factor/threshold, and published it; the tenant's next evaluation then used
-- that policy. docs/tasks/TASK-028-claude-platform-admin-operational-boundary.md
-- has the full inventory, classification, and before/after for every policy
-- touched here.
--
-- Human decisions approved 2026-09-22 (Edu):
--   D4 - policy_versions, policy_factors, policy_thresholds, cases,
--        case_evidence, case_decisions (select), api_clients,
--        webhook_endpoints, webhook_deliveries, notification_templates and
--        notification_requests move to app.has_tenant_capability_as_member(),
--        with no platform bypass at all (D1 + D2 apply transitively, since
--        that helper already excludes platform admins and suspended
--        tenants -- 20260922130000_uniform_tenant_authorization.sql).
--   D5 - platform governance (tenants, memberships via the existing RPCs,
--        the roles/capabilities/role_capabilities catalogs, platform_admins)
--        keeps its bypass, expressed only through a new, named helper,
--        app.is_platform_governance_actor() -- a thin wrapper around
--        app.is_platform_admin() -- so every remaining bypass is one grep
--        away.
--   D6 - audit_events select: a platform admin reads only tenant_id is null
--        (platform-level) events; tenant members keep audit.view through the
--        member-only helper, exactly as every other D4 surface.
--
-- Documentation errata (item 5, not a migration change -- applied migrations
-- are immutable): the header of 20260914120200_supplier_evaluation.sql and
-- the header/comments of 20260922130000_uniform_tenant_authorization.sql
-- both name apps/web/lib/domain/supplier-evaluation-adapter.ts as the
-- TypeScript reference the SQL fact-derivation mirrors. That file does not
-- exist in this repository (verified: apps/web/lib/domain/ has
-- evaluation-engine.ts, evaluation-engine-errors.ts, supplier.ts,
-- supplier-evidence.ts, supplier-final-decision.ts, but no
-- supplier-evaluation-adapter.ts). Recorded here and in the TASK-028
-- handoff; neither migration is edited.

-- 1. D5: app.is_platform_governance_actor() -----------------------------------
-- Thin, named wrapper around app.is_platform_admin(). Identical truth value;
-- its only purpose is that grep -rn 'app.is_platform_admin()' in RLS should
-- turn up nothing outside this function and the explicit D1/D2 *denial*
-- checks already approved in TASK-025/026 (app.has_tenant_capability_as_member,
-- app.is_active_tenant_admin, public.can_record_supplier_final_decision,
-- public.record_supplier_final_decision, supplier_final_decisions_select --
-- those exclude a platform admin, they are not a bypass, so they keep
-- calling app.is_platform_admin() directly, per the TASK-028 handoff's
-- inventory).

create or replace function app.is_platform_governance_actor()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select app.is_platform_admin();
$$;

comment on function app.is_platform_governance_actor() is
  'TASK-028 D5: named bypass for platform governance surfaces only (tenants, memberships, the roles/capabilities/role_capabilities catalogs, platform_admins). A thin wrapper around app.is_platform_admin() with the same truth value; every RLS policy that legitimately still grants a platform administrator a bypass calls this, not app.is_platform_admin() directly, so grep -rn "app.is_platform_admin()" supabase/migrations finds only this function, the D6 audit_events_select policy, and the explicit D1/D2 denial checks in the supplier/evaluation authorization helpers.';

revoke all on function app.is_platform_governance_actor() from public;
grant execute on function app.is_platform_governance_actor() to authenticated;

-- 2. D5 policies: tenants, memberships, platform_admins -----------------------
-- Same authorization shape as before (platform admin OR the relevant tenant
-- capability), only the bypass call site is renamed. No behavior change for
-- any legitimate caller.

drop policy platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins
  for select to authenticated using (app.is_platform_governance_actor());

drop policy tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select to authenticated using (
    app.is_platform_governance_actor() or id in (select app.current_tenant_ids())
  );

drop policy tenants_insert on public.tenants;
create policy tenants_insert on public.tenants
  for insert to authenticated with check (app.is_platform_governance_actor());

drop policy tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update to authenticated
  using (app.is_platform_governance_actor() or app.has_capability(id, 'tenant.manage_settings'))
  with check (app.is_platform_governance_actor() or app.has_capability(id, 'tenant.manage_settings'));

drop policy memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated using (
    app.is_platform_governance_actor()
    or user_id = auth.uid()
    or app.has_capability(tenant_id, 'tenant.view')
  );

drop policy memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated with check (
    (app.is_platform_governance_actor() or app.has_capability(tenant_id, 'tenant.manage_members'))
    and (invited_by is null or invited_by = auth.uid())
  );

drop policy memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update to authenticated
  using (
    app.is_platform_governance_actor()
    or app.has_capability(tenant_id, 'tenant.manage_members')
    or (user_id = auth.uid() and status = 'invited')
  )
  with check (
    app.is_platform_governance_actor()
    or app.has_capability(tenant_id, 'tenant.manage_members')
    or (user_id = auth.uid())
  );

-- The membership transition guard trigger backs the same D5 write surface
-- (it decides *what shape* of change memberships_update's RLS-approved
-- caller may make); its is_admin check moves to the same named helper.
create or replace function app.guard_membership_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_admin boolean;
  v_is_self boolean;
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.user_id is distinct from old.user_id
     or new.invited_by is distinct from old.invited_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Membership identity and invitation provenance cannot be changed'
      using errcode = '23001';
  end if;

  v_is_admin := app.is_platform_governance_actor() or app.has_capability(old.tenant_id, 'tenant.manage_members');
  v_is_self := auth.uid() = old.user_id;

  if new.role_key is distinct from old.role_key and not v_is_admin then
    raise exception 'Only tenant.manage_members can change a membership role'
      using errcode = '23001';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'invited' and new.status = 'active' then
      if not (v_is_admin or v_is_self) then
        raise exception 'Only the invited user or tenant.manage_members can activate this membership'
          using errcode = '23001';
      end if;
      if v_is_self and new.role_key is distinct from old.role_key then
        raise exception 'Accepting an invitation cannot also change its role'
          using errcode = '23001';
      end if;
    else
      if not v_is_admin then
        raise exception 'Only tenant.manage_members can change membership status from % to %', old.status, new.status
          using errcode = '23001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- 3. D4 policies: policy_versions, policy_factors, policy_thresholds ---------

drop policy policy_versions_select on public.policy_versions;
create policy policy_versions_select on public.policy_versions
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'policy.view')
  );

drop policy policy_versions_insert on public.policy_versions;
create policy policy_versions_insert on public.policy_versions
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'policy.manage')
  );

drop policy policy_versions_update on public.policy_versions;
create policy policy_versions_update on public.policy_versions
  for update to authenticated
  using (app.has_tenant_capability_as_member(tenant_id, 'policy.manage'))
  with check (
    app.has_tenant_capability_as_member(tenant_id, 'policy.manage')
    and (status is distinct from 'published' or app.has_tenant_capability_as_member(tenant_id, 'policy.publish'))
  );

drop policy policy_versions_delete on public.policy_versions;
create policy policy_versions_delete on public.policy_versions
  for delete to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'policy.manage')
  );

drop policy policy_factors_select on public.policy_factors;
create policy policy_factors_select on public.policy_factors
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'policy.view')
  );

drop policy policy_factors_write on public.policy_factors;
create policy policy_factors_write on public.policy_factors
  for all to authenticated
  using (app.has_tenant_capability_as_member(tenant_id, 'policy.manage'))
  with check (app.has_tenant_capability_as_member(tenant_id, 'policy.manage'));

drop policy policy_thresholds_select on public.policy_thresholds;
create policy policy_thresholds_select on public.policy_thresholds
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'policy.view')
  );

drop policy policy_thresholds_write on public.policy_thresholds;
create policy policy_thresholds_write on public.policy_thresholds
  for all to authenticated
  using (app.has_tenant_capability_as_member(tenant_id, 'policy.manage'))
  with check (app.has_tenant_capability_as_member(tenant_id, 'policy.manage'));

-- 3b. Side effect of 3, found while writing 070-platform-admin-operational-boundary.sql:
-- app.forbid_children_when_not_draft() (live version in
-- 20260912120800_security_and_english_first_hardening.sql) is security
-- INVOKER. It looks up its parent policy_versions row's status with a
-- plain SELECT, which is now subject to the *narrower* policy_versions_select
-- from section 3 above. A caller correctly denied policy.view on that
-- tenant (a platform admin with no membership, or -- this was already
-- latently true before this task, just never exercised by an existing
-- test -- any other outsider with no policy.view capability there either)
-- gets zero rows back, so `v_status` stays null, `null is distinct from
-- 'draft'` is true, and the trigger raises its own "not draft" 23001
-- instead of the INSERT ever reaching policy_factors_write/
-- policy_thresholds_write's 42501 denial. The caller is still correctly
-- denied either way -- this is not a privilege escalation -- but the
-- SQLSTATE is wrong. Made security definer, the same fix this codebase
-- already applies everywhere else a trigger needs to see a row regardless
-- of the calling role's own RLS visibility (e.g.
-- app.enforce_evaluation_policy_and_identity() in the same source
-- migration). Body otherwise unchanged.

create or replace function app.forbid_children_when_not_draft()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if tg_op <> 'INSERT' then
    select status into v_status
    from public.policy_versions
    where id = old.policy_version_id and tenant_id = old.tenant_id;

    if v_status is distinct from 'draft' then
      raise exception 'Cannot modify % once the original policy version is not draft', tg_table_name
        using errcode = '23001';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    select status into v_status
    from public.policy_versions
    where id = new.policy_version_id and tenant_id = new.tenant_id;

    if v_status is distinct from 'draft' then
      raise exception 'Cannot attach % to a policy version that is not draft', tg_table_name
        using errcode = '23001';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- 4. D4 policies: cases, case_evidence, case_decisions (select only; insert
-- was already fixed by 20260914120300_case_decisions_tenant_admin_only.sql,
-- which uses app.is_active_tenant_admin() with no capability route and no
-- platform-admin bypass, so it is unaffected here) --------------------------

drop policy cases_select on public.cases;
create policy cases_select on public.cases
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'case.view')
  );

drop policy cases_insert on public.cases;
create policy cases_insert on public.cases
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'case.manage')
    and opened_by = auth.uid()
  );

drop policy cases_update on public.cases;
create policy cases_update on public.cases
  for update to authenticated
  using (app.has_tenant_capability_as_member(tenant_id, 'case.manage'))
  with check (app.has_tenant_capability_as_member(tenant_id, 'case.manage'));

drop policy case_evidence_select on public.case_evidence;
create policy case_evidence_select on public.case_evidence
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'case.view')
  );

drop policy case_evidence_insert on public.case_evidence;
create policy case_evidence_insert on public.case_evidence
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'case.manage')
    and uploaded_by = auth.uid()
  );

drop policy case_decisions_select on public.case_decisions;
create policy case_decisions_select on public.case_decisions
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'case.view')
  );

-- 5. D4 policies: api_clients, webhook_endpoints, webhook_deliveries --------
-- webhook_deliveries_update and notification_requests_update do not exist
-- (dropped by 20260912120800_security_and_english_first_hardening.sql with
-- no replacement -- delivery/request history is retained, worker-only, not
-- client-writable at all); nothing to rewrite there.

drop policy api_clients_select on public.api_clients;
create policy api_clients_select on public.api_clients
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'integration.view')
  );

drop policy api_clients_insert on public.api_clients;
create policy api_clients_insert on public.api_clients
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'integration.manage')
    and created_by = auth.uid()
  );

drop policy api_clients_update on public.api_clients;
create policy api_clients_update on public.api_clients
  for update to authenticated
  using (app.has_tenant_capability_as_member(tenant_id, 'integration.manage'))
  with check (app.has_tenant_capability_as_member(tenant_id, 'integration.manage'));

drop policy webhook_endpoints_select on public.webhook_endpoints;
create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'integration.view')
  );

drop policy webhook_endpoints_insert on public.webhook_endpoints;
create policy webhook_endpoints_insert on public.webhook_endpoints
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'integration.manage')
    and created_by = auth.uid()
  );

drop policy webhook_endpoints_update on public.webhook_endpoints;
create policy webhook_endpoints_update on public.webhook_endpoints
  for update to authenticated
  using (app.has_tenant_capability_as_member(tenant_id, 'integration.manage'))
  with check (app.has_tenant_capability_as_member(tenant_id, 'integration.manage'));

drop policy webhook_deliveries_select on public.webhook_deliveries;
create policy webhook_deliveries_select on public.webhook_deliveries
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'integration.view')
  );

drop policy webhook_deliveries_insert on public.webhook_deliveries;
create policy webhook_deliveries_insert on public.webhook_deliveries
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'integration.manage')
  );

-- 6. D4 + D5 (mixed): notification_templates, notification_requests --------
-- notification_templates.tenant_id is nullable by design: a null-tenant row
-- is a platform-wide template, not tenant-owned data (table comment,
-- 20260912120600_notifications.sql). Its select policy's `tenant_id is
-- null` branch was already unconditionally open to any authenticated
-- caller -- not an app.is_platform_admin() bypass in any meaningful sense,
-- since it never checked platform-admin status at all -- so it is left
-- exactly as it was; only the tenant-owned branch's platform-admin bypass
-- (the redundant standalone `app.is_platform_admin()` disjunct) is removed,
-- in favor of the member-only helper. The write policies (insert/update)
-- already split cleanly: their `tenant_id is null` branch gates platform-
-- template management behind app.is_platform_admin() specifically (D5 --
-- managing platform-wide content is platform governance), and their
-- `tenant_id is not null` branch gates tenant-owned templates behind
-- app.has_capability (D4).

drop policy notification_templates_select on public.notification_templates;
create policy notification_templates_select on public.notification_templates
  for select to authenticated using (
    tenant_id is null
    or app.has_tenant_capability_as_member(tenant_id, 'notification.view')
  );

drop policy notification_templates_insert on public.notification_templates;
create policy notification_templates_insert on public.notification_templates
  for insert to authenticated with check (
    (
      (tenant_id is null and app.is_platform_governance_actor())
      or (tenant_id is not null and app.has_tenant_capability_as_member(tenant_id, 'notification.manage'))
    )
    and created_by = auth.uid()
  );

drop policy notification_templates_update on public.notification_templates;
create policy notification_templates_update on public.notification_templates
  for update to authenticated
  using (
    (tenant_id is null and app.is_platform_governance_actor())
    or (tenant_id is not null and app.has_tenant_capability_as_member(tenant_id, 'notification.manage'))
  )
  with check (
    (tenant_id is null and app.is_platform_governance_actor())
    or (tenant_id is not null and app.has_tenant_capability_as_member(tenant_id, 'notification.manage'))
  );

drop policy notification_requests_select on public.notification_requests;
create policy notification_requests_select on public.notification_requests
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'notification.view')
  );

drop policy notification_requests_insert on public.notification_requests;
create policy notification_requests_insert on public.notification_requests
  for insert to authenticated with check (
    app.has_tenant_capability_as_member(tenant_id, 'notification.manage')
  );

-- 7. D6: audit_events select --------------------------------------------------
-- A platform admin reads only platform-level events (tenant_id is null).
-- Tenant members keep audit.view, now through the same member-only helper
-- every other D4 surface uses (no platform-admin bypass on tenant-owned
-- audit evidence either).
--
-- Flagged, not implemented (TASK-028 item 1's "stop and report" clause):
-- public.record_audit_event()'s WRITE path (20260912120800_security_and_english_first_hardening.sql)
-- still allows a platform administrator to write an audit event into ANY
-- tenant, with no membership, on both its tenant_id-is-null and
-- tenant_id-is-not-null branches. Neither D4's table list, D5's list
-- (tenants/memberships/catalogs/platform_admins), nor D6's decision text
-- (which names only the "select" policy) names this write surface, and
-- applied migrations are immutable, so it is deliberately left unchanged
-- here and reported in the TASK-028 handoff as a candidate for a follow-up
-- task, the same way probe G itself became this task.

drop policy audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
  for select to authenticated using (
    (tenant_id is null and app.is_platform_governance_actor())
    or (tenant_id is not null and app.has_tenant_capability_as_member(tenant_id, 'audit.view'))
  );

-- 8. Publication integrity: published_at/published_by cannot be forged -------
-- A future-dated (or otherwise caller-chosen) published_at let anyone who
-- could publish a policy also control whether it becomes the tenant's
-- "current" one (public.run_supplier_evaluation orders by published_at
-- desc). This trigger fires whenever a row's status becomes 'published'
-- (on INSERT directly as published, or on UPDATE transitioning into it) and
-- forces published_at = now(). published_by is forced to auth.uid() only
-- when auth.uid() is not null, so the dev seed -- which publishes as the
-- connecting superuser with no request.jwt.claim.sub set, and passes its
-- own explicit published_by (supabase/seed.sql) -- is unaffected. This does
-- not run on the published -> archived transition (old.status is already
-- 'published' there, so the trigger's own condition is false), so it never
-- conflicts with app.forbid_published_policy_version_mutation's stricter
-- "no other column changes" check for that transition.

create or replace function app.enforce_policy_publication_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
    if auth.uid() is not null then
      new.published_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_policy_versions_publication_integrity
  before insert or update on public.policy_versions
  for each row execute function app.enforce_policy_publication_integrity();

-- 9. run_supplier_evaluation: consistent SQLSTATE on a non-numeric min/max --
-- Full function replace (the prior version is
-- 20260922130000_uniform_tenant_authorization.sql, unmodified there).
-- Behavior change: a factor whose config->>'min' or config->>'max' is not a
-- plain numeric literal now fails the same way every other structural
-- defect does -- SQLSTATE 22023, before any computation -- instead of
-- 22P02 (invalid_text_representation) from an uncaught numeric cast deep in
-- the scoring loop. The guard is rewritten from a single SQL EXISTS
-- expression (whose OR-chain evaluation order is not guaranteed by
-- PostgreSQL, so a numeric cast could still be attempted before a numeric
-- format check ahead of it in the same expression) into an explicit
-- PL/pgSQL loop, which evaluates each check in the written order for every
-- factor: weight, direction, presence, numeric shape (regex, before any
-- cast), then min < max. Every other part of the function (authorization,
-- fact derivation, deterministic created_at-then-key factor order, the
-- advisory lock, idempotent replay) is unchanged from
-- 20260922130000_uniform_tenant_authorization.sql.

create or replace function public.run_supplier_evaluation(
  p_tenant_id uuid,
  p_supplier_id uuid,
  p_correlation_id uuid
) returns public.evaluations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.evaluations;
  v_evaluation public.evaluations;
  v_supplier_reference text;
  v_policy_version_id uuid;
  v_thresholds_valid boolean;
  v_facts jsonb;
  v_factor record;
  v_raw numeric;
  v_min numeric;
  v_max numeric;
  v_direction text;
  v_required boolean;
  v_normalized numeric;
  v_weight numeric;
  v_weighted_sum numeric := 0;
  v_total_weight numeric := 0;
  v_score numeric;
  v_threshold record;
  v_decision_band text;
  v_missing_keys jsonb := '[]'::jsonb;
  v_required_count int := 0;
  v_missing_required_count int := 0;
  v_data_quality text;
  v_reasons jsonb := '[]'::jsonb;
  v_weight_share numeric;
  v_input_hash text;
  v_numeric_shape constant text := '^-?[0-9]+(\.[0-9]+)?$';
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'evaluation.run') then
    raise exception 'Missing evaluation.run capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  select reference into v_supplier_reference
  from public.suppliers
  where id = p_supplier_id and tenant_id = p_tenant_id;

  if v_supplier_reference is null then
    raise exception 'Supplier % not found in tenant %', p_supplier_id, p_tenant_id using errcode = 'P0002';
  end if;

  select id into v_policy_version_id
  from public.policy_versions
  where tenant_id = p_tenant_id and status = 'published'
  order by published_at desc
  limit 1;

  if v_policy_version_id is null then
    -- Reuses the plpgsql-reserved P0003 condition name for a second,
    -- distinct "no matching row" case in this function; distinguished from
    -- supplier-not-found (P0002) by errcode alone, matching this
    -- codebase's existing convention of mapping errors by SQLSTATE, not
    -- message text (apps/web/lib/supabase/*-repository.ts).
    raise exception 'Tenant % has no published policy version' , p_tenant_id using errcode = 'P0003';
  end if;

  -- Policy validation guard: every structural defect is checked, in this
  -- explicit order, before any fact derivation, scoring, or write, so an
  -- invalid published policy always fails closed with SQLSTATE 22023 and
  -- leaves no partial evaluation or audit row behind. A PL/pgSQL loop (not
  -- a single SQL boolean expression) is used specifically so the numeric-
  -- shape regex check always runs, and always fails closed with 22023,
  -- before any ::numeric cast is attempted on the same value.
  for v_factor in
    select key, weight, config
    from public.policy_factors
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
  loop
    if v_factor.weight <= 0 then
      raise exception 'Published policy % for tenant % has an invalid factor configuration', v_policy_version_id, p_tenant_id
        using errcode = '22023';
    end if;

    if v_factor.config ->> 'direction' is null
       or v_factor.config ->> 'direction' not in ('higher_is_riskier', 'lower_is_riskier')
    then
      raise exception 'Published policy % for tenant % has an invalid factor configuration', v_policy_version_id, p_tenant_id
        using errcode = '22023';
    end if;

    if v_factor.config ->> 'min' is null or v_factor.config ->> 'max' is null then
      raise exception 'Published policy % for tenant % has an invalid factor configuration', v_policy_version_id, p_tenant_id
        using errcode = '22023';
    end if;

    if v_factor.config ->> 'min' !~ v_numeric_shape or v_factor.config ->> 'max' !~ v_numeric_shape then
      raise exception 'Published policy % for tenant % has an invalid factor configuration', v_policy_version_id, p_tenant_id
        using errcode = '22023';
    end if;

    if (v_factor.config ->> 'min')::numeric >= (v_factor.config ->> 'max')::numeric then
      raise exception 'Published policy % for tenant % has an invalid factor configuration', v_policy_version_id, p_tenant_id
        using errcode = '22023';
    end if;
  end loop;

  -- Thresholds must cover [0, 100] with no gap and no overlap: ordered by
  -- min_score, the first row starts at 0, the last row ends at 100, and
  -- every row's min_score equals the previous row's max_score. A policy
  -- with zero thresholds fails closed too (bool_and() over zero rows is
  -- null, and `is not true` catches null). min_score/max_score are typed
  -- numeric table columns, not jsonb text, so there is no cast-order
  -- concern here.
  select
    min(min_score) = 0
    and max(max_score) = 100
    and bool_and(rn = 1 or prev_max_score = min_score)
  into v_thresholds_valid
  from (
    select
      min_score, max_score,
      row_number() over (order by min_score) as rn,
      lag(max_score) over (order by min_score) as prev_max_score
    from public.policy_thresholds
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
  ) t;

  if v_thresholds_valid is not true then
    raise exception 'Published policy % for tenant % has invalid or non-contiguous decision thresholds', v_policy_version_id, p_tenant_id
      using errcode = '22023';
  end if;

  -- Facts are re-derived from persisted data on every call, including a
  -- replay: this function never trusts a caller-supplied fact, score, or
  -- reason. See app.derive_supplier_evaluation_facts() (defined in
  -- 20260914120200_supplier_evaluation.sql; unmodified here).
  v_facts := app.derive_supplier_evaluation_facts(p_tenant_id, p_supplier_id);

  -- Pass 1: total weight and required-factor count only. weightShare
  -- (weight / total_weight, matching roundShare() in
  -- apps/web/lib/domain/evaluation-reasons.ts) cannot be computed per
  -- factor until the total is known, so this is a genuine two-pass
  -- computation, not an arbitrary restructuring.
  for v_factor in
    select weight, config
    from public.policy_factors
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
  loop
    v_total_weight := v_total_weight + v_factor.weight;
    if (v_factor.config ->> 'required')::boolean then
      v_required_count := v_required_count + 1;
    end if;
  end loop;

  if v_total_weight <= 0 then
    raise exception 'Published policy % for tenant % has no usable factors', v_policy_version_id, p_tenant_id using errcode = '22023';
  end if;

  -- Pass 2: per-factor normalization, weighted sum, and reason codes.
  -- Ordering contract (TASK-026 item 4): `order by created_at, key` --
  -- created_at alone is not deterministic when a policy's factors were
  -- seeded or migrated in one batch and share the same timestamp. This is
  -- the same order the TS reference engine
  -- (apps/web/lib/domain/evaluation-engine.ts) iterates policy.factors in.
  for v_factor in
    select key, weight, config
    from public.policy_factors
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
    order by created_at, key
  loop
    v_min := (v_factor.config ->> 'min')::numeric;
    v_max := (v_factor.config ->> 'max')::numeric;
    v_direction := v_factor.config ->> 'direction';
    v_required := (v_factor.config ->> 'required')::boolean;
    v_weight := v_factor.weight;
    v_weight_share := round(v_weight / v_total_weight, 4);

    if not (v_facts ? v_factor.key) then
      -- Absent fact: NEUTRAL_FACTOR_SCORE (apps/web/lib/domain/evaluation-scoring.ts),
      -- and — for a required factor — counted toward data quality and
      -- named in missing_required_factor_keys, exactly as the TS engine does.
      v_normalized := 50;
      if v_required then
        v_missing_required_count := v_missing_required_count + 1;
        v_missing_keys := v_missing_keys || to_jsonb(v_factor.key);
      end if;
      v_reasons := v_reasons || jsonb_build_object(
        'code', 'FACTOR_INPUT_MISSING',
        'description', 'No input was supplied for this factor; a neutral default score was used.',
        'metadata', jsonb_build_object(
          'factorKey', v_factor.key, 'required', v_required, 'neutralScore', 50, 'weightShare', v_weight_share
        )
      );
    else
      v_raw := (v_facts ->> v_factor.key)::numeric;
      v_normalized := case v_direction
        when 'higher_is_riskier' then (least(greatest(v_raw, v_min), v_max) - v_min) / (v_max - v_min) * 100
        else (1 - (least(greatest(v_raw, v_min), v_max) - v_min) / (v_max - v_min)) * 100
      end;
      v_reasons := v_reasons || jsonb_build_object(
        'code', case
          when v_normalized < 30 then 'FACTOR_LOW_RISK_CONTRIBUTION'
          when v_normalized >= 70 then 'FACTOR_HIGH_RISK_CONTRIBUTION'
          else 'FACTOR_MODERATE_RISK_CONTRIBUTION'
        end,
        'description', 'This factor''s normalized score contributed to the overall risk score.',
        'metadata', jsonb_build_object('factorKey', v_factor.key, 'normalizedScore', v_normalized, 'weightShare', v_weight_share)
      );
    end if;

    v_weighted_sum := v_weighted_sum + v_normalized * v_weight;
  end loop;

  v_score := round(v_weighted_sum / v_total_weight, 2);

  -- resolveBand() semantics (apps/web/lib/domain/evaluation-scoring.ts):
  -- [min, max) for every threshold except the one holding the overall
  -- maximum max_score, which is also max-inclusive.
  for v_threshold in
    select min_score, max_score, decision_band,
           max_score = max(max_score) over () as is_last
    from public.policy_thresholds
    where tenant_id = p_tenant_id and policy_version_id = v_policy_version_id
    order by min_score asc
  loop
    if v_score >= v_threshold.min_score and (v_score < v_threshold.max_score or v_threshold.is_last) then
      v_decision_band := v_threshold.decision_band;
      exit;
    end if;
  end loop;

  if v_decision_band is null then
    raise exception 'Score % is not covered by any threshold in policy % for tenant %', v_score, v_policy_version_id, p_tenant_id
      using errcode = '22023';
  end if;

  v_data_quality := case
    when v_required_count = 0 or v_missing_required_count = 0 then 'complete'
    when v_missing_required_count = v_required_count then 'insufficient'
    else 'partial'
  end;

  v_reasons := v_reasons || jsonb_build_object(
    'code', case v_decision_band
      when 'approve' then 'RECOMMENDATION_APPROVE'
      when 'review' then 'RECOMMENDATION_REVIEW'
      else 'RECOMMENDATION_REJECT'
    end,
    'description', 'Overall score resolved to this policy recommendation band.',
    'metadata', jsonb_build_object('score', v_score)
  );

  v_input_hash := encode(
    digest(v_policy_version_id::text || '|' || p_supplier_id::text || '|' || v_facts::text, 'sha256'),
    'hex'
  );

  -- Advisory lock on (tenant_id, correlation_id): taken before the
  -- replay/conflict check below so two concurrent calls with the same
  -- correlation id are serialized and resolve idempotently. Namespaced
  -- with a distinct second argument (1) from
  -- public.record_supplier_final_decision()'s advisory lock (0) on a
  -- different key shape, so the two lock domains cannot collide.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_correlation_id::text, 1));

  select * into v_existing
  from public.evaluations
  where tenant_id = p_tenant_id and correlation_id = p_correlation_id;

  if found then
    if v_existing.input_hash is distinct from v_input_hash then
      raise exception 'Correlation id % was already used with different evaluation input for tenant %',
        p_correlation_id, p_tenant_id
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  -- Inserted as 'pending' first, not 'completed': the reason-codes guard
  -- trigger (app.forbid_reason_code_mutation_after_completion(), in
  -- 20260912120300_evaluation.sql) rejects any insert into
  -- evaluation_reason_codes once its parent evaluation's status is already
  -- 'completed' or 'failed'. All of this runs inside the single implicit
  -- transaction of this function call: any exception anywhere above rolls
  -- back every step, so a partial evaluation can never be observed by
  -- another session.
  insert into public.evaluations (
    tenant_id, supplier_id, policy_version_id, subject_reference, input_hash,
    normalized_input, score, decision_band, status, correlation_id,
    actor_id, actor_type, data_quality, missing_required_factor_keys
  ) values (
    p_tenant_id, p_supplier_id, v_policy_version_id, v_supplier_reference, v_input_hash,
    v_facts, v_score, v_decision_band, 'pending', p_correlation_id,
    auth.uid(), 'user', v_data_quality, v_missing_keys
  )
  returning * into v_evaluation;

  insert into public.evaluation_reason_codes (tenant_id, evaluation_id, code, description, weight_contribution, metadata)
  select
    p_tenant_id,
    v_evaluation.id,
    r ->> 'code',
    r ->> 'description',
    nullif(r -> 'metadata' ->> 'weightShare', '')::numeric,
    coalesce(r -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(v_reasons) as r;

  update public.evaluations
  set status = 'completed', completed_at = now()
  where id = v_evaluation.id
  returning * into v_evaluation;

  perform public.record_audit_event(
    p_tenant_id, 'evaluation.completed', 'evaluation', v_evaluation.id::text, p_correlation_id,
    jsonb_build_object(
      'supplier_id', p_supplier_id,
      'policy_version_id', v_policy_version_id,
      'decision_band', v_decision_band,
      'data_quality', v_data_quality
    )
  );

  return v_evaluation;
end;
$$;

comment on function public.run_supplier_evaluation(uuid, uuid, uuid) is
  'The only path to run a supplier evaluation. Security definer; checks evaluation.run via app.has_tenant_capability_as_member() (no platform-admin bypass, no dual-role exception, denied in a non-active tenant); validates the published policy''s factors (weight, direction, numeric min/max shape checked by regex before any cast, min < max) and thresholds before any computation and fails closed with SQLSTATE 22023 on any structural defect, including a non-numeric min/max (TASK-028 item 4); looks up the tenant''s own current published policy (published_at is now tamper-proof -- see app.enforce_policy_publication_integrity()) and re-derives all facts from persisted supplier/evidence rows in a deterministic (created_at, key) factor order; computes score, recommendation, data quality, and reason codes itself; serializes concurrent replays of the same correlation id with an advisory lock; persists atomically with a mandatory audit event. Accepts no engine output of any kind from the caller — only identifying references.';

revoke all on function public.run_supplier_evaluation(uuid, uuid, uuid) from public;
grant execute on function public.run_supplier_evaluation(uuid, uuid, uuid) to authenticated;

-- Rollback: this migration only creates one new function
-- (app.is_platform_governance_actor(), plus the new
-- app.enforce_policy_publication_integrity() trigger function and its
-- trigger) and redefines existing functions/policies (CREATE OR REPLACE
-- FUNCTION; DROP POLICY + CREATE POLICY on unchanged tables); no table,
-- column, or data is added, removed, or migrated. Restoring the prior
-- behavior means: dropping trg_policy_versions_publication_integrity and
-- app.enforce_policy_publication_integrity(); dropping
-- app.is_platform_governance_actor(); and re-applying the exact prior
-- function and policy bodies from 20260912120160_identity_and_tenancy_rls.sql,
-- 20260913090000_auth_tenant_bootstrap.sql, 20260912120200_risk_policy.sql,
-- 20260912120400_cases.sql, 20260912120800_security_and_english_first_hardening.sql,
-- 20260912120500_integrations.sql, 20260912120600_notifications.sql,
-- 20260912120700_audit.sql, and 20260922130000_uniform_tenant_authorization.sql.

-- TASK-023 security correction: a case decision is Company Admin authority
-- specifically (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
-- "Human-approved product decisions": "Only the Company Admin records the
-- final business decision. A recommendation must never become a final
-- decision automatically."), not a generic case.decide-capability route
-- and never a platform-admin bypass.
--
-- The prior policy (case_decisions_insert, most recently redefined in
-- 20260912120800_security_and_english_first_hardening.sql) allowed
-- app.is_platform_admin() or app.has_capability(tenant_id, 'case.decide') —
-- i.e. any role a future seed grants case.decide to, or any platform
-- admin, could record a decision. TASK-023 already removed risk_analyst's
-- case.decide grant (20260914120000_supplier_evaluation_capabilities.sql)
-- to fix the immediate contradiction, but the policy itself still allowed
-- a bypass and a generic capability route. This closes both: only an
-- active tenant_admin membership in the same tenant, decided_by pinned to
-- auth.uid(), may insert a case decision — using
-- app.is_active_tenant_admin() (20260914120050_no_bypass_authorization_helpers.sql),
-- which has no platform-admin branch at all.

drop policy case_decisions_insert on public.case_decisions;

create policy case_decisions_insert on public.case_decisions
  for insert to authenticated with check (
    app.is_active_tenant_admin(tenant_id)
    and decided_by = auth.uid()
  );

-- No update/delete policy either before or after this change: case
-- decisions remain append-only (app.forbid_mutation() trigger,
-- 20260912120400_cases.sql), and select is unchanged — auditors/read-only
-- roles must still be able to see a recorded decision even though only
-- tenant_admin can create one.

-- Rollback: drop policy case_decisions_insert; recreate it as
-- `for insert to authenticated with check ((app.is_platform_admin() or
-- app.has_capability(tenant_id, 'case.decide')) and decided_by = auth.uid())`,
-- the definition from 20260912120800_security_and_english_first_hardening.sql.

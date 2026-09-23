-- TASK-023: capability seed changes for the real supplier evaluation slice.
--
-- 1. Adds the smallest new capability pair for supplier records: no existing
--    capability in 20260912120100_identity_and_tenancy.sql covers creating
--    or viewing a supplier entity (policy.*, evaluation.*, and case.* are all
--    about a different bounded context). supplier.manage covers create for
--    this slice (no update/delete flow exists yet); supplier.view covers
--    read, granted alongside evaluation.view since a supplier record is what
--    an evaluation is about.
-- 2. Removes ('risk_analyst', 'case.decide') from role_capabilities: the
--    human-approved product decision for this task (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
--    "Human-approved product decisions") is that only tenant_admin (Company
--    Admin) may ever record a final case decision. The original TASK-002
--    seed granted case.decide to risk_analyst as well, which contradicts
--    that rule. This is the smallest forward migration that corrects it:
--    a DELETE on reference/platform-defined seed data, not tenant data, so
--    no tenant-owned row is touched.

insert into public.capabilities (key, description) values
  ('supplier.manage', 'Create and register fictional evidence metadata for tenant supplier records.'),
  ('supplier.view', 'View tenant supplier records and their evidence metadata.')
on conflict (key) do nothing;

insert into public.role_capabilities (role_key, capability_key) values
  ('tenant_admin', 'supplier.manage'),
  ('tenant_admin', 'supplier.view'),
  ('risk_analyst', 'supplier.manage'),
  ('risk_analyst', 'supplier.view'),
  ('operator', 'supplier.view'),
  ('auditor', 'supplier.view'),
  ('integration_developer', 'supplier.view')
on conflict do nothing;

delete from public.role_capabilities
where role_key = 'risk_analyst' and capability_key = 'case.decide';

-- Rollback: delete the two role_capabilities inserts above and the two
-- capabilities rows (supplier.manage, supplier.view); re-insert
-- ('risk_analyst', 'case.decide') to restore the prior (contradictory) seed
-- if ever needed. No tenant data is affected either way.

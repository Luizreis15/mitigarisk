-- TASK-023: real supplier evaluation slice — supplier + fictional evidence
-- metadata bounded model.
--
-- Deliberately minimal: only the fields the first deterministic evaluation
-- needs (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
-- "Initial supplier fields" / "Initial fictional evidence manifest"). No
-- personal documents, phone numbers, personal addresses, bank credentials,
-- or beneficial-owner personal details are modeled here. Evidence is a
-- metadata manifest only: no binary upload, no Supabase Storage — this
-- migration adds no storage bucket or file column of any kind.
--
-- Actor provenance follows the established pattern from
-- 20260912120800_security_and_english_first_hardening.sql ("Actor
-- provenance for authenticated writes"): RLS with-check clauses require
-- created_by/updated_by to equal auth.uid(), so a browser can never forge
-- another user's attribution; server code (apps/web/lib/supabase/**) always
-- sets these from the verified RequestIdentity, never from a form field.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reference text not null check (char_length(reference) between 1 and 64),
  display_name text not null check (char_length(display_name) between 1 and 200),
  relationship_type text not null default 'supplier' check (relationship_type = 'supplier'),
  registration_country_code text not null check (registration_country_code ~ '^[A-Z]{2}$'),
  registration_identifier text not null check (char_length(registration_identifier) between 1 and 100),
  industry_code text not null check (char_length(industry_code) between 1 and 100),
  operating_country_codes text[] not null,
  relationship_purpose text not null check (char_length(relationship_purpose) between 1 and 2000),
  annual_exposure_minor bigint not null check (annual_exposure_minor >= 0),
  annual_exposure_currency text not null check (annual_exposure_currency ~ '^[A-Z]{3}$'),
  onboarding_channel text not null check (onboarding_channel in ('web', 'api', 'assisted')),
  website_domain text check (website_domain is null or char_length(website_domain) between 1 and 255),
  status text not null default 'draft' check (status in ('draft', 'ready', 'evaluated', 'archived')),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- At least one operating country, and every element a plausible
  -- ISO 3166-1 alpha-2 code. Real-world validity is out of scope (out of
  -- scope: "external company registries"); this is shape validation only.
  -- A CHECK constraint cannot contain a subquery, so this validates every
  -- element with one regex over the comma-joined array rather than an
  -- unnest()-based EXISTS.
  check (
    array_length(operating_country_codes, 1) > 0
    and array_to_string(operating_country_codes, ',') ~ '^[A-Z]{2}(,[A-Z]{2})*$'
  ),
  unique (tenant_id, reference),
  unique (id, tenant_id)
);

create index if not exists idx_suppliers_tenant_id on public.suppliers (tenant_id);

create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function app.set_updated_at();

-- Identity and provenance are frozen after insert: reference, tenant, and
-- who/when created never change on an update (mirrors app.guard_case_identity()
-- in 20260912120800_security_and_english_first_hardening.sql). This slice has
-- no update flow of its own, but the guard holds regardless of future callers.
create or replace function app.guard_supplier_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.reference is distinct from old.reference
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Supplier identity and creation provenance cannot be changed'
      using errcode = '23001';
  end if;
  return new;
end;
$$;

create trigger trg_suppliers_identity_guard
  before update on public.suppliers
  for each row execute function app.guard_supplier_identity();

create table if not exists public.supplier_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  supplier_id uuid not null,
  evidence_type text not null check (
    evidence_type in (
      'incorporation_record',
      'ownership_declaration',
      'address_confirmation',
      'bank_account_confirmation',
      'compliance_questionnaire'
    )
  ),
  display_name text not null check (char_length(display_name) between 1 and 200),
  issuer_country_code text check (issuer_country_code is null or issuer_country_code ~ '^[A-Z]{2}$'),
  issue_date date,
  verification_state text not null default 'provided' check (verification_state in ('provided', 'reviewed', 'rejected')),
  -- SHA-256 test digest of a fictional local fixture/declaration; never
  -- secret material and never a byte of file content (no upload in this
  -- slice). Computed server-side from canonical declared facts, not
  -- accepted as a raw client-supplied hash — see
  -- apps/web/lib/domain/supplier-evidence.ts.
  digest_sha256 text not null check (digest_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (supplier_id, tenant_id) references public.suppliers (id, tenant_id) on delete cascade
);

create index if not exists idx_supplier_evidence_tenant_id on public.supplier_evidence (tenant_id);
create index if not exists idx_supplier_evidence_supplier_id on public.supplier_evidence (supplier_id);

create trigger trg_supplier_evidence_updated_at
  before update on public.supplier_evidence
  for each row execute function app.set_updated_at();

create or replace function app.guard_supplier_evidence_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.supplier_id is distinct from old.supplier_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Supplier evidence identity and creation provenance cannot be changed'
      using errcode = '23001';
  end if;
  return new;
end;
$$;

create trigger trg_supplier_evidence_identity_guard
  before update on public.supplier_evidence
  for each row execute function app.guard_supplier_evidence_identity();

-- Row level security ----------------------------------------------------------
--
-- Security correction (post-review, 2026-09-15): platform administrators
-- must receive no bypass here at all, for select or write
-- (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md,
-- acceptance criterion 9: "No platform administrator ... produces a
-- successful result"; docs/architecture/PLATFORM-ARCHITECTURE.md,
-- "Platform administrators receive no operational bypass through the real
-- workspace"). Select policies below use app.has_tenant_capability_as_member()
-- (20260914120050_no_bypass_authorization_helpers.sql), not app.has_capability(),
-- specifically because the latter's platform-admin bypass is unconditional.
-- There is no authenticated insert policy on either table at all: every
-- write goes through the security-definer public.create_supplier()/
-- public.create_supplier_evidence() RPCs below, which derive the actor
-- from auth.uid() themselves and record a mandatory audit event in the
-- same transaction. Direct INSERT is also revoked from authenticated so a
-- raw PostgREST insert fails on the grant itself, not only on RLS.

alter table public.suppliers enable row level security;
alter table public.supplier_evidence enable row level security;

create policy suppliers_select on public.suppliers
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'supplier.view')
  );

-- No insert/update/delete policy for authenticated/anon: writes are
-- RPC-only (see below). RLS fails closed by omission.

create policy supplier_evidence_select on public.supplier_evidence
  for select to authenticated using (
    app.has_tenant_capability_as_member(tenant_id, 'supplier.view')
  );

-- No insert/update/delete policy: writes are RPC-only (see below).

revoke insert, update, delete on public.suppliers from authenticated, anon;
revoke insert, update, delete on public.supplier_evidence from authenticated, anon;

-- Atomic, capability-checked, audited create RPCs ----------------------------
-- security definer: with no authenticated insert policy or grant left on
-- either table, these are now the *only* path a client can create a row
-- through. Running as the defining role means the INSERT itself is not
-- subject to RLS (there being no policy for authenticated would otherwise
-- deny it unconditionally) and can resolve app.* helpers directly (a
-- security-invoker function body cannot: authenticated has no USAGE on
-- schema app, see 20260912120150_authorization_helpers.sql). The explicit
-- app.has_tenant_capability_as_member() check is therefore the actual
-- enforcement boundary, not a defense-in-depth convenience on top of RLS —
-- mirroring public.record_audit_event() (20260912120700_audit.sql), the
-- one other table in this codebase with no authenticated write policy at
-- all.
create or replace function public.create_supplier(
  p_tenant_id uuid,
  p_reference text,
  p_display_name text,
  p_registration_country_code text,
  p_registration_identifier text,
  p_industry_code text,
  p_operating_country_codes text[],
  p_relationship_purpose text,
  p_annual_exposure_minor bigint,
  p_annual_exposure_currency text,
  p_onboarding_channel text,
  p_website_domain text default null
) returns public.suppliers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_supplier public.suppliers;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'supplier.manage') then
    raise exception 'Missing supplier.manage capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  insert into public.suppliers (
    tenant_id, reference, display_name, registration_country_code, registration_identifier,
    industry_code, operating_country_codes, relationship_purpose, annual_exposure_minor,
    annual_exposure_currency, onboarding_channel, website_domain, created_by, updated_by
  ) values (
    p_tenant_id, p_reference, p_display_name, p_registration_country_code, p_registration_identifier,
    p_industry_code, p_operating_country_codes, p_relationship_purpose, p_annual_exposure_minor,
    p_annual_exposure_currency, p_onboarding_channel, p_website_domain, auth.uid(), auth.uid()
  )
  returning * into v_supplier;

  -- Mandatory, atomic: if this fails, the whole create fails with it —
  -- a supplier can never exist without a matching audit event.
  perform public.record_audit_event(
    p_tenant_id, 'supplier.created', 'supplier', v_supplier.id::text, null,
    jsonb_build_object('reference', p_reference)
  );

  return v_supplier;
end;
$$;

comment on function public.create_supplier(uuid, text, text, text, text, text, text[], text, bigint, text, text, text) is
  'Only path to create a supplier: security definer, checks supplier.manage via app.has_tenant_capability_as_member() (no platform-admin bypass), pins created_by/updated_by to auth.uid(), and records a mandatory audit event atomically.';

revoke all on function public.create_supplier(uuid, text, text, text, text, text, text[], text, bigint, text, text, text) from public;
grant execute on function public.create_supplier(uuid, text, text, text, text, text, text[], text, bigint, text, text, text) to authenticated;

create or replace function public.create_supplier_evidence(
  p_tenant_id uuid,
  p_supplier_id uuid,
  p_evidence_type text,
  p_display_name text,
  p_issuer_country_code text,
  p_issue_date date,
  p_verification_state text,
  p_digest_sha256 text
) returns public.supplier_evidence
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evidence public.supplier_evidence;
begin
  if not app.has_tenant_capability_as_member(p_tenant_id, 'supplier.manage') then
    raise exception 'Missing supplier.manage capability for tenant %', p_tenant_id using errcode = '42501';
  end if;

  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.tenant_id = p_tenant_id) then
    raise exception 'Supplier % not found in tenant %', p_supplier_id, p_tenant_id using errcode = 'P0002';
  end if;

  insert into public.supplier_evidence (
    tenant_id, supplier_id, evidence_type, display_name, issuer_country_code, issue_date,
    verification_state, digest_sha256, created_by, updated_by
  ) values (
    p_tenant_id, p_supplier_id, p_evidence_type, p_display_name, p_issuer_country_code, p_issue_date,
    p_verification_state, p_digest_sha256, auth.uid(), auth.uid()
  )
  returning * into v_evidence;

  perform public.record_audit_event(
    p_tenant_id, 'supplier_evidence.created', 'supplier_evidence', v_evidence.id::text, null,
    jsonb_build_object('supplier_id', p_supplier_id, 'evidence_type', p_evidence_type)
  );

  return v_evidence;
end;
$$;

comment on function public.create_supplier_evidence(uuid, uuid, text, text, text, date, text, text) is
  'Only path to create a supplier evidence entry: security definer, checks supplier.manage via app.has_tenant_capability_as_member() (no platform-admin bypass), verifies the supplier belongs to the same tenant, pins created_by/updated_by to auth.uid(), and records a mandatory audit event atomically.';

revoke all on function public.create_supplier_evidence(uuid, uuid, text, text, text, date, text, text) from public;
grant execute on function public.create_supplier_evidence(uuid, uuid, text, text, text, date, text, text) to authenticated;

-- Rollback: drop function public.create_supplier_evidence(...); drop
-- function public.create_supplier(...); re-grant insert/update/delete on
-- both tables to authenticated, anon if ever reverting to a policy-based
-- write path; drop the policies, triggers, and tables above
-- (supplier_evidence, suppliers) then drop the two guard functions. No
-- data migration is required because this migration only ever creates
-- objects (the two REVOKE statements above are the only exception, and
-- both are trivially reversible with GRANT).

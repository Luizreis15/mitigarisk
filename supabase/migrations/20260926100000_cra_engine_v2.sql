-- TASK-032: CRA engine v2 -- policy structure and database evaluator.
-- Follows ADR 0012 (docs/adr/0012-customer-cra-engine-as-mvp-core.md): the
-- scoring authority stays in the database. Adds a second policy engine kind,
-- 'cra_v2', whose structure (override rules, weighted categories with
-- sub-factors and value->points maps, bands mapped to SDD/CDD/EDD with
-- required actions, approvals and review interval) follows
-- docs/product/policy-templates/CRA-TEMPLATE-v1-DRAFT.md, and a pure,
-- deterministic evaluator over a facts document, app.evaluate_cra().
--
-- Deliberately NOT here: the customer subject, assessment persistence, user
-- RPCs, UI, API, trigger rules, approval chain and audit pack (later tasks),
-- and any change to the supplier flow other than the one-line policy
-- selection fix in section 6 (Amendment 1 of the TASK-032 contract).
--
-- Rollback (forward-only migration): drop trigger
-- trg_policy_versions_cra_publish_validation and the two new trigger/helper
-- functions; drop the four child tables; drop the three new columns of
-- public.policy_versions; drop function app.evaluate_cra; restore the prior
-- bodies of app.forbid_published_policy_version_mutation() (20260912120200)
-- and public.run_supplier_evaluation() (20260922140000). No existing data is
-- modified: every added column is nullable or defaulted, and every existing
-- policy version keeps engine_kind 'weighted_v1'.

-- 1. Policy engine kind, label and the missing-factor setting -----------------

alter table public.policy_versions
  add column engine_kind text not null default 'weighted_v1'
    check (engine_kind in ('weighted_v1', 'cra_v2')),
  add column label text
    check (label is null or char_length(label) between 1 and 200),
  add column missing_factor_points numeric
    check (missing_factor_points is null or (missing_factor_points >= 0 and missing_factor_points <= 100));

comment on column public.policy_versions.engine_kind is
  'weighted_v1 = the original single-level weighted policy (policy_factors/policy_thresholds); cra_v2 = the CRA structure (policy_categories, policy_category_factors, policy_overrides, policy_cra_bands).';
comment on column public.policy_versions.missing_factor_points is
  'cra_v2 only: risk points scored by a factor whose fact is absent or not in its points map. Required (0-100) at publish time.';

-- A published policy version is immutable, including the new columns. The
-- existing archive-only transition check (20260912120200) never looked at
-- them, so an archive could have silently rewritten what a historical
-- evaluation was scored with; the three new columns are added to it. The
-- body is otherwise unchanged.
create or replace function app.forbid_published_policy_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('published', 'archived') then
    if tg_op = 'DELETE' then
      raise exception 'Published policy version % cannot be deleted', old.id using errcode = '23001';
    end if;

    if old.status = 'published' and new.status = 'archived'
       and new.id = old.id
       and new.tenant_id = old.tenant_id
       and new.version_number = old.version_number
       and new.effective_from is not distinct from old.effective_from
       and new.published_at is not distinct from old.published_at
       and new.published_by is not distinct from old.published_by
       and new.created_by = old.created_by
       and new.created_at = old.created_at
       and new.engine_kind = old.engine_kind
       and new.label is not distinct from old.label
       and new.missing_factor_points is not distinct from old.missing_factor_points
    then
      return new; -- the only allowed change: draft archival lifecycle end.
    end if;

    raise exception 'Published policy version % is immutable', old.id using errcode = '23001';
  end if;

  return new;
end;
$$;

-- 2. CRA policy child tables ---------------------------------------------------
-- Tenant-scoped, composite FKs to policy_versions(id, tenant_id), so a child
-- can never point at another tenant's version. Written by migration/seed or
-- superuser only for now (policy authoring UI is post-MVP): no write grants
-- to authenticated/anon. Constraints that the publish-time validator also
-- covers (weights summing to 100, points maps, band contiguity, override
-- effects) are deliberately NOT table CHECKs: a draft may be incomplete while
-- it is assembled, and the validator reports every rule with 22023.

create table public.policy_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (char_length(label) between 1 and 200),
  weight numeric not null check (weight > 0 and weight <= 100),
  position integer not null check (position >= 1),
  created_at timestamptz not null default now(),
  unique (policy_version_id, key),
  unique (policy_version_id, position),
  foreign key (policy_version_id, tenant_id)
    references public.policy_versions (id, tenant_id) on delete cascade
);

create table public.policy_category_factors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  category_key text not null,
  factor_key text not null check (factor_key ~ '^[a-z][a-z0-9_]*$'),
  weight numeric not null check (weight > 0 and weight <= 100),
  position integer not null check (position >= 1),
  points jsonb not null,
  created_at timestamptz not null default now(),
  unique (policy_version_id, factor_key),
  unique (policy_version_id, category_key, position),
  foreign key (policy_version_id, tenant_id)
    references public.policy_versions (id, tenant_id) on delete cascade,
  foreign key (policy_version_id, category_key)
    references public.policy_categories (policy_version_id, key) on delete cascade
);

create table public.policy_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]*$'),
  position integer not null check (position >= 1),
  fact_key text not null check (fact_key ~ '^[a-z][a-z0-9_]*$'),
  match_values jsonb not null,
  effect text not null,
  actions jsonb not null default '[]'::jsonb,
  approvals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (policy_version_id, code),
  unique (policy_version_id, position),
  foreign key (policy_version_id, tenant_id)
    references public.policy_versions (id, tenant_id) on delete cascade
);

comment on column public.policy_overrides.effect is
  'reject or force_high. Validated at publish time, not by a table CHECK, so an unknown effect is reported by the same 22023 validator as every other structural defect.';

create table public.policy_cra_bands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  band text not null check (band in ('LOW', 'MEDIUM', 'HIGH')),
  min_score numeric not null,
  max_score numeric not null,
  max_inclusive boolean not null default false,
  dd_level text not null check (dd_level in ('SDD', 'CDD', 'EDD')),
  review_months integer not null check (review_months > 0),
  actions jsonb not null default '[]'::jsonb,
  approvals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (policy_version_id, band),
  foreign key (policy_version_id, tenant_id)
    references public.policy_versions (id, tenant_id) on delete cascade
);

comment on table public.policy_cra_bands is
  'A score s falls in a band when min_score <= s and (s < max_score, or s <= max_score when max_inclusive). Contiguity over [0,100] is validated at publish time.';

create index idx_policy_categories_version on public.policy_categories (policy_version_id);
create index idx_policy_category_factors_version on public.policy_category_factors (policy_version_id);
create index idx_policy_overrides_version on public.policy_overrides (policy_version_id);
create index idx_policy_cra_bands_version on public.policy_cra_bands (policy_version_id);

-- A published/archived version's structure is immutable: the existing
-- draft-only guard (security definer since TASK-028) covers every child.
create trigger trg_policy_categories_guard
  before insert or update or delete on public.policy_categories
  for each row execute function app.forbid_children_when_not_draft();
create trigger trg_policy_category_factors_guard
  before insert or update or delete on public.policy_category_factors
  for each row execute function app.forbid_children_when_not_draft();
create trigger trg_policy_overrides_guard
  before insert or update or delete on public.policy_overrides
  for each row execute function app.forbid_children_when_not_draft();
create trigger trg_policy_cra_bands_guard
  before insert or update or delete on public.policy_cra_bands
  for each row execute function app.forbid_children_when_not_draft();

alter table public.policy_categories enable row level security;
alter table public.policy_category_factors enable row level security;
alter table public.policy_overrides enable row level security;
alter table public.policy_cra_bands enable row level security;

create policy policy_categories_select on public.policy_categories
  for select to authenticated using (app.has_tenant_capability_as_member(tenant_id, 'policy.view'));
create policy policy_category_factors_select on public.policy_category_factors
  for select to authenticated using (app.has_tenant_capability_as_member(tenant_id, 'policy.view'));
create policy policy_overrides_select on public.policy_overrides
  for select to authenticated using (app.has_tenant_capability_as_member(tenant_id, 'policy.view'));
create policy policy_cra_bands_select on public.policy_cra_bands
  for select to authenticated using (app.has_tenant_capability_as_member(tenant_id, 'policy.view'));

-- No insert/update/delete policy exists, and the grants are revoked as well
-- so a raw write fails on the grant itself, not only on RLS.
revoke all on public.policy_categories, public.policy_category_factors,
  public.policy_overrides, public.policy_cra_bands from anon;
revoke insert, update, delete on public.policy_categories, public.policy_category_factors,
  public.policy_overrides, public.policy_cra_bands from authenticated;

-- 3. Publish-time validation (cra_v2 only) -------------------------------------
-- Fails with 22023 and aborts the whole UPDATE/INSERT, so no partial publish
-- exists. security definer with a fixed search_path: it must read the child
-- tables regardless of the publisher's own read visibility (the TASK-029
-- lesson), and every branch fails closed.

create or replace function app.cra_string_array_valid(p_value jsonb, p_allowed text[])
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_element jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' then
    return false;
  end if;
  for v_element in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_element) <> 'string' then
      return false;
    end if;
    if p_allowed is not null and not ((v_element #>> '{}') = any (p_allowed)) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function app.validate_cra_policy_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sum numeric;
  v_key text;
  v_count integer;
  v_prev record;
  v_band record;
  v_first boolean := true;
begin
  if new.engine_kind is distinct from 'cra_v2' then
    return new;
  end if;
  if not (new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')) then
    return new;
  end if;

  if new.missing_factor_points is null then
    raise exception 'CRA policy % cannot be published without missing_factor_points', new.id using errcode = '22023';
  end if;

  -- Category weights sum to 100.
  select coalesce(sum(weight), 0), count(*) into v_sum, v_count
  from public.policy_categories where policy_version_id = new.id and tenant_id = new.tenant_id;
  if v_count = 0 or v_sum <> 100 then
    raise exception 'CRA policy % category weights must sum to 100 (got %)', new.id, v_sum using errcode = '22023';
  end if;

  -- Factor weights within every category sum to 100 (an empty category sums to 0).
  select c.key into v_key
  from public.policy_categories c
  left join public.policy_category_factors f
    on f.policy_version_id = c.policy_version_id and f.category_key = c.key
  where c.policy_version_id = new.id and c.tenant_id = new.tenant_id
  group by c.key
  having coalesce(sum(f.weight), 0) <> 100
  order by c.key
  limit 1;
  if found then
    raise exception 'CRA policy % factor weights in category % must sum to 100', new.id, v_key using errcode = '22023';
  end if;

  -- Every points map is a non-empty object whose values are numbers in [0, 100].
  select f.factor_key into v_key
  from public.policy_category_factors f
  where f.policy_version_id = new.id and f.tenant_id = new.tenant_id
    and case
      when jsonb_typeof(f.points) is distinct from 'object' then true
      when f.points = '{}'::jsonb then true
      else exists (
        select 1 from jsonb_each(f.points) e
        where case
          when jsonb_typeof(e.value) <> 'number' then true
          else (e.value #>> '{}')::numeric < 0 or (e.value #>> '{}')::numeric > 100
        end
      )
    end
  order by f.factor_key
  limit 1;
  if found then
    raise exception 'CRA policy % factor % has an empty or out-of-range points map', new.id, v_key using errcode = '22023';
  end if;

  -- Bands are contiguous over [0, 100]: sorted by min_score, the first starts
  -- at 0, each next band starts exactly where the previous (exclusive) one
  -- ends, and the last ends at 100 inclusive. A HIGH band must exist, because
  -- an override forces it.
  select count(*) into v_count
  from public.policy_cra_bands where policy_version_id = new.id and tenant_id = new.tenant_id;
  if v_count = 0 then
    raise exception 'CRA policy % has no bands', new.id using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.policy_cra_bands
    where policy_version_id = new.id and tenant_id = new.tenant_id and band = 'HIGH'
  ) then
    raise exception 'CRA policy % has no HIGH band', new.id using errcode = '22023';
  end if;
  for v_band in
    select * from public.policy_cra_bands
    where policy_version_id = new.id and tenant_id = new.tenant_id
    order by min_score, max_score
  loop
    if v_band.min_score >= v_band.max_score then
      raise exception 'CRA policy % band % has an empty range', new.id, v_band.band using errcode = '22023';
    end if;
    if v_first then
      if v_band.min_score <> 0 then
        raise exception 'CRA policy % bands must start at 0', new.id using errcode = '22023';
      end if;
      v_first := false;
    else
      if v_band.min_score <> v_prev.max_score or v_prev.max_inclusive then
        raise exception 'CRA policy % bands are not contiguous at % / %', new.id, v_prev.band, v_band.band using errcode = '22023';
      end if;
    end if;
    if not app.cra_string_array_valid(v_band.actions, null)
       or not app.cra_string_array_valid(v_band.approvals, array['MLRO', 'BOARD']) then
      raise exception 'CRA policy % band % has invalid actions or approvals', new.id, v_band.band using errcode = '22023';
    end if;
    v_prev := v_band;
  end loop;
  if v_prev.max_score <> 100 or not v_prev.max_inclusive then
    raise exception 'CRA policy % bands must end at 100 inclusive', new.id using errcode = '22023';
  end if;

  -- Overrides: known effect, a non-empty array of match values, string
  -- arrays for actions and approvals.
  select o.code into v_key
  from public.policy_overrides o
  where o.policy_version_id = new.id and o.tenant_id = new.tenant_id
    and o.effect not in ('reject', 'force_high')
  order by o.position
  limit 1;
  if found then
    raise exception 'CRA policy % override % has an unknown effect', new.id, v_key using errcode = '22023';
  end if;
  for v_band in
    select * from public.policy_overrides
    where policy_version_id = new.id and tenant_id = new.tenant_id
    order by position
  loop
    if jsonb_typeof(v_band.match_values) is distinct from 'array' or jsonb_array_length(v_band.match_values) = 0 then
      raise exception 'CRA policy % override % needs a non-empty match_values array', new.id, v_band.code using errcode = '22023';
    end if;
    if not app.cra_string_array_valid(v_band.actions, null)
       or not app.cra_string_array_valid(v_band.approvals, array['MLRO', 'BOARD']) then
      raise exception 'CRA policy % override % has invalid actions or approvals', new.id, v_band.code using errcode = '22023';
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_policy_versions_cra_publish_validation
  before insert or update on public.policy_versions
  for each row execute function app.validate_cra_policy_on_publish();

-- 4. app.evaluate_cra ------------------------------------------------------------
-- Pure and deterministic over (policy version, facts): reads only the
-- version's own structure, writes nothing. Semantics are the contract's
-- (TASK-032 + Amendment 1) and match the orchestrator's reference engine:
--   * factor: value present and in the points map -> mapped points and
--     FACTOR_<KEY>_{LOW|MEDIUM|HIGH} (LOW < 30, HIGH >= 70); absent (SQL null
--     or JSON null) -> missing_factor_points and DATA_MISSING_<KEY>; present
--     but not a string in the map -> also INVALID_VALUE_<KEY>;
--   * category score = sum(points * weight) / sum(weight), half-up to 2 dp;
--     overall = sum(category score * category weight) / 100, half-up to 2 dp;
--   * band by score; overrides evaluated in position order, every hit
--     reported, reject beats force_high, either forces the HIGH band;
--   * outcome REJECT / REVIEW_REQUIRED / PROCEED (a recommendation only);
--   * required actions = band actions then override actions, de-duplicated
--     keeping the first occurrence; approvals = union ordered MLRO, BOARD;
--   * reason codes: override codes, factor/data codes in template order,
--     then BAND_* and DD_*.
-- Fails closed with 22023 on a version that is not cra_v2, does not belong to
-- the tenant, or is structurally unusable (no categories, zero weights, no
-- matching band, malformed arrays).

create or replace function app.evaluate_cra(
  p_tenant_id uuid,
  p_policy_version_id uuid,
  p_facts jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_missing_points numeric;
  v_cat record;
  v_fac record;
  v_ovr record;
  v_band record;
  v_fact jsonb;
  v_map_key text;
  v_points numeric;
  v_level text;
  v_num numeric;
  v_den numeric;
  v_cs numeric;
  v_overall numeric := 0;
  v_score numeric;
  v_cat_scores jsonb := '{}'::jsonb;
  v_cat_count integer := 0;
  v_factor_reasons text[] := '{}';
  v_missing text[] := '{}';
  v_hits text[] := '{}';
  v_override_actions text[] := '{}';
  v_override_approvals text[] := '{}';
  v_effect text;
  v_actions text[] := '{}';
  v_approvals text[] := '{}';
  v_item text;
  v_outcome text;
  v_reasons text[];
begin
  if p_facts is null or jsonb_typeof(p_facts) <> 'object' then
    raise exception 'CRA facts must be a JSON object' using errcode = '22023';
  end if;

  select missing_factor_points into v_missing_points
  from public.policy_versions
  where id = p_policy_version_id and tenant_id = p_tenant_id and engine_kind = 'cra_v2';
  if not found or v_missing_points is null then
    raise exception 'Policy version % is not a usable cra_v2 version of tenant %', p_policy_version_id, p_tenant_id
      using errcode = '22023';
  end if;

  for v_cat in
    select key, weight from public.policy_categories
    where policy_version_id = p_policy_version_id and tenant_id = p_tenant_id
    order by position
  loop
    v_cat_count := v_cat_count + 1;
    v_num := 0;
    v_den := 0;
    for v_fac in
      select factor_key, weight, points from public.policy_category_factors
      where policy_version_id = p_policy_version_id and tenant_id = p_tenant_id and category_key = v_cat.key
      order by position
    loop
      v_fact := p_facts -> v_fac.factor_key;
      if jsonb_typeof(v_fac.points) is distinct from 'object' then
        raise exception 'Factor % has a malformed points map', v_fac.factor_key using errcode = '22023';
      end if;
      if v_fact is not null and jsonb_typeof(v_fact) = 'string'
         and v_fac.points ? (v_fact #>> '{}') then
        v_map_key := v_fact #>> '{}';
        if jsonb_typeof(v_fac.points -> v_map_key) is distinct from 'number' then
          raise exception 'Factor % has a non-numeric points entry', v_fac.factor_key using errcode = '22023';
        end if;
        v_points := (v_fac.points ->> v_map_key)::numeric;
        v_level := case when v_points < 30 then 'LOW' when v_points >= 70 then 'HIGH' else 'MEDIUM' end;
        v_factor_reasons := v_factor_reasons || ('FACTOR_' || upper(v_fac.factor_key) || '_' || v_level);
      else
        v_points := v_missing_points;
        v_missing := v_missing || v_fac.factor_key;
        v_factor_reasons := v_factor_reasons || ('DATA_MISSING_' || upper(v_fac.factor_key));
        if v_fact is not null and jsonb_typeof(v_fact) <> 'null' then
          v_factor_reasons := v_factor_reasons || ('INVALID_VALUE_' || upper(v_fac.factor_key));
        end if;
      end if;
      v_num := v_num + v_points * v_fac.weight;
      v_den := v_den + v_fac.weight;
    end loop;
    if v_den <= 0 then
      raise exception 'Category % has no weighted factors', v_cat.key using errcode = '22023';
    end if;
    v_cs := round(v_num / v_den, 2);
    v_cat_scores := v_cat_scores || jsonb_build_object(v_cat.key, v_cs);
    v_overall := v_overall + v_cs * v_cat.weight;
  end loop;
  if v_cat_count = 0 then
    raise exception 'Policy version % has no categories', p_policy_version_id using errcode = '22023';
  end if;
  v_score := round(v_overall / 100, 2);

  select * into v_band
  from public.policy_cra_bands
  where policy_version_id = p_policy_version_id and tenant_id = p_tenant_id
    and v_score >= min_score and (v_score < max_score or (max_inclusive and v_score <= max_score))
  order by min_score
  limit 1;
  if not found then
    raise exception 'Score % is covered by no band of policy version %', v_score, p_policy_version_id using errcode = '22023';
  end if;

  for v_ovr in
    select code, fact_key, match_values, effect, actions, approvals
    from public.policy_overrides
    where policy_version_id = p_policy_version_id and tenant_id = p_tenant_id
    order by position
  loop
    if jsonb_typeof(v_ovr.match_values) is distinct from 'array'
       or not app.cra_string_array_valid(v_ovr.actions, null)
       or not app.cra_string_array_valid(v_ovr.approvals, array['MLRO', 'BOARD'])
       or v_ovr.effect not in ('reject', 'force_high') then
      raise exception 'Override % is malformed', v_ovr.code using errcode = '22023';
    end if;
    v_fact := p_facts -> v_ovr.fact_key;
    if v_fact is not null and jsonb_typeof(v_fact) in ('string', 'boolean', 'number')
       and exists (select 1 from jsonb_array_elements(v_ovr.match_values) e where e.value = v_fact) then
      v_hits := v_hits || v_ovr.code;
      for v_item in select value from jsonb_array_elements_text(v_ovr.actions) loop
        v_override_actions := v_override_actions || v_item;
      end loop;
      for v_item in select value from jsonb_array_elements_text(v_ovr.approvals) loop
        v_override_approvals := v_override_approvals || v_item;
      end loop;
      if v_ovr.effect = 'reject' then
        v_effect := 'reject';
      elsif v_effect is null then
        v_effect := 'force_high';
      end if;
    end if;
  end loop;

  if v_effect is not null then
    select * into v_band
    from public.policy_cra_bands
    where policy_version_id = p_policy_version_id and tenant_id = p_tenant_id and band = 'HIGH';
    if not found then
      raise exception 'Policy version % has no HIGH band for an override', p_policy_version_id using errcode = '22023';
    end if;
  end if;

  if not app.cra_string_array_valid(v_band.actions, null)
     or not app.cra_string_array_valid(v_band.approvals, array['MLRO', 'BOARD']) then
    raise exception 'Band % is malformed', v_band.band using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements_text(v_band.actions) loop
    if not (v_item = any (v_actions)) then
      v_actions := v_actions || v_item;
    end if;
  end loop;
  foreach v_item in array v_override_actions loop
    if not (v_item = any (v_actions)) then
      v_actions := v_actions || v_item;
    end if;
  end loop;

  v_override_approvals := v_override_approvals || array(select value from jsonb_array_elements_text(v_band.approvals));
  if 'MLRO' = any (v_override_approvals) then
    v_approvals := v_approvals || 'MLRO'::text;
  end if;
  if 'BOARD' = any (v_override_approvals) then
    v_approvals := v_approvals || 'BOARD'::text;
  end if;

  v_outcome := case
    when v_effect = 'reject' then 'REJECT'
    when v_band.band = 'HIGH' then 'REVIEW_REQUIRED'
    else 'PROCEED'
  end;

  v_reasons := v_hits || v_factor_reasons || array['BAND_' || v_band.band, 'DD_' || v_band.dd_level];

  return jsonb_build_object(
    'overall_score', v_score,
    'category_scores', v_cat_scores,
    'band', v_band.band,
    'dd_level', v_band.dd_level,
    'outcome', v_outcome,
    'overrides_hit', to_jsonb(v_hits),
    'approvals_required', to_jsonb(v_approvals),
    'required_actions', to_jsonb(v_actions),
    'review_months', v_band.review_months,
    'missing_factors', to_jsonb(v_missing),
    'reason_codes', to_jsonb(v_reasons)
  );
end;
$$;

comment on function app.evaluate_cra(uuid, uuid, jsonb) is
  'TASK-032: pure, deterministic CRA evaluator over a facts document. Returns the casebook result shape (overall_score, category_scores, band, dd_level, outcome, overrides_hit, approvals_required, required_actions, review_months, missing_factors, reason_codes). A recommendation only; writes nothing. Not executable by authenticated/anon: only future security-definer RPCs call it. 22023 on a non-cra_v2 or foreign version.';

revoke all on function app.evaluate_cra(uuid, uuid, jsonb) from public, authenticated, anon;
revoke all on function app.validate_cra_policy_on_publish() from public, authenticated, anon;
revoke all on function app.cra_string_array_valid(jsonb, text[]) from public, authenticated, anon;

-- 5. run_supplier_evaluation: select only weighted_v1 policies ------------------
-- Amendment 1: with a second engine kind, "the tenant's most recently
-- published policy" is ambiguous. A tenant that publishes a cra_v2 version
-- would otherwise have supplier evaluation pick it up and fail. This is the
-- ONE change to the function: the policy lookup adds
-- `engine_kind = 'weighted_v1'`. The rest of the body is byte-identical to
-- 20260922140000_platform_admin_operational_boundary.sql, and grants and the
-- function comment carry over unchanged.

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
  where tenant_id = p_tenant_id and status = 'published' and engine_kind = 'weighted_v1'
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

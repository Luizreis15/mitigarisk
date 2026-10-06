-- TASK-033 verification: the customer subject and the trusted, persisted CRA
-- assessment path. Replays every casebook case through
-- public.run_customer_assessment (not just app.evaluate_cra, TASK-032's
-- concern), proves the strict intake validation from
-- docs/reviews/REVIEW-TASK-032.md fails closed and stores nothing, and
-- exercises authorization, isolation, immutability, idempotency and audit.
--
-- The casebook jsonb literal is byte-identical to
-- apps/web/tests/fixtures/cra-casebook-v1.json, generated the same way as
-- supabase/tests/090-cra-engine-v2.sql's (embedded verbatim, never by hand).
--
-- Run in a single psql session after 000-local-auth-shim.sql, all
-- migrations and supabase/seed.sql. See supabase/tests/README.md.

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not p_condition then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
  raise notice 'ok - %', p_message;
end;
$$;

create or replace function pg_temp.sqlstate_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlstate;
end;
$$;

-- Fixtures: demo tenant D = ...0004 (cra_v2 policy P = 2000...0020, from the
-- dev seed), customer C1 = 3000...0001 (also seeded), tenant M = ...0003
-- (Meridian, a real tenant with no cra_v2 published, for cross-tenant/P0002).
create temp table cra_casebook (c jsonb) on commit drop;
grant select on cra_casebook to authenticated;
insert into cra_casebook
select value from jsonb_array_elements($casebook$[
 {
  "id": "CB-01",
  "title": "Clean e-commerce customer at onboarding (face-to-face, bank transfer)",
  "source": "P1.7 low-risk path",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-02",
  "title": "Gambling purpose, card payment, non-face-to-face, onboarding",
  "source": "P1.7",
  "facts": {
   "purpose": "gambling",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "card",
   "product_type": "closed_loop",
   "channel": "non_face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 17.5,
   "category_scores": {
    "customer": 15.0,
    "geography": 0.0,
    "product_payment": 30.0,
    "channel": 100.0,
    "transactions": 0.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_MEDIUM",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_MEDIUM",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-03",
  "title": "Cash payment, cash-intensive occupation, higher-risk nationality",
  "source": "P1.7",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "cash_intensive",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "higher",
   "sow_country_risk": "standard",
   "payment_method": "cash",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 12.5,
   "category_scores": {
    "customer": 10.0,
    "geography": 15.0,
    "product_payment": 60.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_MEDIUM",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_MEDIUM",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_HIGH",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-04",
  "title": "Worst onboarding profile without overrides (transactions not yet observed)",
  "source": "P1.7 — shows Q1 impact",
  "facts": {
   "purpose": "multipurpose",
   "employment_status": "unemployed",
   "occupation_risk": "high_risk",
   "adverse_media_non_material": "multiple",
   "prior_str": "one_or_more",
   "residence_country_risk": "high_risk_third_country",
   "nationality_risk": "high_risk_third_country",
   "sow_country_risk": "high_risk_third_country",
   "payment_method": "cash",
   "product_type": "open_loop",
   "channel": "non_face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 55.0,
   "category_scores": {
    "customer": 100.0,
    "geography": 100.0,
    "product_payment": 100.0,
    "channel": 100.0,
    "transactions": 0.0
   },
   "band": "MEDIUM",
   "dd_level": "CDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE"
   ],
   "review_months": 24,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_HIGH",
    "FACTOR_EMPLOYMENT_STATUS_HIGH",
    "FACTOR_OCCUPATION_RISK_HIGH",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_HIGH",
    "FACTOR_PRIOR_STR_HIGH",
    "FACTOR_RESIDENCE_COUNTRY_RISK_HIGH",
    "FACTOR_NATIONALITY_RISK_HIGH",
    "FACTOR_SOW_COUNTRY_RISK_HIGH",
    "FACTOR_PAYMENT_METHOD_HIGH",
    "FACTOR_PRODUCT_TYPE_HIGH",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_MEDIUM",
    "DD_CDD"
   ]
  }
 },
 {
  "id": "CB-05",
  "title": "Same as CB-04 after transactions observed: above affordability, significant behaviour change, high-value tx",
  "source": "P2.8 ongoing CRA",
  "facts": {
   "purpose": "multipurpose",
   "employment_status": "unemployed",
   "occupation_risk": "high_risk",
   "adverse_media_non_material": "multiple",
   "prior_str": "one_or_more",
   "residence_country_risk": "high_risk_third_country",
   "nationality_risk": "high_risk_third_country",
   "sow_country_risk": "high_risk_third_country",
   "payment_method": "cash",
   "product_type": "open_loop",
   "channel": "non_face_to_face",
   "affordability": "above_limit",
   "behaviour_change": "significant",
   "high_value_transactions": "yes",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 100.0,
   "category_scores": {
    "customer": 100.0,
    "geography": 100.0,
    "product_payment": 100.0,
    "channel": 100.0,
    "transactions": 100.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_HIGH",
    "FACTOR_EMPLOYMENT_STATUS_HIGH",
    "FACTOR_OCCUPATION_RISK_HIGH",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_HIGH",
    "FACTOR_PRIOR_STR_HIGH",
    "FACTOR_RESIDENCE_COUNTRY_RISK_HIGH",
    "FACTOR_NATIONALITY_RISK_HIGH",
    "FACTOR_SOW_COUNTRY_RISK_HIGH",
    "FACTOR_PAYMENT_METHOD_HIGH",
    "FACTOR_PRODUCT_TYPE_HIGH",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_HIGH",
    "FACTOR_BEHAVIOUR_CHANGE_HIGH",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_HIGH",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-06",
  "title": "Ongoing review: clean profile but above affordability limit",
  "source": "P2.2c / P2.8",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "above_limit",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 22.5,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 50.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_HIGH",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-07",
  "title": "Ongoing review: gambling, card, non-F2F, near affordability limit, moderate behaviour change",
  "source": "P2.8",
  "facts": {
   "purpose": "gambling",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "card",
   "product_type": "closed_loop",
   "channel": "non_face_to_face",
   "affordability": "near_limit",
   "behaviour_change": "moderate",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 35.5,
   "category_scores": {
    "customer": 15.0,
    "geography": 0.0,
    "product_payment": 30.0,
    "channel": 100.0,
    "transactions": 40.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_MEDIUM",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_MEDIUM",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_MEDIUM",
    "FACTOR_BEHAVIOUR_CHANGE_MEDIUM",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-08",
  "title": "Ongoing review lands in MEDIUM: gambling, card, non-F2F, above limit + moderate change",
  "source": "P2.8",
  "facts": {
   "purpose": "gambling",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "card",
   "product_type": "closed_loop",
   "channel": "non_face_to_face",
   "affordability": "above_limit",
   "behaviour_change": "moderate",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 46.75,
   "category_scores": {
    "customer": 15.0,
    "geography": 0.0,
    "product_payment": 30.0,
    "channel": 100.0,
    "transactions": 65.0
   },
   "band": "MEDIUM",
   "dd_level": "CDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE"
   ],
   "review_months": 24,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_MEDIUM",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_MEDIUM",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_HIGH",
    "FACTOR_BEHAVIOUR_CHANGE_MEDIUM",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_MEDIUM",
    "DD_CDD"
   ]
  }
 },
 {
  "id": "CB-09",
  "title": "Confirmed sanctions match on a clean profile",
  "source": "P1.3 / P3.3",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "confirmed",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REJECT",
   "overrides_hit": [
    "OVR_SANCTIONS_CONFIRMED"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS",
    "FREEZE_FUNDS_AND_BLOCK_IF_EXISTING",
    "REJECT_IF_PROSPECT",
    "REPORT_TO_MLRO"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_SANCTIONS_CONFIRMED",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-10",
  "title": "Inconclusive (partial) sanctions match",
  "source": "P1.3 partial match",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "inconclusive",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [
    "OVR_SANCTIONS_INCONCLUSIVE"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS",
    "BLOCK_PENDING_MANUAL_REVIEW"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_SANCTIONS_INCONCLUSIVE",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-11",
  "title": "PEP confirmed by screening",
  "source": "P1.5",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "confirmed",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [
    "OVR_PEP"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_PEP",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-12",
  "title": "PEP self-declared in SOW questionnaire",
  "source": "P1.6",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "self_declared",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [
    "OVR_PEP"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_PEP",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-13",
  "title": "Material adverse media (AML/CFT conviction)",
  "source": "P1.4",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "material",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [
    "OVR_ADVERSE_MEDIA_MATERIAL"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS",
    "REPORT_TO_MLRO"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_ADVERSE_MEDIA_MATERIAL",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-14",
  "title": "Potential material adverse media (under investigation)",
  "source": "P1.4",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "potential",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [
    "OVR_ADVERSE_MEDIA_POTENTIAL"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_ADVERSE_MEDIA_POTENTIAL",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-15",
  "title": "High-net-worth individual",
  "source": "P1.7 condition",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": true,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [
    "OVR_HNWI"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_HNWI",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-16",
  "title": "Declared active links to blacklisted country",
  "source": "P1.2 / P3.5",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": true
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REJECT",
   "overrides_hit": [
    "OVR_BLACKLISTED_COUNTRY"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS",
    "REJECT_OR_TERMINATE",
    "REPORT_TO_MLRO"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_BLACKLISTED_COUNTRY",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-17",
  "title": "Multiple overrides: PEP + confirmed sanctions (reject wins)",
  "source": "precedence",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "confirmed",
   "pep_status": "confirmed",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REJECT",
   "overrides_hit": [
    "OVR_SANCTIONS_CONFIRMED",
    "OVR_PEP"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS",
    "FREEZE_FUNDS_AND_BLOCK_IF_EXISTING",
    "REJECT_IF_PROSPECT",
    "REPORT_TO_MLRO"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_SANCTIONS_CONFIRMED",
    "OVR_PEP",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-24",
  "title": "Two reject overrides sharing an action: material adverse media + blacklisted country (REPORT_TO_MLRO listed once)",
  "source": "override de-duplication",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "material",
   "hnwi": false,
   "blacklisted_country_link": true
  },
  "expected": {
   "overall_score": 0.0,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REJECT",
   "overrides_hit": [
    "OVR_BLACKLISTED_COUNTRY",
    "OVR_ADVERSE_MEDIA_MATERIAL"
   ],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS",
    "REJECT_OR_TERMINATE",
    "REPORT_TO_MLRO"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "OVR_BLACKLISTED_COUNTRY",
    "OVR_ADVERSE_MEDIA_MATERIAL",
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-18",
  "title": "Non-material adverse media only (not an override)",
  "source": "P1.4 non-material",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "single",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 1.5,
   "category_scores": {
    "customer": 7.5,
    "geography": 0.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_MEDIUM",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-19",
  "title": "Missing SOW-derived facts (occupation, employment, SOW country) at onboarding",
  "source": "data quality",
  "facts": {
   "purpose": "ecommerce",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 5.5,
   "category_scores": {
    "customer": 20.0,
    "geography": 15.0,
    "product_payment": 0.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [
    "employment_status",
    "occupation_risk",
    "sow_country_risk"
   ],
   "reason_codes": [
    "FACTOR_PURPOSE_LOW",
    "DATA_MISSING_EMPLOYMENT_STATUS",
    "DATA_MISSING_OCCUPATION_RISK",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "DATA_MISSING_SOW_COUNTRY_RISK",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-20",
  "title": "Invalid value supplied for payment_method",
  "source": "validation",
  "facts": {
   "purpose": "ecommerce",
   "employment_status": "employed",
   "occupation_risk": "standard",
   "adverse_media_non_material": "none",
   "prior_str": "none",
   "residence_country_risk": "standard",
   "nationality_risk": "standard",
   "sow_country_risk": "standard",
   "payment_method": "crypto",
   "product_type": "closed_loop",
   "channel": "face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 4.5,
   "category_scores": {
    "customer": 0.0,
    "geography": 0.0,
    "product_payment": 30.0,
    "channel": 0.0,
    "transactions": 0.0
   },
   "band": "LOW",
   "dd_level": "SDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING"
   ],
   "review_months": 36,
   "missing_factors": [
    "payment_method"
   ],
   "reason_codes": [
    "FACTOR_PURPOSE_LOW",
    "FACTOR_EMPLOYMENT_STATUS_LOW",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_LOW",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "DATA_MISSING_PAYMENT_METHOD",
    "INVALID_VALUE_PAYMENT_METHOD",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_LOW",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_LOW",
    "DD_SDD"
   ]
  }
 },
 {
  "id": "CB-21",
  "title": "Boundary check: score exactly 36.00 is MEDIUM",
  "source": "band boundary Q4",
  "facts": {
   "purpose": "gambling",
   "employment_status": "student",
   "occupation_risk": "high_risk",
   "adverse_media_non_material": "none",
   "prior_str": "one_or_more",
   "residence_country_risk": "higher",
   "nationality_risk": "high_risk_third_country",
   "sow_country_risk": "standard",
   "payment_method": "cash",
   "product_type": "closed_loop",
   "channel": "non_face_to_face",
   "affordability": "not_observed",
   "behaviour_change": "not_observed",
   "high_value_transactions": "not_observed",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 36.0,
   "category_scores": {
    "customer": 60.0,
    "geography": 50.0,
    "product_payment": 60.0,
    "channel": 100.0,
    "transactions": 0.0
   },
   "band": "MEDIUM",
   "dd_level": "CDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE"
   ],
   "review_months": 24,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_MEDIUM",
    "FACTOR_EMPLOYMENT_STATUS_MEDIUM",
    "FACTOR_OCCUPATION_RISK_HIGH",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_LOW",
    "FACTOR_PRIOR_STR_HIGH",
    "FACTOR_RESIDENCE_COUNTRY_RISK_MEDIUM",
    "FACTOR_NATIONALITY_RISK_HIGH",
    "FACTOR_SOW_COUNTRY_RISK_LOW",
    "FACTOR_PAYMENT_METHOD_HIGH",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_LOW",
    "FACTOR_BEHAVIOUR_CHANGE_LOW",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_LOW",
    "BAND_MEDIUM",
    "DD_CDD"
   ]
  }
 },
 {
  "id": "CB-22",
  "title": "Boundary check: score exactly 76.00 is HIGH",
  "source": "band boundary Q4",
  "facts": {
   "purpose": "multipurpose",
   "employment_status": "retired",
   "occupation_risk": "standard",
   "adverse_media_non_material": "single",
   "prior_str": "none",
   "residence_country_risk": "high_risk_third_country",
   "nationality_risk": "standard",
   "sow_country_risk": "higher",
   "payment_method": "bank_transfer",
   "product_type": "open_loop",
   "channel": "non_face_to_face",
   "affordability": "above_limit",
   "behaviour_change": "significant",
   "high_value_transactions": "yes",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 76.0,
   "category_scores": {
    "customer": 47.5,
    "geography": 55.0,
    "product_payment": 40.0,
    "channel": 100.0,
    "transactions": 100.0
   },
   "band": "HIGH",
   "dd_level": "EDD",
   "outcome": "REVIEW_REQUIRED",
   "overrides_hit": [],
   "approvals_required": [
    "MLRO"
   ],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE",
    "OBTAIN_SOW_SOF_DOCUMENTS"
   ],
   "review_months": 12,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_HIGH",
    "FACTOR_EMPLOYMENT_STATUS_MEDIUM",
    "FACTOR_OCCUPATION_RISK_LOW",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_MEDIUM",
    "FACTOR_PRIOR_STR_LOW",
    "FACTOR_RESIDENCE_COUNTRY_RISK_HIGH",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_MEDIUM",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_HIGH",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_HIGH",
    "FACTOR_BEHAVIOUR_CHANGE_HIGH",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_HIGH",
    "BAND_HIGH",
    "DD_EDD"
   ]
  }
 },
 {
  "id": "CB-23",
  "title": "Boundary check: score 75.50 stays MEDIUM",
  "source": "band boundary Q4",
  "facts": {
   "purpose": "gambling",
   "employment_status": "self_employed",
   "occupation_risk": "high_risk",
   "adverse_media_non_material": "multiple",
   "prior_str": "one_or_more",
   "residence_country_risk": "high_risk_third_country",
   "nationality_risk": "standard",
   "sow_country_risk": "higher",
   "payment_method": "bank_transfer",
   "product_type": "closed_loop",
   "channel": "non_face_to_face",
   "affordability": "above_limit",
   "behaviour_change": "significant",
   "high_value_transactions": "yes",
   "sanctions_match": "none",
   "pep_status": "none",
   "adverse_media_material": "none",
   "hnwi": false,
   "blacklisted_country_link": false
  },
  "expected": {
   "overall_score": 75.5,
   "category_scores": {
    "customer": 75.0,
    "geography": 55.0,
    "product_payment": 0.0,
    "channel": 100.0,
    "transactions": 100.0
   },
   "band": "MEDIUM",
   "dd_level": "CDD",
   "outcome": "PROCEED",
   "overrides_hit": [],
   "approvals_required": [],
   "required_actions": [
    "IDENTIFY_CUSTOMER",
    "VERIFY_ID",
    "ONGOING_SCREENING",
    "OBTAIN_PURPOSE_AND_NATURE"
   ],
   "review_months": 24,
   "missing_factors": [],
   "reason_codes": [
    "FACTOR_PURPOSE_MEDIUM",
    "FACTOR_EMPLOYMENT_STATUS_MEDIUM",
    "FACTOR_OCCUPATION_RISK_HIGH",
    "FACTOR_ADVERSE_MEDIA_NON_MATERIAL_HIGH",
    "FACTOR_PRIOR_STR_HIGH",
    "FACTOR_RESIDENCE_COUNTRY_RISK_HIGH",
    "FACTOR_NATIONALITY_RISK_LOW",
    "FACTOR_SOW_COUNTRY_RISK_MEDIUM",
    "FACTOR_PAYMENT_METHOD_LOW",
    "FACTOR_PRODUCT_TYPE_LOW",
    "FACTOR_CHANNEL_HIGH",
    "FACTOR_AFFORDABILITY_HIGH",
    "FACTOR_BEHAVIOUR_CHANGE_HIGH",
    "FACTOR_HIGH_VALUE_TRANSACTIONS_HIGH",
    "BAND_MEDIUM",
    "DD_CDD"
   ]
  }
 }
]$casebook$::jsonb);
select pg_temp.assert((select count(*) from cra_casebook) = 24, 'casebook has 24 cases');

-- Extra members this suite needs beyond the dev seed's tenant_admin (002)
-- and operator (004) in tenant D.
insert into public.memberships (tenant_id, user_id, role_key, status) values
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'risk_analyst', 'active'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'auditor', 'active')
on conflict (tenant_id, user_id) do nothing;

-- 1. Casebook: every case replayed through the RPC, persisted result exact --
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
do $$
declare
  v_case jsonb;
  v_row public.customer_assessments;
  v_corr uuid;
begin
  for v_case in select c from cra_casebook order by c ->> 'id' loop
    -- "CB-01" -> the zero-padded numeric suffix, so each case gets its own
    -- stable, distinct correlation id.
    v_corr := ('e1000000-0000-0000-0000-' || lpad(regexp_replace(v_case ->> 'id', '\D', '', 'g'), 12, '0'))::uuid;
    v_row := public.run_customer_assessment(
      '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', v_case -> 'facts', v_corr
    );
    if v_row.result is distinct from (v_case -> 'expected') then
      raise exception 'ASSERTION FAILED: casebook % result mismatch: got % expected %', v_case ->> 'id', v_row.result, v_case -> 'expected';
    end if;
    if v_row.overall_score is distinct from ((v_case -> 'expected' ->> 'overall_score')::numeric) then
      raise exception 'ASSERTION FAILED: casebook % overall_score column mismatch', v_case ->> 'id';
    end if;
    if v_row.band is distinct from (v_case -> 'expected' ->> 'band')
       or v_row.dd_level is distinct from (v_case -> 'expected' ->> 'dd_level')
       or v_row.outcome is distinct from (v_case -> 'expected' ->> 'outcome') then
      raise exception 'ASSERTION FAILED: casebook % denormalized column mismatch', v_case ->> 'id';
    end if;
    if v_row.next_review_due is distinct from (current_date + ((v_case -> 'expected' ->> 'review_months')::int || ' months')::interval)::date then
      raise exception 'ASSERTION FAILED: casebook % next_review_due mismatch', v_case ->> 'id';
    end if;
    raise notice 'ok - casebook % persisted with the exact expected result: %', v_case ->> 'id', v_case ->> 'title';
  end loop;
end;
$$;
select pg_temp.assert(
  (select count(*) from public.customer_assessments where tenant_id = '10000000-0000-0000-0000-000000000004' and customer_id = '30000000-0000-0000-0000-000000000001') = 24,
  '24 assessments were persisted for the fixture customer, one per casebook case'
);

-- 2. Strict intake validation: fails closed, stores nothing --------------------
do $$
declare
  v_base jsonb := (select c -> 'facts' from cra_casebook where c ->> 'id' = 'CB-01');
  v_negative record;
  v_facts jsonb;
  v_corr uuid;
  v_n int := 0;
begin
  for v_negative in
    select * from (values
      ('an unknown key is present', v_base || '{"unknown_field": "x"}'::jsonb),
      ('hnwi is the string "true", not the boolean', v_base || '{"hnwi": "true"}'::jsonb),
      ('pep_status has the wrong case', v_base || '{"pep_status": "Confirmed"}'::jsonb),
      ('sanctions_match is a number, not a string', v_base || '{"sanctions_match": 1}'::jsonb),
      ('an override fact is missing entirely', v_base - 'hnwi'),
      ('an override fact is explicit JSON null', v_base || '{"pep_status": null}'::jsonb)
    ) as t(label, facts)
  loop
    v_n := v_n + 1;
    v_corr := ('e2000000-0000-0000-0000-' || lpad(v_n::text, 12, '0'))::uuid;
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format(
        $q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, %L::jsonb, %L::uuid)$q$,
        v_negative.facts, v_corr
      )) = '22023',
      format('rejected with 22023 when %s', v_negative.label)
    );
    perform pg_temp.assert(
      (select count(*) from public.customer_assessments where tenant_id = '10000000-0000-0000-0000-000000000004' and correlation_id = v_corr) = 0,
      format('nothing stored when %s', v_negative.label)
    );
  end loop;
  -- A factor fact, unlike an override fact, may be absent, null, or
  -- unmapped: the evaluator's own missing-data semantics apply (TASK-032
  -- casebook CB-19/CB-20), not a hard rejection.
  v_facts := (v_base - 'purpose') || '{"employment_status": null, "channel": "not_a_real_channel"}'::jsonb;
  v_corr := 'e2000000-0000-0000-0000-000000000099'::uuid;
  perform public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', v_facts, v_corr);
  perform pg_temp.assert(
    (select result -> 'missing_factors' from public.customer_assessments where tenant_id = '10000000-0000-0000-0000-000000000004' and correlation_id = v_corr)
      @> '["purpose", "employment_status", "channel"]'::jsonb,
    'absent, null, and unmapped factor facts are accepted and scored as missing data, not rejected'
  );
end;
$$;

-- 3. Authorization: positive and negative, D1 and D2 ----------------------
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
do $$
declare v_row public.customer_assessments;
begin
  v_row := public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', (select c -> 'facts' from cra_casebook where c ->> 'id' = 'CB-01'), 'e3000000-0000-0000-0000-000000000001');
  perform pg_temp.assert(v_row.id is not null, 'tenant_admin (assessment.run) can run an assessment');
end;
$$;
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
do $$
declare v_row public.customer_assessments;
begin
  v_row := public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', (select c -> 'facts' from cra_casebook where c ->> 'id' = 'CB-01'), 'e3000000-0000-0000-0000-000000000002');
  perform pg_temp.assert(v_row.id is not null, 'risk_analyst (assessment.run) can run an assessment');
end;
$$;
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
do $$
declare v_row public.customer_assessments;
begin
  v_row := public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', (select c -> 'facts' from cra_casebook where c ->> 'id' = 'CB-01'), 'e3000000-0000-0000-0000-000000000003');
  perform pg_temp.assert(v_row.id is not null, 'operator (assessment.run, per the product direction) can run an assessment');
end;
$$;
reset role;

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
select pg_temp.assert(
  (select count(*) from public.customer_assessments where tenant_id = '10000000-0000-0000-0000-000000000004') > 0,
  'auditor (customer.view) can read customer assessments'
);
select pg_temp.assert(
  (select count(*) from public.customers where tenant_id = '10000000-0000-0000-0000-000000000004') = 3,
  'auditor (customer.view) can read all customer records'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '{}'::jsonb, gen_random_uuid())$q$) = '42501',
  'auditor (no assessment.run) cannot run an assessment'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.create_customer('10000000-0000-0000-0000-000000000004', 'CUST-AUDITOR-ATTEMPT', 'X', '2000-01-01', 'MT', 'MT', 'MT', 'face_to_face')$q$) = '42501',
  'auditor (no customer.manage) cannot create a customer'
);
reset role;

-- Outsider: no membership in tenant D at all.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000006';
select pg_temp.assert(
  (select count(*) from public.customers) = 0 and (select count(*) from public.customer_assessments) = 0,
  'an outsider with no membership reads nothing'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '{}'::jsonb, gen_random_uuid())$q$) = '42501',
  'an outsider with no membership cannot run an assessment'
);
reset role;

-- D1: dual-role platform admin, and platform admin with no membership at all.
insert into public.memberships (tenant_id, user_id, role_key, status, invited_by) values
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'tenant_admin', 'active', '00000000-0000-0000-0000-000000000002');
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '{}'::jsonb, gen_random_uuid())$q$) = '42501',
  'D1: dual-role platform admin cannot run an assessment despite an active tenant_admin membership'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.create_customer('10000000-0000-0000-0000-000000000004', 'CUST-DUAL-ATTEMPT', 'X', '2000-01-01', 'MT', 'MT', 'MT', 'face_to_face')$q$) = '42501',
  'D1: dual-role platform admin cannot create a customer'
);
select pg_temp.assert(
  (select count(*) from public.customers) = 0 and (select count(*) from public.customer_assessments) = 0,
  'D1: dual-role platform admin reads no customer data'
);
reset role;
delete from public.memberships where tenant_id = '10000000-0000-0000-0000-000000000004' and user_id = '00000000-0000-0000-0000-000000000001';

set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '{}'::jsonb, gen_random_uuid())$q$) = '42501',
  'platform admin with no membership at all cannot run an assessment'
);
reset role;

-- D2: suspended tenant.
update public.tenants set status = 'suspended' where id = '10000000-0000-0000-0000-000000000004';
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(
  (select count(*) from public.customers) = 0 and (select count(*) from public.customer_assessments) = 0,
  'D2: suspended-tenant admin reads no customer data'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '{}'::jsonb, gen_random_uuid())$q$) = '42501',
  'D2: suspended-tenant admin cannot run an assessment'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$select public.create_customer('10000000-0000-0000-0000-000000000004', 'CUST-SUSPENDED-ATTEMPT', 'X', '2000-01-01', 'MT', 'MT', 'MT', 'face_to_face')$q$) = '42501',
  'D2: suspended-tenant admin cannot create a customer'
);
reset role;
update public.tenants set status = 'active' where id = '10000000-0000-0000-0000-000000000004';

-- Cross-tenant: a real customer of tenant M evaluated against tenant D.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
do $$
declare v_meridian_customer public.customers;
begin
  v_meridian_customer := public.create_customer('10000000-0000-0000-0000-000000000003', 'CUST-MERIDIAN-001', 'Cross Tenant Fixture', '1990-01-01', 'MT', 'MT', 'MT', 'face_to_face');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format(
      $q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004'::uuid, %L::uuid, '{}'::jsonb, gen_random_uuid())$q$, v_meridian_customer.id
    )) = 'P0002',
    'a real customer id from another tenant (Meridian) is not found for the demo tenant (P0002, no disclosure)'
  );
end;
$$;
reset role;

-- No published cra_v2 policy: Meridian has none.
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
do $$
declare v_meridian_customer_id uuid;
begin
  select id into v_meridian_customer_id from public.customers where tenant_id = '10000000-0000-0000-0000-000000000003' and external_reference = 'CUST-MERIDIAN-001';
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format(
      $q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000003'::uuid, %L::uuid, '{}'::jsonb, gen_random_uuid())$q$, v_meridian_customer_id
    )) = 'P0003',
    'a tenant with no published cra_v2 policy (Meridian) raises P0003'
  );
end;
$$;
reset role;

-- 4. Immutability: customers and customer_assessments -----------------------
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert(
  pg_temp.sqlstate_of($q$insert into public.customers (tenant_id, external_reference, full_name, date_of_birth, country_of_birth, nationality, residence_country, onboarding_channel, created_by, updated_by) values ('10000000-0000-0000-0000-000000000004', 'CUST-DIRECT', 'X', '2000-01-01', 'MT', 'MT', 'MT', 'face_to_face', auth.uid(), auth.uid())$q$) = '42501',
  'a direct authenticated insert into customers has no grant, even for a caller with customer.manage'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$update public.customers set full_name = 'Tampered' where tenant_id = '10000000-0000-0000-0000-000000000004'$q$) = '42501',
  'a direct authenticated update on customers has no grant'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$insert into public.customer_assessments (tenant_id, customer_id, policy_version_id, facts, result, overall_score, band, dd_level, outcome, next_review_due, correlation_id, input_hash, assessed_by) values ('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000020', '{}', '{}', 0, 'LOW', 'SDD', 'PROCEED', current_date, gen_random_uuid(), 'x', auth.uid())$q$) = '42501',
  'a direct authenticated insert into customer_assessments has no grant'
);
reset role;

reset role;
select pg_temp.assert(
  pg_temp.sqlstate_of($q$update public.customer_assessments set band = 'HIGH' where tenant_id = '10000000-0000-0000-0000-000000000004'$q$) = '23001',
  'a customer assessment cannot be updated, even as superuser (append-only trigger)'
);
select pg_temp.assert(
  pg_temp.sqlstate_of($q$delete from public.customer_assessments where tenant_id = '10000000-0000-0000-0000-000000000004'$q$) = '23001',
  'a customer assessment cannot be deleted, even as superuser (append-only trigger)'
);
select pg_temp.assert(
  pg_temp.sqlstate_of(format(
    $q$update public.customers set external_reference = 'CHANGED' where id = %L$q$, '30000000-0000-0000-0000-000000000001'
  )) = '23001',
  'a customer''s identity (external_reference) is frozen after creation'
);

-- 5. Idempotency and audit atomicity -----------------------------------------
set role authenticated; set local "request.jwt.claim.role" = 'authenticated'; set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
do $$
declare
  v_facts jsonb := (select c -> 'facts' from cra_casebook where c ->> 'id' = 'CB-01');
  v_first public.customer_assessments;
  v_second public.customer_assessments;
begin
  v_first := public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', v_facts, 'e4000000-0000-0000-0000-000000000001');
  v_second := public.run_customer_assessment('10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', v_facts, 'e4000000-0000-0000-0000-000000000001');
  perform pg_temp.assert(v_first.id = v_second.id, 'an identical replay of the same correlation id returns the existing assessment');

  perform pg_temp.assert(
    pg_temp.sqlstate_of(format(
      $q$select public.run_customer_assessment('10000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, %L::jsonb, 'e4000000-0000-0000-0000-000000000001'::uuid)$q$,
      v_facts || '{"purpose": "multipurpose"}'::jsonb
    )) = '23505',
    'the same correlation id with different input is a stable conflict (23505), never a silent overwrite'
  );

  perform pg_temp.assert(
    exists (
      select 1 from public.audit_events
      where action = 'customer.assessed' and target_id = v_first.id::text and correlation_id = 'e4000000-0000-0000-0000-000000000001'
    ),
    'run_customer_assessment records its audit event atomically'
  );
  perform pg_temp.assert(
    (select count(*) from public.customer_assessments where correlation_id = 'e4000000-0000-0000-0000-000000000001') = 1,
    'the conflicting replay attempt created no second row'
  );
  perform pg_temp.assert(
    not exists (
      select 1 from public.audit_events
      where action = 'customer.assessed' and target_id = v_first.id::text
        and (metadata ? 'full_name' or metadata ? 'date_of_birth' or metadata::text ilike '%' || (select full_name from public.customers where id = '30000000-0000-0000-0000-000000000003') || '%')
    ),
    'the audit event carries no personal data (no name, no date of birth)'
  );
end;
$$;

do $$
declare v_customer public.customers;
begin
  v_customer := public.create_customer('10000000-0000-0000-0000-000000000004', 'CUST-IDEMPOTENT-001', 'Idempotent Fixture', '1985-05-05', 'MT', 'MT', 'MT', 'face_to_face');
  perform pg_temp.assert(
    (public.create_customer('10000000-0000-0000-0000-000000000004', 'CUST-IDEMPOTENT-001', 'Idempotent Fixture', '1985-05-05', 'MT', 'MT', 'MT', 'face_to_face')).id = v_customer.id,
    'create_customer replays identically to an idempotent no-op'
  );
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format(
      $q$select public.create_customer('10000000-0000-0000-0000-000000000004', 'CUST-IDEMPOTENT-001', %L, '1985-05-05', 'MT', 'MT', 'MT', 'face_to_face')$q$,
      'Different Name'
    )) = '23505',
    'create_customer with the same reference but different data is a stable conflict (23505)'
  );
  perform pg_temp.assert(
    not exists (select 1 from public.audit_events where action = 'customer.created' and (metadata ? 'full_name' or metadata ? 'date_of_birth')),
    'create_customer''s audit metadata carries no personal data either'
  );
end;
$$;
reset role;

do $$
begin
  raise notice 'Customer assessment verification completed successfully.';
end;
$$;

rollback;

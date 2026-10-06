import { messages } from './messages.ts';
import { humanizeCode } from './customer-assessment.ts';
import {
  NOT_KNOWN_FACTOR_VALUE,
  encodeOverrideValue,
  factorFieldName,
  overrideFieldName,
} from '../domain/customer-assessment-facts.ts';
import type { CraOverrideFactValue, CustomerAssessmentForm } from '../domain/customer-assessment.ts';

// Presentation model of the assessment form returned by
// get_customer_assessment_form(). It only orders and labels what the policy
// lists; the form carries no weights or points, so none can be shown.

const t = messages.customerWorkspace;

export interface FormOptionView {
  value: string;
  label: string;
}

export interface FactorControlView {
  key: string;
  name: string;
  label: string;
  options: FormOptionView[];
  defaultValue: string;
}

export interface CategoryGroupView {
  key: string;
  label: string;
  factors: FactorControlView[];
}

export interface OverrideOptionView extends FormOptionView {
  negative: boolean;
}

export interface OverrideControlView {
  factKey: string;
  name: string;
  label: string;
  required: true;
  provisional: boolean;
  options: OverrideOptionView[];
}

export interface AssessmentFormView {
  policyVersionId: string;
  policyLabel: string;
  categories: CategoryGroupView[];
  overrides: OverrideControlView[];
}

function lookup(catalog: Record<string, string>, key: string): string | null {
  return Object.prototype.hasOwnProperty.call(catalog, key) ? catalog[key] : null;
}

export function factValueLabel(value: CraOverrideFactValue): string {
  const key = String(value);
  return lookup(t.factValues, key) ?? humanizeCode(key);
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function buildAssessmentFormView(form: CustomerAssessmentForm): AssessmentFormView {
  return {
    policyVersionId: form.policyVersionId,
    policyLabel: form.policyLabel,
    categories: [...form.categories].sort(byPosition).map((category) => ({
      key: category.key,
      label: lookup(t.categories, category.key) ?? (category.label.trim() || humanizeCode(category.key)),
      factors: [...category.factors].sort(byPosition).map((factor) => ({
        key: factor.key,
        name: factorFieldName(factor.key),
        label: lookup(t.factors, factor.key) ?? humanizeCode(factor.key),
        defaultValue: NOT_KNOWN_FACTOR_VALUE,
        options: [
          ...factor.values.map((value) => ({ value, label: factValueLabel(value) })),
          { value: NOT_KNOWN_FACTOR_VALUE, label: t.assessmentForm.notKnown },
        ],
      })),
    })),
    overrides: form.overrides.map((override) => ({
      factKey: override.factKey,
      name: overrideFieldName(override.factKey),
      label: lookup(t.overrideFacts, override.factKey) ?? humanizeCode(override.factKey),
      required: true,
      provisional: override.provisional,
      options: override.values.map((value) => ({
        value: encodeOverrideValue(value),
        label: factValueLabel(value),
        negative: value === override.negativeValue,
      })),
    })),
  };
}

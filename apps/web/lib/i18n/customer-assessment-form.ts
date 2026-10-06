import { messages } from './messages.ts';
import { humanizeCode } from './customer-assessment.ts';
import {
  NOT_KNOWN_FACTOR_VALUE,
  encodeFactorValue,
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
  /** The previously submitted answer, when re-rendering after a failed run; otherwise no option is pre-selected. */
  defaultValue: string | null;
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

function submittedOption(
  submitted: Record<string, string> | undefined,
  name: string,
  options: FormOptionView[],
): string | null {
  if (!submitted || !Object.hasOwn(submitted, name)) return null;
  const value = submitted[name];
  return options.some((option) => option.value === value) ? value : null;
}

export function buildAssessmentFormView(form: CustomerAssessmentForm): AssessmentFormView {
  return {
    policyVersionId: form.policyVersionId,
    policyLabel: form.policyLabel,
    categories: [...form.categories].sort(byPosition).map((category) => ({
      key: category.key,
      label: lookup(t.categories, category.key) ?? (category.label.trim() || humanizeCode(category.key)),
      factors: [...category.factors].sort(byPosition).map((factor) => {
        const name = factorFieldName(factor.key);
        const options = [
          ...factor.values.map((value) => ({ value: encodeFactorValue(value), label: factValueLabel(value) })),
          { value: NOT_KNOWN_FACTOR_VALUE, label: t.assessmentForm.notKnown },
        ];
        return {
          key: factor.key,
          name,
          label: lookup(t.factors, factor.key) ?? humanizeCode(factor.key),
          defaultValue: NOT_KNOWN_FACTOR_VALUE,
          options,
        };
      }),
    })),
    overrides: form.overrides.map((override) => {
      const name = overrideFieldName(override.factKey);
      const options = override.values.map((value) => ({
        value: encodeOverrideValue(value),
        label: factValueLabel(value),
        negative: value === override.negativeValue,
      }));
      return {
        factKey: override.factKey,
        name,
        label: lookup(t.overrideFacts, override.factKey) ?? humanizeCode(override.factKey),
        required: true as const,
        provisional: override.provisional,
        options,
        defaultValue: null,
      };
    }),
  };
}

/**
 * Re-applies the values echoed back after a failed run (React 19 resets the form before every Server Action). Only a
 * value matching one of the control's listed options is restored; anything else keeps the control's default.
 */
export function withSubmittedValues(
  view: AssessmentFormView,
  submitted: Record<string, string> | undefined,
): AssessmentFormView {
  if (!submitted) return view;
  return {
    ...view,
    categories: view.categories.map((category) => ({
      ...category,
      factors: category.factors.map((factor) => ({
        ...factor,
        defaultValue: submittedOption(submitted, factor.name, factor.options) ?? factor.defaultValue,
      })),
    })),
    overrides: view.overrides.map((override) => ({
      ...override,
      defaultValue: submittedOption(submitted, override.name, override.options) ?? override.defaultValue,
    })),
  };
}

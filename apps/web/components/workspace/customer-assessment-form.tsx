'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { interpolate, messages } from '@/lib/i18n/messages';
import { customerErrorMessage } from '@/lib/i18n/customer-errors';
import {
  withSubmittedValues,
  type AssessmentFormView,
} from '@/lib/i18n/customer-assessment-form';
import {
  runCustomerAssessmentAction,
  type CustomerActionResult,
} from '@/app/workspace/customers/actions';
import type { TenantId } from '@/lib/domain/ids';

const initialState: CustomerActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = messages.customerWorkspace.assessmentForm;
  return (
    <Button
      type="submit"
      className="h-11 w-full sm:w-auto"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? t.submitting : t.submit}
    </Button>
  );
}

// The assessment form generated from get_customer_assessment_form(). It
// submits facts only; runCustomerAssessmentAction re-reads the form
// server-side and forwards nothing the policy does not list. The
// correlation id comes from the server render, so a double submit replays
// idempotently. After a failed run the form re-mounts (keyed by the attempt)
// with the answers the server echoed back, because React resets it on submit.
export function CustomerAssessmentForm({
  view,
  tenantId,
  customerId,
  correlationId,
}: {
  view: AssessmentFormView;
  tenantId: TenantId;
  customerId: string;
  correlationId: string;
}) {
  const [state, formAction] = useActionState(
    runCustomerAssessmentAction,
    initialState,
  );
  const t = messages.customerWorkspace.assessmentForm;
  const error = state?.status === 'error' ? state : null;
  const shown = withSubmittedValues(view, error?.values);

  return (
    <form
      key={error?.attempt ?? 'initial'}
      action={formAction}
      className="space-y-6 rounded-xl border border-border p-5 sm:p-6"
      aria-labelledby="customer-assessment-form"
      aria-describedby="customer-assessment-form-intro"
    >
      <div className="space-y-2">
        <h2 id="customer-assessment-form" className="text-base font-medium">
          {t.title}
        </h2>
        <p
          id="customer-assessment-form-intro"
          className="max-w-3xl text-sm leading-6 text-muted-foreground"
        >
          {t.intro}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">{t.policyLabel}: </span>
          <span className="font-medium">{shown.policyLabel}</span>
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert" id="customer-assessment-form-error">
          <AlertTitle>{customerErrorMessage(error.code)}</AlertTitle>
          {error.correlationId ? (
            <AlertDescription className="font-mono text-xs break-all">
              {interpolate(t.correlationReference, {
                correlationId: error.correlationId,
              })}
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="correlationId" value={correlationId} />
      <input type="hidden" name="policyVersionId" value={shown.policyVersionId} />

      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-medium">{t.factorsTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.factorsHelp}</p>
        </div>
        {shown.categories.map((category) => (
          <fieldset
            key={category.key}
            className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2"
          >
            <legend className="px-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {category.label}
            </legend>
            {category.factors.map((factor) => (
              <div key={factor.key} className="space-y-2">
                <Label htmlFor={factor.name}>{factor.label}</Label>
                <NativeSelect
                  id={factor.name}
                  name={factor.name}
                  className="h-11 w-full"
                  defaultValue={factor.defaultValue}
                  aria-invalid={error?.field === factor.name ? true : undefined}
                  aria-describedby={
                    error?.field === factor.name ? 'customer-assessment-form-error' : undefined
                  }
                >
                  {factor.options.map((option, index) => (
                    <NativeSelectOption key={`${option.value}-${index}`} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </fieldset>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">{t.overridesTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.overridesHelp}</p>
        </div>
        {shown.overrides.map((override) => (
          <fieldset
            key={override.factKey}
            className="space-y-3 rounded-lg border border-border p-4"
            aria-describedby={
              error?.field === override.name ? 'customer-assessment-form-error' : undefined
            }
          >
            <legend className="flex flex-wrap items-center gap-2 px-1 text-sm font-medium">
              {override.label}
              <span className="text-xs font-normal text-muted-foreground">
                ({messages.customerWorkspace.required})
              </span>
              {override.provisional ? (
                <Badge variant="outline" className="font-normal">
                  {t.provisionalTag}
                </Badge>
              ) : null}
            </legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {override.options.map((option, index) => {
                const id = `${override.name}-${index}`;
                return (
                  <label
                    key={`${option.value}-${index}`}
                    htmlFor={id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      id={id}
                      type="radio"
                      name={override.name}
                      value={option.value}
                      required={override.required}
                      defaultChecked={override.defaultValue === option.value}
                      className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <SubmitButton />
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { messages } from '@/lib/i18n/messages';
import {
  createSupplierAction,
  type SupplierActionResult,
} from '@/app/workspace/suppliers/actions';
import type { TenantId } from '@/lib/domain/ids';

const initialState: SupplierActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="h-11 w-full sm:w-auto"
      disabled={pending}
      aria-busy={pending}
    >
      {pending
        ? messages.supplierWorkspace.submitting
        : messages.supplierWorkspace.submit}
    </Button>
  );
}

// Client form for the real supplier creation flow
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). Submits
// directly to createSupplierAction, a Server Action: this component never
// imports Supabase and never decides authorization itself (the server
// action re-validates tenant + supplier.manage on every submission).
export function SupplierCreateForm({ tenantId }: { tenantId: TenantId }) {
  const [state, formAction] = useActionState(
    createSupplierAction,
    initialState,
  );
  const fields = messages.supplierWorkspace.fields;

  return (
    <form
      className="space-y-6 rounded-xl border border-border p-5 sm:p-6"
      action={formAction}
      noValidate
      aria-describedby="supplier-form-hint"
    >
      <div>
        <h2 className="text-base font-medium">
          {messages.supplierWorkspace.createFormTitle}
        </h2>
        <p
          id="supplier-form-hint"
          className="mt-1 text-sm leading-6 text-muted-foreground"
        >
          {messages.supplierWorkspace.createFormHint}
        </p>
      </div>

      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            {messages.supplierWorkspace.errors[
              state.code as keyof typeof messages.supplierWorkspace.errors
            ] ?? messages.supplierWorkspace.errors.UnknownError}
          </AlertTitle>
        </Alert>
      ) : null}

      <input type="hidden" name="tenantId" value={tenantId} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {messages.supplierWorkspace.identityGroup}
        </legend>
        <div className="space-y-2">
          <Label htmlFor="reference">
            {fields.reference}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input id="reference" name="reference" required maxLength={64} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">
            {fields.displayName}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input id="displayName" name="displayName" required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registrationCountryCode">
            {fields.registrationCountryCode}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input
            id="registrationCountryCode"
            name="registrationCountryCode"
            required
            maxLength={2}
            placeholder="MT"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registrationIdentifier">
            {fields.registrationIdentifier}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input
            id="registrationIdentifier"
            name="registrationIdentifier"
            required
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industryCode">
            {fields.industryCode}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input
            id="industryCode"
            name="industryCode"
            required
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operatingCountryCodes">
            {fields.operatingCountryCodes}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input
            id="operatingCountryCodes"
            name="operatingCountryCodes"
            required
            placeholder="MT, IT"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualExposureMinor">
            {fields.annualExposureMinor}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input
            id="annualExposureMinor"
            name="annualExposureMinor"
            type="number"
            min={0}
            step={1}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualExposureCurrency">
            {fields.annualExposureCurrency}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Input
            id="annualExposureCurrency"
            name="annualExposureCurrency"
            required
            maxLength={3}
            placeholder="EUR"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboardingChannel">
            {fields.onboardingChannel}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <NativeSelect
            id="onboardingChannel"
            name="onboardingChannel"
            className="h-11 w-full"
            defaultValue="assisted"
            required
          >
            {Object.entries(messages.supplierWorkspace.onboardingChannels).map(
              ([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="websiteDomain">{fields.websiteDomain}</Label>
          <Input id="websiteDomain" name="websiteDomain" maxLength={255} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {messages.supplierWorkspace.relationshipGroup}
        </legend>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="relationshipPurpose">
            {fields.relationshipPurpose}{' '}
            <span className="text-muted-foreground">
              ({messages.supplierWorkspace.required})
            </span>
          </Label>
          <Textarea
            id="relationshipPurpose"
            name="relationshipPurpose"
            required
            maxLength={2000}
            rows={3}
          />
        </div>
      </fieldset>

      <SubmitButton />
    </form>
  );
}

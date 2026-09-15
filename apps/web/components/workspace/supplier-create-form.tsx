'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { messages } from '@/lib/i18n/messages';
import { createSupplierAction, type SupplierActionResult } from '@/app/workspace/suppliers/actions';
import type { TenantId } from '@/lib/domain/ids';

const initialState: SupplierActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending} aria-busy={pending}>
      {pending ? messages.supplierWorkspace.submitting : messages.supplierWorkspace.submit}
    </Button>
  );
}

// Client form for the real supplier creation flow
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). Submits
// directly to createSupplierAction, a Server Action: this component never
// imports Supabase and never decides authorization itself (the server
// action re-validates tenant + supplier.manage on every submission).
export function SupplierCreateForm({ tenantId }: { tenantId: TenantId }) {
  const [state, formAction] = useActionState(createSupplierAction, initialState);
  const fields = messages.supplierWorkspace.fields;

  return (
    <form className="space-y-4 border-t border-border pt-4" action={formAction} noValidate>
      <h2 className="text-sm font-medium">{messages.supplierWorkspace.createFormTitle}</h2>
      <p className="text-xs text-muted-foreground">{messages.supplierWorkspace.createFormHint}</p>

      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            {messages.supplierWorkspace.errors[state.code as keyof typeof messages.supplierWorkspace.errors] ??
              messages.supplierWorkspace.errors.UnknownError}
          </AlertTitle>
        </Alert>
      ) : null}

      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reference">{fields.reference}</Label>
          <Input id="reference" name="reference" required maxLength={64} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">{fields.displayName}</Label>
          <Input id="displayName" name="displayName" required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registrationCountryCode">{fields.registrationCountryCode}</Label>
          <Input id="registrationCountryCode" name="registrationCountryCode" required maxLength={2} placeholder="MT" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registrationIdentifier">{fields.registrationIdentifier}</Label>
          <Input id="registrationIdentifier" name="registrationIdentifier" required maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industryCode">{fields.industryCode}</Label>
          <Input id="industryCode" name="industryCode" required maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operatingCountryCodes">{fields.operatingCountryCodes}</Label>
          <Input id="operatingCountryCodes" name="operatingCountryCodes" required placeholder="MT, IT" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualExposureMinor">{fields.annualExposureMinor}</Label>
          <Input id="annualExposureMinor" name="annualExposureMinor" type="number" min={0} step={1} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualExposureCurrency">{fields.annualExposureCurrency}</Label>
          <Input id="annualExposureCurrency" name="annualExposureCurrency" required maxLength={3} placeholder="EUR" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboardingChannel">{fields.onboardingChannel}</Label>
          <NativeSelect id="onboardingChannel" name="onboardingChannel" className="h-11 w-full" defaultValue="assisted" required>
            {Object.entries(messages.supplierWorkspace.onboardingChannels).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="websiteDomain">{fields.websiteDomain}</Label>
          <Input id="websiteDomain" name="websiteDomain" maxLength={255} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="relationshipPurpose">{fields.relationshipPurpose}</Label>
        <Textarea id="relationshipPurpose" name="relationshipPurpose" required maxLength={2000} rows={3} />
      </div>

      <SubmitButton />
    </form>
  );
}

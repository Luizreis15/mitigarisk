'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { messages } from '@/lib/i18n/messages';
import type { CountryOption } from '@/lib/i18n/countries';
import { ONBOARDING_CHANNELS } from '@/lib/domain/customer';
import {
  createCustomerAction,
  type CustomerActionResult,
} from '@/app/workspace/customers/actions';
import type { TenantId } from '@/lib/domain/ids';

const initialState: CustomerActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = messages.customerWorkspace;
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

function RequiredMark() {
  return (
    <span className="text-muted-foreground">
      ({messages.customerWorkspace.required})
    </span>
  );
}

function CountrySelect({
  id,
  label,
  options,
}: {
  id: 'countryOfBirth' | 'nationality' | 'residenceCountry';
  label: string;
  options: CountryOption[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <RequiredMark />
      </Label>
      <NativeSelect
        id={id}
        name={id}
        className="h-11 w-full"
        defaultValue=""
        required
      >
        <NativeSelectOption value="" disabled>
          {messages.customerWorkspace.selectCountry}
        </NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.code} value={option.code}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

// Submits to createCustomerAction, which re-validates tenant and
// customer.manage on every call. Validation messages come from the domain
// validator's typed errors, mapped to catalog copy.
export function CustomerCreateForm({
  tenantId,
  countries,
  cancelHref,
}: {
  tenantId: TenantId;
  countries: CountryOption[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(
    createCustomerAction,
    initialState,
  );
  const t = messages.customerWorkspace;

  return (
    <form
      className="space-y-6 rounded-xl border border-border p-5 sm:p-6"
      action={formAction}
      noValidate
      aria-describedby="customer-form-hint"
    >
      <div>
        <h2 className="text-base font-medium">{t.createFormTitle}</h2>
        <p
          id="customer-form-hint"
          className="mt-1 text-sm leading-6 text-muted-foreground"
        >
          {t.createFormHint}
        </p>
      </div>

      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            {t.errors[state.code as keyof typeof t.errors] ??
              t.errors.UnknownError}
          </AlertTitle>
        </Alert>
      ) : null}

      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="externalReference">
            {t.fields.externalReference} <RequiredMark />
          </Label>
          <Input
            id="externalReference"
            name="externalReference"
            required
            maxLength={100}
            placeholder="CUST-DEMO-010"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">
            {t.fields.fullName} <RequiredMark />
          </Label>
          <Input
            id="fullName"
            name="fullName"
            required
            maxLength={200}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">
            {t.fields.dateOfBirth} <RequiredMark />
          </Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboardingChannel">
            {t.fields.onboardingChannel} <RequiredMark />
          </Label>
          <NativeSelect
            id="onboardingChannel"
            name="onboardingChannel"
            className="h-11 w-full"
            defaultValue="face_to_face"
            required
          >
            {ONBOARDING_CHANNELS.map((channel) => (
              <NativeSelectOption key={channel} value={channel}>
                {t.onboardingChannels[channel]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <CountrySelect
          id="countryOfBirth"
          label={t.fields.countryOfBirth}
          options={countries}
        />
        <CountrySelect
          id="nationality"
          label={t.fields.nationality}
          options={countries}
        />
        <CountrySelect
          id="residenceCountry"
          label={t.fields.residenceCountry}
          options={countries}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton />
        <Button
          variant="ghost"
          className="h-11 w-full sm:w-auto"
          render={<Link href={cancelHref} />}
        >
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

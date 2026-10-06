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
import { customerErrorMessage } from '@/lib/i18n/customer-errors';
import type { CountryOption } from '@/lib/i18n/countries';
import { ONBOARDING_CHANNELS } from '@/lib/domain/customer';
import {
  createCustomerAction,
  type CustomerActionResult,
} from '@/app/workspace/customers/actions';
import type { TenantId } from '@/lib/domain/ids';

const initialState: CustomerActionResult | null = null;
const ERROR_ID = 'customer-form-error';

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

function invalidProps(invalid: boolean) {
  return invalid
    ? { 'aria-invalid': true as const, 'aria-describedby': ERROR_ID }
    : {};
}

function CountrySelect({
  id,
  label,
  options,
  defaultValue,
  invalid,
}: {
  id: 'countryOfBirth' | 'nationality' | 'residenceCountry';
  label: string;
  options: CountryOption[];
  defaultValue: string;
  invalid: boolean;
}) {
  const known = options.some((option) => option.code === defaultValue);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <RequiredMark />
      </Label>
      <NativeSelect
        id={id}
        name={id}
        className="h-11 w-full"
        defaultValue={known ? defaultValue : ''}
        required
        {...invalidProps(invalid)}
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
// customer.manage on every call. Native `required` gives an early hint; the
// domain validator on the server stays the authority. After a failed
// submission the form re-mounts (keyed by the attempt) with the values the
// server echoed back, because React resets the form on submit.
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
  const error = state?.status === 'error' ? state : null;
  const value = (name: string, fallback = '') =>
    error?.values && Object.hasOwn(error.values, name)
      ? error.values[name]
      : fallback;
  const invalid = (name: string) => error?.field === name;
  const channel = value('onboardingChannel', 'face_to_face');

  return (
    <form
      key={error?.attempt ?? 'initial'}
      className="space-y-6 rounded-xl border border-border p-5 sm:p-6"
      action={formAction}
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

      {error ? (
        <Alert variant="destructive" role="alert" id={ERROR_ID}>
          <AlertTitle>{customerErrorMessage(error.code)}</AlertTitle>
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
            placeholder={t.externalReferencePlaceholder}
            autoComplete="off"
            defaultValue={value('externalReference')}
            {...invalidProps(invalid('externalReference'))}
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
            defaultValue={value('fullName')}
            {...invalidProps(invalid('fullName'))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">
            {t.fields.dateOfBirth} <RequiredMark />
          </Label>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            required
            defaultValue={value('dateOfBirth')}
            {...invalidProps(invalid('dateOfBirth'))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboardingChannel">
            {t.fields.onboardingChannel} <RequiredMark />
          </Label>
          <NativeSelect
            id="onboardingChannel"
            name="onboardingChannel"
            className="h-11 w-full"
            defaultValue={
              (ONBOARDING_CHANNELS as readonly string[]).includes(channel)
                ? channel
                : 'face_to_face'
            }
            required
            {...invalidProps(invalid('onboardingChannel'))}
          >
            {ONBOARDING_CHANNELS.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {t.onboardingChannels[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <CountrySelect
          id="countryOfBirth"
          label={t.fields.countryOfBirth}
          options={countries}
          defaultValue={value('countryOfBirth')}
          invalid={invalid('countryOfBirth')}
        />
        <CountrySelect
          id="nationality"
          label={t.fields.nationality}
          options={countries}
          defaultValue={value('nationality')}
          invalid={invalid('nationality')}
        />
        <CountrySelect
          id="residenceCountry"
          label={t.fields.residenceCountry}
          options={countries}
          defaultValue={value('residenceCountry')}
          invalid={invalid('residenceCountry')}
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

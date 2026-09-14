'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon, CheckCircle2Icon } from 'lucide-react';
import { updatePasswordAction, type AuthActionResult } from '@/app/auth-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { messages } from '@/lib/i18n/messages';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full" disabled={pending} aria-busy={pending}>
      {pending ? messages.passwordUpdate.submitting : messages.passwordUpdate.submit}
    </Button>
  );
}

function errorMessage(code: string): string {
  const errors = messages.passwordUpdate.errors as Record<string, string>;
  return errors[code] ?? errors.UnknownAuthError;
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState<AuthActionResult | null, FormData>(
    updatePasswordAction,
    null,
  );

  if (state?.status === 'success') {
    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>{messages.passwordUpdate.successTitle}</AlertTitle>
          <AlertDescription>{messages.passwordUpdate.successBody}</AlertDescription>
        </Alert>
        <Button className="w-full" render={<Link href="/workspace" />}>
          {messages.passwordUpdate.continue}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertTitle>{errorMessage(state.code)}</AlertTitle>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">{messages.passwordUpdate.passwordLabel}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="passwordConfirmation">{messages.passwordUpdate.confirmationLabel}</Label>
        <Input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <SubmitButton />
    </form>
  );
}

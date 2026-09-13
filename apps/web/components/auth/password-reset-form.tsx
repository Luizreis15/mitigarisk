'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { messages } from '@/lib/i18n/messages';
import { passwordResetErrorMessage } from '@/lib/i18n/auth-error-messages';
import { requestPasswordResetAction, type AuthActionResult } from '@/app/auth-actions';

const initialState: AuthActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full" disabled={pending} aria-busy={pending}>
      {pending ? messages.passwordReset.submitting : messages.passwordReset.submit}
    </Button>
  );
}

// Real password-recovery request (docs/tasks/TASK-015-claude-real-auth-route-integration.md).
// The success state is identical whether or not the email matches a real
// account — requestPasswordResetAction never reveals that, matching
// Supabase's own resetPasswordForEmail behavior (no user enumeration).
export function PasswordResetForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);

  if (state?.status === 'success') {
    return (
      <output className="block">
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>{messages.passwordReset.successTitle}</AlertTitle>
          <AlertDescription>{messages.passwordReset.successBody}</AlertDescription>
        </Alert>
      </output>
    );
  }

  return (
    <form className="space-y-4" action={formAction} noValidate>
      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertTitle>{passwordResetErrorMessage(state.code)}</AlertTitle>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">{messages.passwordReset.emailLabel}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required className="h-11" />
      </div>

      <SubmitButton />

      <div className="text-sm">
        <Link href="/" className="underline-offset-4 hover:underline">
          {messages.passwordReset.backToSignIn}
        </Link>
      </div>
    </form>
  );
}

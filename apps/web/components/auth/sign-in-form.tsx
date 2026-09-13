'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircleIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { messages } from '@/lib/i18n/messages';
import { loginErrorMessage } from '@/lib/i18n/auth-error-messages';
import { signInAction, type AuthActionResult } from '@/app/auth-actions';

const initialState: AuthActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full" disabled={pending} aria-busy={pending}>
      {pending ? messages.login.submitting : messages.login.submit}
    </Button>
  );
}

// The real sign-in flow (docs/tasks/TASK-015-claude-real-auth-route-integration.md):
// wired to signInAction (a Server Action over the TASK-013 Supabase
// boundary), with accessible pending/error states. Never resolves any
// identity itself — a successful sign-in redirects server-side to
// /workspace, which re-resolves the session from Supabase, not from
// anything this form holds in memory.
export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <form className="space-y-4" action={formAction} noValidate>
      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertTitle>{loginErrorMessage(state.code)}</AlertTitle>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">{messages.login.emailLabel}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{messages.login.passwordLabel}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
        />
      </div>

      <SubmitButton />

      <div className="text-sm">
        <Link href="/reset-password" className="underline-offset-4 hover:underline">
          {messages.login.recover}
        </Link>
      </div>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon, CheckCircle2Icon, MailPlusIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteMemberAction } from '@/app/workspace/access/actions';
import { interpolate, messages } from '@/lib/i18n/messages';

const t = messages.invitations;
const ROLES = ['operator', 'risk_analyst', 'auditor', 'tenant_admin'] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending} aria-busy={pending}>
      <MailPlusIcon className="size-4" aria-hidden="true" />
      {pending ? t.submitting : t.submit}
    </Button>
  );
}

export function InviteMemberForm({ tenantId }: { tenantId: string }) {
  const [result, action] = useActionState(inviteMemberAction, null);
  const failed = result?.status === 'error' ? result : null;
  const values = failed?.values ?? {};
  const error = failed ? ((t.errors as Record<string, string>)[failed.code] ?? t.errors.default) : null;

  return (
    <section aria-labelledby="invite-title" className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] sm:p-5">
      <div className="space-y-1">
        <h2 id="invite-title" className="text-sm font-semibold">{t.inviteTitle}</h2>
        <p className="text-xs text-muted-foreground">{t.inviteIntro}</p>
      </div>
      {result?.status === 'success' ? (
        <output className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--mitiga-success)_45%,transparent)] bg-[var(--mitiga-risk-low-bg)] px-3 py-2 text-sm">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {interpolate(result.code === 'invited_new' ? t.sentNew : t.sentExisting, { email: result.email })}
        </output>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}
      <form key={result?.attempt ?? 'initial'} action={action} className="space-y-3" noValidate>
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{t.emailLabel}</Label>
          <Input id="invite-email" name="email" type="email" autoComplete="off" required defaultValue={values.email ?? ''} className="h-11" />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t.roleLabel}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map((role) => (
              <label
                key={role}
                aria-label={t.roles[role]}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-[var(--mitiga-petrol-700)] has-[:checked]:bg-[var(--mitiga-mineral-100)]/60"
              >
                <input
                  type="radio"
                  name="roleKey"
                  value={role}
                  defaultChecked={(values.roleKey ?? 'operator') === role}
                  className="mt-0.5 size-4 accent-[var(--mitiga-petrol-700)]"
                />
                <span>
                  <span className="block font-medium">{t.roles[role]}</span>
                  <span className="block text-xs text-muted-foreground">{t.roleHints[role]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Submit />
      </form>
    </section>
  );
}

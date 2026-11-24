'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createTenantAction,
  setMembershipStatusAction,
  setTenantStatusAction,
  type PlatformActionResult,
} from '@/app/platform/actions';
import { messages } from '@/lib/i18n/messages';

const t = messages.platform;

function errorText(result: PlatformActionResult): string | null {
  if (!result) return null;
  return (t.errors as Record<string, string>)[result.code] ?? t.errors.default;
}

function Submit({ label, pendingLabel, variant = 'default' }: { label: string; pendingLabel: string; variant?: 'default' | 'destructive' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className="h-11" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function ErrorAlert({ result }: { result: PlatformActionResult }) {
  const text = errorText(result);
  if (!text) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircleIcon />
      <AlertTitle>{text}</AlertTitle>
    </Alert>
  );
}

export function CreateTenantForm() {
  const [result, action] = useActionState(createTenantAction, null);
  const values = result?.values ?? {};
  return (
    <form key={result?.attempt ?? 'initial'} action={action} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]" noValidate>
      <ErrorAlert result={result} />
      <div className="space-y-2">
        <Label htmlFor="tenant-name">{t.nameLabel}</Label>
        <Input id="tenant-name" name="name" required minLength={2} maxLength={120} defaultValue={values.name ?? ''} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tenant-slug">{t.slugLabel}</Label>
        <Input id="tenant-slug" name="slug" required pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]" defaultValue={values.slug ?? ''} className="h-11" aria-describedby="tenant-slug-hint" />
        <p id="tenant-slug-hint" className="text-xs text-muted-foreground">{t.slugHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tenant-admin">{t.adminEmailLabel}</Label>
        <Input id="tenant-admin" name="adminEmail" type="email" required defaultValue={values.adminEmail ?? ''} className="h-11" aria-describedby="tenant-admin-hint" />
        <p id="tenant-admin-hint" className="text-xs text-muted-foreground">{t.adminEmailHint}</p>
      </div>
      <Submit label={t.create} pendingLabel={t.creating} />
    </form>
  );
}

/** Two-step status change: the button opens a reason field, then confirms. */
export function StatusChangeForm({
  kind,
  tenantId,
  membershipId,
  currentStatus,
  label,
}: {
  kind: 'tenant' | 'membership';
  tenantId: string;
  membershipId?: string;
  currentStatus: string;
  label: string;
}) {
  const [result, action] = useActionState(kind === 'tenant' ? setTenantStatusAction : setMembershipStatusAction, null);
  const [open, setOpen] = useState(false);
  const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
  const destructive = nextStatus === 'suspended';
  const reasonId = `reason-${membershipId ?? tenantId}`;

  if (!open && !result) {
    return (
      <Button type="button" variant={destructive ? 'outline' : 'default'} className="h-9" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form key={result?.attempt ?? 'initial'} action={action} className="w-full space-y-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {membershipId ? <input type="hidden" name="membershipId" value={membershipId} /> : null}
      <input type="hidden" name="status" value={nextStatus} />
      <ErrorAlert result={result} />
      <Label htmlFor={reasonId} className="text-xs">{t.reasonLabel}</Label>
      <Textarea id={reasonId} name="reason" rows={2} required minLength={10} maxLength={500} placeholder={t.reasonPlaceholder} defaultValue={result?.values.reason ?? ''} />
      <div className="flex gap-2">
        <Submit label={`${t.confirm}: ${label}`} pendingLabel={t.saving} variant={destructive ? 'destructive' : 'default'} />
        <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BuildingIcon,
  ClipboardCheckIcon,
  EyeIcon,
  FlaskConicalIcon,
  ShieldCheckIcon,
  UserCogIcon,
} from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { demoSignInAction, unlockDemoSwitcherAction, type DemoActionResult } from '@/app/demo-actions';
import { messages } from '@/lib/i18n/messages';
import type { DemoRole, DemoRoleKey } from '@/lib/demo-switcher';

const t = messages.demoSwitcher;

const roleIcons: Record<DemoRoleKey, typeof BuildingIcon> = {
  tenant_admin: BuildingIcon,
  risk_analyst: ClipboardCheckIcon,
  operator: UserCogIcon,
  auditor: EyeIcon,
  platform_super_admin: ShieldCheckIcon,
};

function errorText(result: DemoActionResult): string | null {
  if (!result) return null;
  return t.errors[result.code];
}

function UnlockButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="h-11 w-full" disabled={pending} aria-busy={pending}>
      {pending ? t.unlocking : t.unlock}
    </Button>
  );
}

function RoleButton({ role }: { role: DemoRole }) {
  const { pending } = useFormStatus();
  const Icon = roleIcons[role.key];
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="group flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{role.label}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{role.description}</span>
      </span>
      <ArrowRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

function RoleForm({ role, action }: { role: DemoRole; action: (formData: FormData) => void }) {
  return (
    <form action={action}>
      <input type="hidden" name="role" value={role.key} />
      <RoleButton role={role} />
    </form>
  );
}

export function DemoRoleSwitcher({ unlocked, roles }: { unlocked: boolean; roles: readonly DemoRole[] }) {
  const [unlockState, unlockAction] = useActionState(unlockDemoSwitcherAction, null);
  const [signInState, signInAction] = useActionState(demoSignInAction, null);
  const error = errorText(unlocked ? signInState : unlockState);

  return (
    <section aria-labelledby="demo-switcher-title" className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <FlaskConicalIcon className="size-4 text-amber-600" aria-hidden="true" />
        <h2 id="demo-switcher-title" className="text-xs font-semibold tracking-[0.08em] uppercase">
          {t.title}
        </h2>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{unlocked ? t.introUnlocked : t.introLocked}</p>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      {unlocked ? (
        <div className="space-y-2">
          {roles.map((role) => (
            <RoleForm key={role.key} role={role} action={signInAction} />
          ))}
        </div>
      ) : (
        <form action={unlockAction} className="space-y-2" noValidate>
          <Label htmlFor="demo-code" className="sr-only">
            {t.codeLabel}
          </Label>
          <Input
            id="demo-code"
            name="code"
            type="password"
            autoComplete="off"
            placeholder={t.codeLabel}
            className="h-11"
          />
          <UnlockButton />
        </form>
      )}
    </section>
  );
}

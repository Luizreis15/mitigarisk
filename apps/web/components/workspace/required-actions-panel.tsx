'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon, CheckCircle2Icon, CircleIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { recordActionCompletionAction } from '@/app/workspace/customers/actions';
import { interpolate, messages } from '@/lib/i18n/messages';

const t = messages.requiredActions;

export interface RequiredActionItem {
  key: string;
  sourceType: 'assessment' | 'transaction_check';
  sourceId: string;
  sourceLabel: string;
  actionCode: string;
  label: string;
  completion: { who: string; date: string; note: string } | null;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-10" disabled={pending} aria-busy={pending}>
      {pending ? t.saving : t.confirm}
    </Button>
  );
}

function CompleteForm({ item, tenantId, customerId, correlationId }: { item: RequiredActionItem; tenantId: string; customerId: string; correlationId: string }) {
  const [result, action] = useActionState(recordActionCompletionAction, null);
  const [open, setOpen] = useState(false);
  const failed = result?.status === 'error' ? result : null;
  if (!open && !failed) {
    return (
      <Button type="button" variant="outline" className="h-9" onClick={() => setOpen(true)}>
        {t.markDone}
      </Button>
    );
  }
  const error = failed ? ((t.errors as Record<string, string>)[failed.code] ?? t.errors.default) : null;
  const noteId = `note-${item.key}`;
  return (
    <form key={failed?.attempt ?? 'initial'} action={action} className="w-full space-y-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="correlationId" value={failed?.correlationId ?? correlationId} />
      <input type="hidden" name="sourceType" value={item.sourceType} />
      <input type="hidden" name="sourceId" value={item.sourceId} />
      <input type="hidden" name="actionCode" value={item.actionCode} />
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}
      <Label htmlFor={noteId} className="text-xs">{t.noteLabel}</Label>
      <Textarea id={noteId} name="evidenceNote" rows={2} minLength={5} maxLength={500} required placeholder={t.notePlaceholder} defaultValue={failed?.values?.evidenceNote ?? ''} />
      <div className="flex gap-2">
        <Submit />
        <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

export function RequiredActionsPanel({
  items,
  canComplete,
  tenantId,
  customerId,
  correlationIds,
}: {
  items: RequiredActionItem[];
  canComplete: boolean;
  tenantId: string;
  customerId: string;
  correlationIds: Record<string, string>;
}) {
  const done = items.filter((item) => item.completion).length;
  return (
    <section id="required-actions" aria-labelledby="required-actions-title" className="scroll-mt-28 space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-1">
          <h2 id="required-actions-title" className="text-sm font-semibold">{t.title}</h2>
          <p className="text-xs text-muted-foreground">{t.intro}</p>
        </div>
        {items.length > 0 ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums">
            {interpolate(t.progress, { done: String(done), total: String(items.length) })}
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 sm:flex-row sm:items-start">
              <span className="mt-0.5 shrink-0">
                {item.completion ? (
                  <CheckCircle2Icon className="size-4 text-[var(--mitiga-success)]" aria-label={t.done} />
                ) : (
                  <CircleIcon className="size-4 text-muted-foreground" aria-label={t.open} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={item.completion ? 'text-sm text-muted-foreground line-through' : 'text-sm font-medium'}>{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sourceLabel}</p>
                {item.completion ? (
                  <p className="mt-1 text-xs">
                    <span className="font-medium">{item.completion.note}</span>
                    <span className="text-muted-foreground"> — {interpolate(t.doneLine, { who: item.completion.who, date: item.completion.date })}</span>
                  </p>
                ) : null}
              </div>
              {!item.completion && canComplete ? (
                <div className="sm:w-80 sm:shrink-0 sm:text-right">
                  <CompleteForm item={item} tenantId={tenantId} customerId={customerId} correlationId={correlationIds[item.key] ?? ''} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

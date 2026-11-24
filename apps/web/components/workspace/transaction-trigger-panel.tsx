'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, CircleDashedIcon, ShieldCheckIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { runTransactionCheckAction } from '@/app/workspace/customers/actions';
import type { TransactionCheck, TriggerStatus } from '@/lib/domain/transaction-check';
import { interpolate, messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

const t = messages.transactionTriggers;

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

const statusStyle: Record<TriggerStatus, { icon: typeof CheckCircle2Icon; chip: string }> = {
  hit: { icon: AlertTriangleIcon, chip: 'bg-[var(--mitiga-risk-high-bg)] text-[var(--mitiga-risk-high-fg)]' },
  clear: { icon: CheckCircle2Icon, chip: 'bg-[var(--mitiga-risk-low-bg)] text-[var(--mitiga-risk-low-fg)]' },
  covered: { icon: ShieldCheckIcon, chip: 'bg-[var(--mitiga-mineral-100)] text-[var(--mitiga-petrol-700)]' },
  not_evaluated: { icon: CircleDashedIcon, chip: 'bg-muted text-muted-foreground' },
};

const GROUPS: Array<{ key: keyof typeof t.groups; fields: Array<keyof typeof t.fields> }> = [
  { key: 'lifetime', fields: ['lifetime_deposits', 'lifetime_withdrawals'] },
  { key: 'rolling', fields: ['deposits_180d'] },
  { key: 'linked', fields: ['linked_deposits', 'linked_withdrawals', 'days_since_registration'] },
  { key: 'sow', fields: ['sow_deposits', 'sow_withdrawals', 'affordability_limit'] },
  { key: 'income', fields: ['deposits_30d', 'declared_monthly_income'] },
];

const lookup = (catalog: Record<string, string>, key: string) => catalog[key] ?? key;
const money = (value: number | null) => (value === null || value === undefined ? '—' : euro.format(value));

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11" disabled={pending} aria-busy={pending}>
      {pending ? t.submitting : t.submit}
    </Button>
  );
}

function CheckResult({ check, who, date }: { check: TransactionCheck; who: string; date: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t.latestTitle}</h3>
        <p className="text-xs text-muted-foreground">{interpolate(t.checkedLine, { date, who })}</p>
      </div>
      <p className={cn('text-sm font-medium', check.hitCount > 0 ? 'text-[var(--mitiga-danger)]' : 'text-[var(--mitiga-risk-low-fg)]')}>
        {check.hitCount > 0 ? interpolate(t.hitsSummary, { count: String(check.hitCount) }) : t.noHits}
      </p>
      <ul className="space-y-2">
        {check.results.map((result) => {
          const style = statusStyle[result.status] ?? statusStyle.not_evaluated;
          const Icon = style.icon;
          return (
            <li key={result.code} className="rounded-lg border border-border px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{lookup(t.rules, result.code)}</p>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', style.chip)}>
                  <Icon className="size-3" aria-hidden="true" />
                  {lookup(t.statuses, result.status)}
                </span>
              </div>
              {result.status !== 'not_evaluated' ? (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {interpolate(t.metricLine, { metric: money(result.metric), threshold: money(result.threshold) })}
                </p>
              ) : null}
              {result.status === 'hit' ? (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-sm">{lookup(t.actions, result.action)}</p>
                  <p className="text-xs text-muted-foreground">{lookup(t.ifNotProvided, result.if_not_provided)}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TransactionTriggerPanel({
  latest,
  latestWho,
  latestDate,
  history,
  canRun,
  tenantId,
  customerId,
  correlationId,
}: {
  latest: TransactionCheck | null;
  latestWho: string;
  latestDate: string;
  history: Array<{ id: string; date: string; hitCount: number }>;
  canRun: boolean;
  tenantId: string;
  customerId: string;
  correlationId: string;
}) {
  const [result, action] = useActionState(runTransactionCheckAction, null);
  const failed = result?.status === 'error' ? result : null;
  const echoed = failed?.values ?? {};
  const errorText = failed ? ((t.errors as Record<string, string>)[failed.code] ?? t.errors.default) : null;

  return (
    <section
      id="transaction-triggers"
      aria-labelledby="transaction-triggers-title"
      className="scroll-mt-28 space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] sm:p-5"
    >
      <div className="space-y-1">
        <h2 id="transaction-triggers-title" className="text-sm font-semibold">{t.title}</h2>
        <p className="text-xs text-muted-foreground">{t.intro}</p>
        <p className="text-xs text-muted-foreground">{interpolate(t.rulesetNote, { version: latest?.rulesetVersion ?? 'MITIGA-GAMBLING-DEFAULT-v1' })}</p>
      </div>

      {latest ? <CheckResult check={latest} who={latestWho} date={latestDate} /> : <p className="text-sm text-muted-foreground">{t.noCheckYet}</p>}

      {canRun ? (
        <form key={failed?.attempt ?? 'initial'} action={action} className="space-y-4 border-t border-border pt-4" noValidate>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="correlationId" value={failed?.correlationId ?? correlationId} />
          <h3 className="text-sm font-semibold">{t.formTitle}</h3>
          {errorText ? (
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon />
              <AlertTitle>{errorText}</AlertTitle>
            </Alert>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {GROUPS.map((group) => (
              <fieldset key={group.key} className="space-y-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-xs font-semibold text-muted-foreground">{t.groups[group.key]}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.fields.map((field) => {
                    const id = `trx-${field}`;
                    const invalid = failed?.field === field;
                    return (
                      <div key={field} className="space-y-1">
                        <Label htmlFor={id} className="text-xs">{t.fields[field]}</Label>
                        <Input
                          id={id}
                          name={field}
                          inputMode={field === 'days_since_registration' ? 'numeric' : 'decimal'}
                          defaultValue={echoed[field] ?? ''}
                          aria-invalid={invalid || undefined}
                          className={cn('h-10 tabular-nums', invalid && 'border-[var(--mitiga-danger)]')}
                        />
                      </div>
                    );
                  })}
                </div>
                {group.key === 'linked' ? (
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="prior_sow_documents"
                      value="true"
                      defaultChecked={echoed.prior_sow_documents === 'true'}
                      className="size-4 accent-[var(--mitiga-petrol-700)]"
                    />
                    {t.fields.prior_sow_documents}
                  </label>
                ) : null}
              </fieldset>
            ))}
          </div>
          <Submit />
        </form>
      ) : null}

      {history.length > 1 ? (
        <div className="space-y-1 border-t border-border pt-3">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.historyTitle}</h3>
          <ul className="space-y-1">
            {history.slice(1).map((entry) => (
              <li key={entry.id} className="flex justify-between text-xs text-muted-foreground">
                <span>{entry.date}</span>
                <span>{entry.hitCount > 0 ? interpolate(t.hitsSummary, { count: String(entry.hitCount) }) : t.noHits}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

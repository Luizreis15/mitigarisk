'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon, CheckCircle2Icon, GavelIcon, HourglassIcon, OctagonXIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { recordCustomerDecisionAction, type CustomerActionResult } from '@/app/workspace/customers/actions';
import {
  DECISION_RATIONALE_MAX,
  allowedDecisions,
  type CustomerDecisionLevel,
  type CustomerDecisionValue,
  type DecisionState,
} from '@/lib/domain/customer-decision';
import { interpolate, messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

const t = messages.customerDecision;

export interface DecisionTrailEntry {
  id: string;
  level: CustomerDecisionLevel;
  decision: CustomerDecisionValue;
  rationale: string;
  who: string;
  date: string;
}

type PendingOrFinal = Exclude<DecisionState, 'not_required'>;

const stateStyle: Record<PendingOrFinal, { icon: typeof GavelIcon; box: string }> = {
  awaiting_mlro: {
    icon: HourglassIcon,
    box: 'border-[color-mix(in_srgb,var(--mitiga-info)_40%,transparent)] bg-[var(--mitiga-mineral-100)]/60',
  },
  awaiting_board: {
    icon: GavelIcon,
    box: 'border-[color-mix(in_srgb,var(--mitiga-warning)_45%,transparent)] bg-[var(--mitiga-risk-medium-bg)]',
  },
  approved: {
    icon: CheckCircle2Icon,
    box: 'border-[color-mix(in_srgb,var(--mitiga-success)_45%,transparent)] bg-[var(--mitiga-risk-low-bg)]',
  },
  rejected: {
    icon: OctagonXIcon,
    box: 'border-[color-mix(in_srgb,var(--mitiga-danger)_45%,transparent)] bg-[var(--mitiga-risk-high-bg)]',
  },
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11" disabled={pending} aria-busy={pending}>
      {pending ? t.submitting : t.submit}
    </Button>
  );
}

function errorText(result: CustomerActionResult | null): string | null {
  if (!result || result.status !== 'error') return null;
  const catalog = t.errors as Record<string, string>;
  return catalog[result.code] ?? t.errors.default;
}

export function CustomerDecisionPanel({
  state,
  pendingLevel,
  trail,
  canDecide,
  tenantId,
  customerId,
  assessmentId,
  correlationId,
}: {
  state: PendingOrFinal;
  pendingLevel: CustomerDecisionLevel | null;
  trail: DecisionTrailEntry[];
  canDecide: boolean;
  tenantId: string;
  customerId: string;
  assessmentId: string;
  correlationId: string;
}) {
  const [result, formAction] = useActionState(recordCustomerDecisionAction, null);
  const previous = result?.status === 'error' ? result.values : undefined;
  const style = stateStyle[state];
  const Icon = style.icon;
  const options = allowedDecisions(pendingLevel);
  const error = errorText(result);

  return (
    <section id="customer-decision" aria-labelledby="customer-decision-title" className="scroll-mt-28 space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)] sm:p-5">
      <div className="space-y-1">
        <h2 id="customer-decision-title" className="text-sm font-semibold">{t.title}</h2>
        <p className="text-xs text-muted-foreground">{t.intro}</p>
      </div>

      <output className={cn('flex items-start gap-3 rounded-lg border px-3 py-3', style.box)}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">{t.states[state]}</p>
          <p className="text-xs text-muted-foreground">{t.stateHints[state]}</p>
        </div>
      </output>

      {trail.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.historyTitle}</h3>
          <ol className="space-y-2">
            {trail.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {interpolate(t.decidedLine, {
                    level: t.levels[entry.level],
                    decision: t.decisionsPast[entry.decision],
                    who: entry.who,
                    date: entry.date,
                  })}
                </p>
                <p className="mt-1 text-sm whitespace-pre-line">{entry.rationale}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {pendingLevel && canDecide ? (
        // Re-mounted after every failed attempt (React resets a form after its
        // action), so the echoed decision and rationale come back checked/filled.
        <form
          key={result?.status === 'error' ? result.attempt : 'initial'}
          action={formAction}
          className="space-y-4 border-t border-border pt-4"
          noValidate
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="correlationId" value={result?.status === 'error' && result.correlationId ? result.correlationId : correlationId} />
          <h3 className="text-sm font-semibold">{interpolate(t.formTitle, { level: t.levels[pendingLevel] })}</h3>

          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.decisionLabel}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {options.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    option === 'reject'
                      ? 'has-[:checked]:border-[var(--mitiga-danger)] has-[:checked]:bg-[var(--mitiga-risk-high-bg)]'
                      : option === 'approve'
                        ? 'has-[:checked]:border-[var(--mitiga-success)] has-[:checked]:bg-[var(--mitiga-risk-low-bg)]'
                        : 'has-[:checked]:border-[var(--mitiga-warning)] has-[:checked]:bg-[var(--mitiga-risk-medium-bg)]',
                  )}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={option}
                    defaultChecked={previous?.decision === option}
                    className="size-4 accent-[var(--mitiga-petrol-700)]"
                    required
                  />
                  {t.decisions[option]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="decision-rationale">{t.rationaleLabel}</Label>
            <Textarea
              id="decision-rationale"
              name="rationale"
              required
              minLength={10}
              maxLength={DECISION_RATIONALE_MAX}
              rows={4}
              defaultValue={previous?.rationale ?? ''}
              aria-describedby="decision-rationale-hint"
            />
            <p id="decision-rationale-hint" className="text-xs text-muted-foreground">{t.rationaleHint}</p>
          </div>

          <SubmitButton />
        </form>
      ) : pendingLevel ? (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">{t.readOnly}</p>
      ) : null}
    </section>
  );
}

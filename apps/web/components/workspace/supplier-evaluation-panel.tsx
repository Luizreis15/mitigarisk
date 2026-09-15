'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';
import {
  runEvaluationAction,
  type SupplierActionResult,
} from '@/app/workspace/suppliers/actions';
import type { TenantId } from '@/lib/domain/ids';
import type { Evaluation, EvaluationReasonCode } from '@/lib/domain/evaluation';
import { CheckCircle2Icon, InfoIcon, LockKeyholeIcon } from 'lucide-react';

const initialState: SupplierActionResult | null = null;

function RunButton() {
  const { pending } = useFormStatus();
  const t = messages.supplierWorkspace.evaluation;
  return (
    <Button
      type="submit"
      className="h-11 w-full sm:w-auto"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? t.running : t.runButton}
    </Button>
  );
}

// Trigger + persisted result view for the one deterministic evaluation this
// slice runs (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md).
// `evaluation`/`reasonCodes` are always server-fetched props from the
// caller's own RLS-scoped read — this component never fetches or infers
// them itself, and a page reload re-renders this from the same persisted
// row (acceptance criterion 11).
export function SupplierEvaluationPanel({
  tenantId,
  supplierId,
  correlationId,
  canRunEvaluation,
  evaluation,
  reasonCodes,
}: {
  tenantId: TenantId;
  supplierId: string;
  correlationId: string;
  canRunEvaluation: boolean;
  evaluation: Evaluation | null;
  reasonCodes: EvaluationReasonCode[];
}) {
  const [state, formAction] = useActionState(runEvaluationAction, initialState);
  const t = messages.supplierWorkspace.evaluation;

  return (
    <section
      aria-labelledby="supplier-evaluation"
      className="space-y-5 rounded-xl border border-border p-5 sm:p-6"
    >
      <div>
        <h2 id="supplier-evaluation" className="text-base font-medium">
          {t.title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.hint}
        </p>
      </div>

      <div
        id="evaluation-boundary"
        className="rounded-xl border border-border bg-muted/30 p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background">
            <LockKeyholeIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          </span>
          <div>
            <h3 className="font-medium">{t.finalDecisionTitle}</h3>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {t.finalDecisionPending}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t.finalDecisionBody}
            </p>
          </div>
        </div>
      </div>

      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            {messages.supplierWorkspace.errors[
              state.code as keyof typeof messages.supplierWorkspace.errors
            ] ?? messages.supplierWorkspace.errors.UnknownError}
          </AlertTitle>
        </Alert>
      ) : null}

      {canRunEvaluation ? (
        <form
          action={formAction}
          className="space-y-2"
          aria-describedby="evaluation-boundary"
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="correlationId" value={correlationId} />
          <RunButton />
        </form>
      ) : null}

      {evaluation && evaluation.status === 'completed' ? (
        <div className="space-y-6">
          <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
              {t.recommendationEyebrow}
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tracking-tight">
                  {evaluation.decisionBand
                    ? t.recommendationValues[evaluation.decisionBand]
                    : '—'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.scoreLabel}:{' '}
                  <span className="font-semibold text-foreground">
                    {evaluation.score}
                  </span>
                </p>
              </div>
              <Badge className="h-7 px-3">
                {evaluation.decisionBand
                  ? t.recommendationValues[evaluation.decisionBand]
                  : '—'}
              </Badge>
            </div>
            <Alert className="mt-5 border-primary/20 bg-background/70">
              <InfoIcon aria-hidden="true" />
              <AlertTitle>{t.recommendationNotice}</AlertTitle>
            </Alert>
          </div>
          <div className="rounded-xl border border-border p-5">
            <h3 className="text-sm font-medium">{t.resultTitle}</h3>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t.qualityLabel}</dt>
                <dd className="mt-1 font-medium">
                  {evaluation.dataQuality
                    ? messages.status.quality[evaluation.dataQuality]
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t.missingFactorsLabel}
                </dt>
                <dd>
                  {evaluation.missingRequiredFactorKeys.length > 0
                    ? evaluation.missingRequiredFactorKeys.join(', ')
                    : t.noneMissing}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.policyLabel}</dt>
                <dd className="font-mono text-xs">
                  {evaluation.policyVersionId}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.correlationLabel}</dt>
                <dd className="font-mono text-xs">
                  {evaluation.correlationId}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t.whenLabel}</dt>
                <dd>{evaluation.completedAt}</dd>
              </div>
            </dl>
          </div>

          {reasonCodes.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t.reasonsTitle}</h4>
              <p className="text-sm text-muted-foreground">{t.reasonsHelp}</p>
              <ul className="space-y-1 text-sm">
                {reasonCodes.map((reason) => (
                  <li
                    key={reason.id}
                    className="rounded-md bg-muted/50 px-3 py-2"
                  >
                    <CheckCircle2Icon
                      aria-hidden="true"
                      className="mr-2 inline size-4 text-primary"
                    />
                    <span className="font-mono text-xs">{reason.code}</span> —{' '}
                    {reason.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-sm font-medium">{t.noEvaluationYet}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t.noEvaluationBody}
          </p>
        </div>
      )}
    </section>
  );
}

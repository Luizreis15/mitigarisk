'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { messages } from '@/lib/i18n/messages';
import { runEvaluationAction, type SupplierActionResult } from '@/app/workspace/suppliers/actions';
import type { TenantId } from '@/lib/domain/ids';
import type { Evaluation, EvaluationReasonCode } from '@/lib/domain/evaluation';

const initialState: SupplierActionResult | null = null;

function RunButton() {
  const { pending } = useFormStatus();
  const t = messages.supplierWorkspace.evaluation;
  return (
    <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending} aria-busy={pending}>
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
    <section aria-labelledby="supplier-evaluation" className="space-y-4 border-t border-border pt-4">
      <h2 id="supplier-evaluation" className="text-sm font-medium">
        {t.title}
      </h2>
      <p className="text-xs text-muted-foreground">{t.hint}</p>

      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            {messages.supplierWorkspace.errors[state.code as keyof typeof messages.supplierWorkspace.errors] ??
              messages.supplierWorkspace.errors.UnknownError}
          </AlertTitle>
        </Alert>
      ) : null}

      {canRunEvaluation ? (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="correlationId" value={correlationId} />
          <RunButton />
        </form>
      ) : null}

      {evaluation && evaluation.status === 'completed' ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">{t.resultTitle}</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t.scoreLabel}</dt>
              <dd>{evaluation.score}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.recommendationLabel}</dt>
              <dd>
                <Badge>{evaluation.decisionBand ? t.recommendationValues[evaluation.decisionBand] : '—'}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.qualityLabel}</dt>
              <dd>{evaluation.dataQuality ? messages.status.quality[evaluation.dataQuality] : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.missingFactorsLabel}</dt>
              <dd>{evaluation.missingRequiredFactorKeys.length > 0 ? evaluation.missingRequiredFactorKeys.join(', ') : t.noneMissing}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.policyLabel}</dt>
              <dd className="font-mono text-xs">{evaluation.policyVersionId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.correlationLabel}</dt>
              <dd className="font-mono text-xs">{evaluation.correlationId}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t.whenLabel}</dt>
              <dd>{evaluation.completedAt}</dd>
            </div>
          </dl>

          {reasonCodes.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">{t.reasonsTitle}</h4>
              <ul className="space-y-1 text-sm">
                {reasonCodes.map((reason) => (
                  <li key={reason.id} className="rounded-md bg-muted/50 px-3 py-2">
                    <span className="font-mono text-xs">{reason.code}</span> — {reason.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.noEvaluationYet}</p>
      )}
    </section>
  );
}

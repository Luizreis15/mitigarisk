'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { recordSupplierFinalDecisionAction, type SupplierActionResult } from '@/app/workspace/suppliers/actions';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Evaluation } from '@/lib/domain/evaluation';
import type { SupplierFinalDecision } from '@/lib/domain/supplier-final-decision';
import type { TenantId } from '@/lib/domain/ids';
import { messages } from '@/lib/i18n/messages';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = messages.supplierWorkspace.finalDecision;
  return <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? t.submitting : t.submit}</Button>;
}

export function SupplierFinalDecisionPanel({ tenantId, supplierId, correlationId, evaluation, decision, canDecide }: {
  tenantId: TenantId; supplierId: string; correlationId: string;
  evaluation: Evaluation | null; decision: SupplierFinalDecision | null; canDecide: boolean;
}) {
  const [state, action] = useActionState(recordSupplierFinalDecisionAction, null as SupplierActionResult | null);
  const t = messages.supplierWorkspace.finalDecision;
  if (evaluation?.status !== 'completed') {
    return <section className="rounded-xl border border-border p-5"><h2 className="font-medium">{t.title}</h2><p className="mt-2 text-sm text-muted-foreground">{t.requiresCompleted}</p></section>;
  }
  return (
    <section aria-labelledby="supplier-final-decision" className="space-y-5 rounded-xl border border-border p-5 sm:p-6">
      <div><h2 id="supplier-final-decision" className="font-medium">{t.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{t.separation}</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-4"><p className="text-xs text-muted-foreground">{t.recommendation}</p><p className="mt-1 font-semibold">{evaluation.decisionBand ? messages.supplierWorkspace.evaluation.recommendationValues[evaluation.decisionBand] : '—'}</p></div>
        <div className="rounded-lg border border-primary/30 p-4"><p className="text-xs text-muted-foreground">{t.decision}</p><p className="mt-1 font-semibold">{decision ? t.values[decision.decision] : t.pending}</p></div>
      </div>
      {decision ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <Badge>{t.recorded}</Badge>
          {decision.rationale ? <div><p className="text-xs text-muted-foreground">{t.rationale}</p><p className="mt-1 whitespace-pre-wrap text-sm">{decision.rationale}</p></div> : null}
          <p className="text-xs text-muted-foreground">{t.recordedAt}: {decision.decidedAt}</p>
          <p className="text-xs text-muted-foreground">{t.immutable}</p>
        </div>
      ) : canDecide ? (
        <form action={action} className="space-y-4">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="evaluationId" value={evaluation.id} />
          <input type="hidden" name="correlationId" value={correlationId} />
          <fieldset className="space-y-2"><legend className="text-sm font-medium">{t.choose}</legend><div className="flex flex-wrap gap-4">{(['approve','review','reject'] as const).map((value) => <Label key={value} className="flex items-center gap-2"><input required type="radio" name="decision" value={value} />{t.values[value]}</Label>)}</div></fieldset>
          <div className="space-y-2"><Label htmlFor="decision-rationale">{t.rationaleOptional}</Label><Textarea id="decision-rationale" name="rationale" maxLength={500} aria-describedby="decision-rationale-help" /><p id="decision-rationale-help" className="text-xs text-muted-foreground">{t.rationaleHelp}</p></div>
          {state?.status === 'error' ? <Alert variant="destructive" role="alert"><AlertTitle>{messages.supplierWorkspace.errors[state.code as keyof typeof messages.supplierWorkspace.errors] ?? messages.supplierWorkspace.errors.UnknownError}</AlertTitle></Alert> : null}
          <SubmitButton />
        </form>
      ) : <div className="rounded-lg bg-muted/40 p-4"><p className="text-sm font-medium">{t.readOnlyTitle}</p><p className="mt-1 text-sm text-muted-foreground">{t.readOnlyBody}</p></div>}
    </section>
  );
}

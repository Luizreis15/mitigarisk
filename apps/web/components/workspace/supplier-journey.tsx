import { CheckIcon } from 'lucide-react';
import { messages } from '@/lib/i18n/messages';

export function SupplierJourney({
  evidenceCount,
  hasEvaluation,
  hasDecision = false,
}: {
  evidenceCount: number;
  hasEvaluation: boolean;
  hasDecision?: boolean;
}) {
  const steps = [
    { label: messages.supplierWorkspace.journey.details, complete: true },
    {
      label: messages.supplierWorkspace.journey.evidence,
      complete: evidenceCount > 0,
    },
    {
      label: messages.supplierWorkspace.journey.evaluation,
      complete: hasEvaluation,
    },
    { label: messages.supplierWorkspace.journey.decision, complete: hasDecision },
  ];

  return (
    <nav
      aria-label={messages.supplierWorkspace.journeyLabel}
      className="overflow-hidden rounded-xl border border-border bg-muted/20 p-4"
    >
      <ol className="grid gap-3 sm:grid-cols-4 sm:gap-2">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="flex min-w-0 items-center gap-3 sm:flex-col sm:items-start"
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${step.complete ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'}`}
            >
              {step.complete ? (
                <CheckIcon aria-hidden="true" className="size-4" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={`text-xs leading-4 ${step.complete ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

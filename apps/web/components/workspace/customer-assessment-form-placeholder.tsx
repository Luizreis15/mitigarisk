import { messages } from '@/lib/i18n/messages';
import { ClipboardListIcon } from 'lucide-react';

// Phase A placeholder only: the generated assessment form (TASK-035 phase B)
// replaces this panel once getCustomerAssessmentForm (TASK-034) lands. It has
// no controls and submits nothing.
export function CustomerAssessmentFormPlaceholder() {
  const t = messages.customerWorkspace;
  return (
    <section
      aria-labelledby="customer-assessment-form-placeholder"
      className="flex gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-5 sm:p-6"
    >
      <ClipboardListIcon
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
      />
      <div>
        <h2
          id="customer-assessment-form-placeholder"
          className="text-base font-medium"
        >
          {t.formPlaceholderTitle}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.formPlaceholderBody}
        </p>
      </div>
    </section>
  );
}

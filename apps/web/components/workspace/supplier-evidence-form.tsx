'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { messages } from '@/lib/i18n/messages';
import { createEvidenceAction, type SupplierActionResult } from '@/app/workspace/suppliers/actions';
import type { TenantId } from '@/lib/domain/ids';

const initialState: SupplierActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = messages.supplierWorkspace.evidence;
  return (
    <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending} aria-busy={pending}>
      {pending ? t.submitting : t.submit}
    </Button>
  );
}

// Client form for registering one fictional evidence metadata entry
// (docs/tasks/TASK-023-claude-real-supplier-evaluation-slice.md). No file
// input exists here on purpose: this slice never uploads a binary file.
export function SupplierEvidenceForm({ tenantId, supplierId }: { tenantId: TenantId; supplierId: string }) {
  const [state, formAction] = useActionState(createEvidenceAction, initialState);
  const t = messages.supplierWorkspace.evidence;

  return (
    <form className="space-y-4 border-t border-border pt-4" action={formAction} noValidate>
      <h3 className="text-sm font-medium">{t.formTitle}</h3>

      {state?.status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            {messages.supplierWorkspace.errors[state.code as keyof typeof messages.supplierWorkspace.errors] ??
              messages.supplierWorkspace.errors.UnknownError}
          </AlertTitle>
        </Alert>
      ) : null}

      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="supplierId" value={supplierId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="evidenceType">{t.typeLabel}</Label>
          <NativeSelect id="evidenceType" name="evidenceType" className="h-11 w-full" required defaultValue="incorporation_record">
            {Object.entries(t.types).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="evidenceDisplayName">{t.displayNameLabel}</Label>
          <Input id="evidenceDisplayName" name="displayName" required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuerCountryCode">{t.issuerCountryLabel}</Label>
          <Input id="issuerCountryCode" name="issuerCountryCode" maxLength={2} placeholder="MT" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issueDate">{t.issueDateLabel}</Label>
          <Input id="issueDate" name="issueDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="verificationState">{t.verificationStateLabel}</Label>
          <NativeSelect id="verificationState" name="verificationState" className="h-11 w-full" required defaultValue="provided">
            {Object.entries(t.verificationStates).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

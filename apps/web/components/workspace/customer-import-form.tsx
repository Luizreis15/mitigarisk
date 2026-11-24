'use client';

import Link from 'next/link';
import { useActionState, useRef, type ChangeEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2Icon, DownloadIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { interpolate, messages } from '@/lib/i18n/messages';
import { customerErrorMessage } from '@/lib/i18n/customer-errors';
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  type ImportFileProblem,
  type ImportOutcome,
  type ImportRowProblem,
} from '@/lib/domain/customer-import';
import {
  importCustomersAction,
  type CustomerImportResult,
} from '@/app/workspace/customers/actions';
import type { TenantId } from '@/lib/domain/ids';

const initialState: CustomerImportResult | null = null;
const TEMPLATE_HREF = '/templates/customers-import-template.csv';
const PROBLEMS_ID = 'customer-import-problems';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = messages.customerWorkspace.importing;
  return (
    <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending} aria-busy={pending}>
      {pending ? t.submitting : t.submit}
    </Button>
  );
}

function fileProblemMessage(problem: ImportFileProblem): string {
  const template = customerErrorMessage(problem.code);
  switch (problem.code) {
    case 'ImportTooManyRowsError':
      return interpolate(template, { rows: problem.rows, max: IMPORT_MAX_ROWS });
    case 'ImportMissingColumnsError':
      return interpolate(template, { columns: problem.columns.join(', ') });
    case 'ImportMalformedError':
      return interpolate(template, { line: problem.line });
    default:
      return template;
  }
}

const tableClass = 'w-full min-w-[32rem] text-left text-sm';
const headClass = 'border-b border-border px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase';
const cellClass = 'border-b border-border/60 px-3 py-2 align-top';

function RowProblems({ problems, totalRows }: { problems: ImportRowProblem[]; totalRows: number }) {
  const t = messages.customerWorkspace.importing;
  return (
    <Alert variant="destructive" role="alert" id={PROBLEMS_ID} className="scroll-mt-24">
      <AlertTitle>{interpolate(t.rowProblemsTitle, { count: problems.length, total: totalRows })}</AlertTitle>
      <AlertDescription>
        <p>{t.rowProblemsBody}</p>
        <div className="mt-3 max-h-80 w-full overflow-auto rounded-md border border-border bg-card text-foreground">
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={headClass}>{t.lineHeader}</th>
                <th scope="col" className={headClass}>{t.columnProblemHeader}</th>
                <th scope="col" className={headClass}>{t.problemHeader}</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem, index) => (
                <tr key={`${problem.line}-${index}`}>
                  <td className={`${cellClass} font-mono tabular-nums`}>{problem.line}</td>
                  <td className={`${cellClass} font-mono`}>{problem.column ?? t.wholeLine}</td>
                  <td className={cellClass}>{customerErrorMessage(problem.code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function SkippedLines({ title, lines }: { title: string; lines: ImportOutcome['conflicts'] }) {
  const t = messages.customerWorkspace.importing;
  if (lines.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-destructive">{interpolate(title, { count: lines.length })}</h3>
      <div className="max-h-64 overflow-auto rounded-md border border-border">
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={headClass}>{t.lineHeader}</th>
              <th scope="col" className={headClass}>{t.referenceHeader}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((item, index) => (
              <tr key={`${item.externalReference}-${index}`}>
                <td className={`${cellClass} font-mono tabular-nums`}>{item.line ?? messages.customerWorkspace.emptyValue}</td>
                <td className={`${cellClass} font-mono`}>{item.externalReference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportDone({ outcome, listHref, importHref }: { outcome: ImportOutcome; listHref: string; importHref: string }) {
  const t = messages.customerWorkspace.importing;
  return (
    <section
      className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] sm:p-7"
      aria-labelledby="customer-import-done"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-[var(--risk-low)]" aria-hidden="true" />
        <div className="space-y-1">
          <h2 id="customer-import-done" className="text-lg font-medium tracking-tight">{t.doneTitle}</h2>
          <p className="text-sm leading-6">{interpolate(t.created, { count: outcome.created })}</p>
          {outcome.unchanged > 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">{interpolate(t.unchanged, { count: outcome.unchanged })}</p>
          ) : null}
          {outcome.created > 0 ? <p className="text-sm leading-6 text-muted-foreground">{t.nextStep}</p> : null}
        </div>
      </div>

      <SkippedLines title={t.conflictsTitle} lines={outcome.conflicts} />
      <SkippedLines title={t.rejectedTitle} lines={outcome.rejected} />

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <Button className="h-11 w-full sm:w-auto" render={<Link href={listHref} />}>
          {t.viewCustomers}
        </Button>
        {/* A full navigation, so the form starts empty again. */}
        <a href={importHref} className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 w-full sm:w-auto')}>
          {t.importAnother}
        </a>
      </div>
    </section>
  );
}

// Submits CSV text to importCustomersAction, which re-proves tenant and
// customer.manage, validates every line with the single-customer validator
// and only then writes. The file input never reaches the server: it fills
// the text area in the browser, so what is sent is exactly what is shown.
export function CustomerImportForm({ tenantId, listHref }: { tenantId: TenantId; listHref: string }) {
  const [state, formAction] = useActionState(importCustomersAction, initialState);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const t = messages.customerWorkspace;
  const i = t.importing;

  if (state?.status === 'imported') {
    return (
      <ImportDone
        outcome={state.outcome}
        listHref={listHref}
        importHref={`/workspace/customers/import?tenant=${tenantId}`}
      />
    );
  }

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !textRef.current) return;
    textRef.current.value = await file.text();
  };

  const hasProblems = state !== null;

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] sm:p-7">
        <div className="space-y-3">
          <h2 className="text-lg font-medium tracking-tight">{i.stepsTitle}</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
            {i.steps.map((step, index) => (
              <li key={`step-${index}`}>{step}</li>
            ))}
          </ol>
          <a href={TEMPLATE_HREF} download className={cn(buttonVariants({ variant: 'outline' }), 'h-10')}>
            <DownloadIcon aria-hidden="true" />
            {i.template}
          </a>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">{i.columnsTitle}</h3>
          <div className="overflow-auto rounded-md border border-border">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={headClass}>{i.columnHeader}</th>
                  <th scope="col" className={headClass}>{i.columnRule}</th>
                </tr>
              </thead>
              <tbody>
                {IMPORT_COLUMNS.map((column) => (
                  <tr key={column}>
                    <td className={`${cellClass} font-mono whitespace-nowrap`}>{column}</td>
                    <td className={`${cellClass} text-muted-foreground`}>{i.columns[column]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">{interpolate(i.limit, { max: IMPORT_MAX_ROWS })}</p>
        </div>
      </section>

      <form
        key={state?.attempt ?? 'initial'}
        className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] sm:p-7"
        action={formAction}
      >
        {state?.status === 'file_problem' ? (
          <Alert variant="destructive" role="alert" id={PROBLEMS_ID} className="scroll-mt-24">
            <AlertTitle>{i.fileProblemTitle}</AlertTitle>
            <AlertDescription>{fileProblemMessage(state.problem)}</AlertDescription>
          </Alert>
        ) : null}
        {state?.status === 'row_problems' ? (
          <RowProblems problems={state.problems} totalRows={state.totalRows} />
        ) : null}
        {state?.status === 'error' ? (
          <Alert variant="destructive" role="alert" id={PROBLEMS_ID} className="scroll-mt-24">
            <AlertTitle>{customerErrorMessage(state.code)}</AlertTitle>
          </Alert>
        ) : null}

        <input type="hidden" name="tenantId" value={tenantId} />

        <div className="space-y-2">
          <Label htmlFor="customer-import-file" className="text-sm font-medium">{i.fileLabel}</Label>
          <Input
            id="customer-import-file"
            type="file"
            accept=".csv,text/csv,text/plain"
            className="h-11 min-h-11 sm:max-w-md"
            aria-describedby="customer-import-file-hint"
            onChange={onFileChosen}
          />
          <p id="customer-import-file-hint" className="text-sm text-muted-foreground">{i.fileHint}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="csvText" className="text-sm font-medium">
            {i.textLabel} <span className="text-muted-foreground">({t.required})</span>
          </Label>
          <Textarea
            ref={textRef}
            id="csvText"
            name="csvText"
            required
            rows={10}
            spellCheck={false}
            autoComplete="off"
            placeholder={i.textPlaceholder}
            className="font-mono text-xs leading-5 whitespace-pre"
            defaultValue={state?.text ?? ''}
            {...(hasProblems ? { 'aria-invalid': true as const, 'aria-describedby': PROBLEMS_ID } : {})}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <SubmitButton />
          <Button variant="ghost" className="h-11 min-h-11 w-full sm:w-auto" render={<Link href={listHref} />}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </div>
  );
}

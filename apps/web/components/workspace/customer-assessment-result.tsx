import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CustomerBandBadge } from '@/components/workspace/customer-band-badge';
import { messages, interpolate } from '@/lib/i18n/messages';
import type { AssessmentResultView } from '@/lib/i18n/customer-assessment';
import {
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  InfoIcon,
  OctagonXIcon,
} from 'lucide-react';

// Reusable presentation of one persisted CRA result (also intended for the
// later audit pack). Receives an already-built view of the stored result
// jsonb; it renders values exactly as persisted and never calculates any of
// them.
export function CustomerAssessmentResult({
  view,
  headingId = 'customer-assessment-result',
}: {
  view: AssessmentResultView;
  headingId?: string;
}) {
  const t = messages.customerWorkspace.result;

  return (
    <div className="space-y-6">
      {view.isReject ? (
        <Alert variant="destructive" role="alert">
          <OctagonXIcon aria-hidden="true" />
          <AlertTitle>{t.rejectTitle}</AlertTitle>
          <AlertDescription>
            <p>{t.rejectBody}</p>
            {view.overrides.length > 0 ? (
              <>
                <p className="mt-2 font-medium">{t.rejectReasonsLabel}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {view.overrides.map((override) => (
                    <li key={override.code}>{override.label}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-5 sm:p-6">
        <p
          id={headingId}
          className="text-xs font-semibold tracking-[0.12em] text-primary uppercase"
        >
          {t.eyebrow}
        </p>
        <div className="mt-3 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            <p className="text-sm text-muted-foreground">{t.overallScoreLabel}</p>
            <p className="text-4xl font-semibold tracking-tight">
              {view.overallScoreText}
              <span className="sr-only">
                {' '}
                {interpolate(t.scoreOutOf, { score: view.overallScoreText })}
              </span>
              <span aria-hidden="true" className="text-base font-normal text-muted-foreground">
                {' '}/ 100
              </span>
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t.bandLabel}</dt>
              <dd className="mt-1">
                <CustomerBandBadge band={view.band} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.ddLevelLabel}</dt>
              <dd className="mt-1 font-medium">{view.ddLevelLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.outcomeLabel}</dt>
              <dd
                className={
                  view.isReject
                    ? 'mt-1 font-semibold text-destructive'
                    : 'mt-1 font-medium'
                }
              >
                {view.outcomeLabel}
              </dd>
            </div>
          </dl>
        </div>
        <Alert className="mt-5 border-primary/20 bg-background/70">
          <InfoIcon aria-hidden="true" />
          <AlertTitle>{t.classificationNotice}</AlertTitle>
          <AlertDescription>{t.databaseNotice}</AlertDescription>
        </Alert>
      </div>

      <section aria-labelledby={`${headingId}-approvals`} className="space-y-3">
        <h3 id={`${headingId}-approvals`} className="text-sm font-medium">
          {t.approvalsTitle}
        </h3>
        {view.approvals.length > 0 ? (
          <ul className="space-y-2">
            {view.approvals.map((approval) => (
              <li
                key={approval.code}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ClockIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                  {approval.label}
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge variant="outline">{t.approvalPending}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t.approvalNotActionable}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noApprovals}</p>
        )}
      </section>

      <section aria-labelledby={`${headingId}-categories`} className="space-y-3">
        <h3 id={`${headingId}-categories`} className="text-sm font-medium">
          {t.categoryScoresTitle}
        </h3>
        <ul className="space-y-3">
          {view.categoryScores.map((category) => (
            <li key={category.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span aria-hidden="true">{category.label}</span>
                <span aria-hidden="true" className="font-medium tabular-nums">
                  {category.scoreText}
                </span>
                <span className="sr-only">
                  {interpolate(t.categoryScoreAria, {
                    category: category.label,
                    score: category.scoreText,
                  })}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${category.barPercent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${headingId}-overrides`} className="space-y-3">
        <h3 id={`${headingId}-overrides`} className="text-sm font-medium">
          {t.overridesTitle}
        </h3>
        {view.overrides.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">{t.overridesHelp}</p>
            <ul className="space-y-2">
              {view.overrides.map((override) => (
                <li
                  key={override.code}
                  className="rounded-lg border border-border px-4 py-3 text-sm"
                >
                  {override.label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noOverrides}</p>
        )}
      </section>

      <section aria-labelledby={`${headingId}-actions`} className="space-y-3">
        <h3 id={`${headingId}-actions`} className="text-sm font-medium">
          {t.requiredActionsTitle}
        </h3>
        <p className="text-sm text-muted-foreground">{t.requiredActionsHelp}</p>
        <ul className="space-y-2">
          {view.requiredActions.map((action) => (
            <li key={action.code} className="flex items-start gap-2 text-sm">
              <CircleIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              {action.label}
            </li>
          ))}
        </ul>
      </section>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-border p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t.nextReviewLabel}</dt>
          <dd className="mt-1 font-medium">{view.nextReviewDueText}</dd>
          <dd className="text-xs text-muted-foreground">
            {interpolate(t.reviewCycle, { months: view.reviewMonths })}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.assessedAtLabel}</dt>
          <dd className="mt-1">{view.assessedAtText}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.policyLabel}</dt>
          <dd className="mt-1 break-all font-mono text-xs">{view.policyVersionId}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.correlationLabel}</dt>
          <dd className="mt-1 break-all font-mono text-xs">{view.correlationId}</dd>
        </div>
      </dl>

      <details className="group rounded-xl border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          {t.whyTitle}
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="space-y-5 border-t border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">{t.whyHelp}</p>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t.missingFactorsTitle}</h4>
            {view.missingFactors.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">{t.missingFactorsHelp}</p>
                <ul className="space-y-1 text-sm">
                  {view.missingFactors.map((factor) => (
                    <li key={factor.code}>
                      {factor.label}{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        ({factor.code})
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t.noMissingFactors}</p>
            )}
          </div>
          {view.overrides.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t.overridesTitle}</h4>
              <ul className="flex flex-wrap gap-2">
                {view.overrides.map((override) => (
                  <li key={override.code}>
                    <code className="rounded-md bg-muted/60 px-2 py-1 font-mono text-xs">
                      {override.code}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t.reasonCodesTitle}</h4>
            <ul className="flex flex-wrap gap-2">
              {view.reasonCodes.map((code) => (
                <li key={code}>
                  <code className="rounded-md bg-muted/60 px-2 py-1 font-mono text-xs break-all">
                    {code}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

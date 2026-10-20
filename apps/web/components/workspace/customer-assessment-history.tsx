import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CustomerBandBadge } from '@/components/workspace/customer-band-badge';
import { messages } from '@/lib/i18n/messages';
import { ddLevelShortLabel, outcomeLabel } from '@/lib/i18n/customer-assessment';
import { formatDateTime, formatNumber } from '@/lib/i18n/presentation';
import type { CustomerAssessment } from '@/lib/domain/customer-assessment';

function shortId(id: string): string {
  return id.slice(0, 8);
}

// Persisted assessment history, newest first as read from the database.
// "Assessed by" shows the caller as "You"; other users are identified by a
// short id because no profile read path exists for this slice. The policy
// label is known only for the current policy (from the assessment form);
// other versions show a short id.
export function CustomerAssessmentHistory({
  assessments,
  currentUserId,
  currentPolicy = null,
}: {
  assessments: CustomerAssessment[];
  currentUserId: string;
  currentPolicy?: { id: string; label: string } | null;
}) {
  const t = messages.customerWorkspace;
  const columns = t.historyColumns;
  const assessedBy = (assessment: CustomerAssessment) =>
    assessment.assessedBy === currentUserId ? t.assessedByYou : shortId(assessment.assessedBy);
  const policy = (assessment: CustomerAssessment) =>
    currentPolicy && assessment.policyVersionId === currentPolicy.id
      ? currentPolicy.label
      : shortId(assessment.policyVersionId);

  return (
    <section aria-labelledby="customer-assessment-history" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="customer-assessment-history" className="text-sm font-semibold">
          {t.historyTitle}
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">{assessments.length}</p>
      </div>

      {assessments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-4 text-xs">{columns.date}</TableHead>
                  <TableHead className="h-10 text-xs">{columns.policy}</TableHead>
                  <TableHead className="h-10 text-xs">{columns.score}</TableHead>
                  <TableHead className="h-10 text-xs">{columns.band}</TableHead>
                  <TableHead className="h-10 text-xs">{columns.ddLevel}</TableHead>
                  <TableHead className="h-10 text-xs">{columns.outcome}</TableHead>
                  <TableHead className="h-10 text-xs">{columns.assessedBy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow key={assessment.id} className="h-12">
                    <TableCell className="px-4 py-2 text-sm whitespace-nowrap">
                      {formatDateTime(assessment.assessedAt)}
                    </TableCell>
                    <TableCell
                      className="py-2 text-xs"
                      title={assessment.policyVersionId}
                    >
                      {policy(assessment)}
                    </TableCell>
                    <TableCell className="py-2 tabular-nums">
                      {formatNumber(assessment.overallScore)}
                    </TableCell>
                    <TableCell className="py-2">
                      <CustomerBandBadge band={assessment.band} />
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline">
                        {ddLevelShortLabel(assessment.ddLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={
                        assessment.outcome === 'REJECT'
                          ? 'py-2 font-medium text-destructive'
                          : 'py-2'
                      }
                    >
                      {outcomeLabel(assessment.outcome)}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {assessedBy(assessment)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-0 md:hidden">
            {assessments.map((assessment) => (
              <li
                key={assessment.id}
                className="border-l-[3px] border-l-[var(--mitiga-petrol-700)]/70 border-b border-b-border px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatDateTime(assessment.assessedAt)}
                  </span>
                  <CustomerBandBadge band={assessment.band} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {outcomeLabel(assessment.outcome)}
                  {' · '}
                  {ddLevelShortLabel(assessment.ddLevel)}
                  {' · '}
                  {formatNumber(assessment.overallScore)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

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
    <section
      aria-labelledby="customer-assessment-history"
      className="space-y-4 rounded-xl border border-border p-5 sm:p-6"
    >
      <h2 id="customer-assessment-history" className="text-base font-medium">
        {t.historyTitle}
      </h2>
      {assessments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{columns.date}</TableHead>
                  <TableHead>{columns.policy}</TableHead>
                  <TableHead>{columns.score}</TableHead>
                  <TableHead>{columns.band}</TableHead>
                  <TableHead>{columns.ddLevel}</TableHead>
                  <TableHead>{columns.outcome}</TableHead>
                  <TableHead>{columns.assessedBy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>{formatDateTime(assessment.assessedAt)}</TableCell>
                    <TableCell className="text-xs" title={assessment.policyVersionId}>
                      {policy(assessment)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatNumber(assessment.overallScore)}
                    </TableCell>
                    <TableCell>
                      <CustomerBandBadge band={assessment.band} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ddLevelShortLabel(assessment.ddLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={
                        assessment.outcome === 'REJECT'
                          ? 'font-medium text-destructive'
                          : undefined
                      }
                    >
                      {outcomeLabel(assessment.outcome)}
                    </TableCell>
                    <TableCell className="text-xs">{assessedBy(assessment)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {assessments.map((assessment) => (
              <li
                key={assessment.id}
                className="space-y-2 rounded-xl border border-border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatDateTime(assessment.assessedAt)}
                  </span>
                  <CustomerBandBadge band={assessment.band} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <dt className="text-muted-foreground">{columns.score}</dt>
                    <dd className="tabular-nums">
                      {formatNumber(assessment.overallScore)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{columns.ddLevel}</dt>
                    <dd>{ddLevelShortLabel(assessment.ddLevel)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">{columns.outcome}</dt>
                    <dd
                      className={
                        assessment.outcome === 'REJECT'
                          ? 'font-medium text-destructive'
                          : undefined
                      }
                    >
                      {outcomeLabel(assessment.outcome)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{columns.policy}</dt>
                    <dd className="text-xs break-words">{policy(assessment)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{columns.assessedBy}</dt>
                    <dd className="text-xs">{assessedBy(assessment)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

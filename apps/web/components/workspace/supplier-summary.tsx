import { messages } from '@/lib/i18n/messages';
import type { Supplier } from '@/lib/domain/supplier';
import { Badge } from '@/components/ui/badge';

function formatExposure(supplier: Supplier): string {
  const majorUnits = (supplier.annualExposureMinor / 100).toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
  return `${supplier.annualExposureCurrency} ${majorUnits}`;
}

export function SupplierSummary({ supplier }: { supplier: Supplier }) {
  const t = messages.supplierWorkspace;
  return (
    <section
      aria-labelledby="supplier-summary"
      className="space-y-4 rounded-xl border border-border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="supplier-summary" className="text-base font-medium">
          {t.summaryTitle}
        </h2>
        <Badge variant="outline">{t.statusValues[supplier.status]}</Badge>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.reference}</dt>
          <dd className="mt-1 break-words font-mono text-xs">
            {supplier.reference}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t.fields.registrationCountryCode}
          </dt>
          <dd>{supplier.registrationCountryCode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t.fields.registrationIdentifier}
          </dt>
          <dd>{supplier.registrationIdentifier}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.fields.industryCode}</dt>
          <dd>{supplier.industryCode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.operatingCountriesLabel}</dt>
          <dd>{supplier.operatingCountryCodes.join(', ')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.exposureLabel}</dt>
          <dd>{formatExposure(supplier)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.onboardingChannelLabel}</dt>
          <dd>{t.onboardingChannels[supplier.onboardingChannel]}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">
            {t.relationshipPurposeLabel}
          </dt>
          <dd>{supplier.relationshipPurpose}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">{t.recordedLabel}</dt>
          <dd>{supplier.createdAt}</dd>
        </div>
      </dl>
    </section>
  );
}

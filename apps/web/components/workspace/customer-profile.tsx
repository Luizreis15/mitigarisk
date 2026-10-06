import { Badge } from '@/components/ui/badge';
import { messages } from '@/lib/i18n/messages';
import { countryName } from '@/lib/i18n/countries';
import { customerStatusLabel, onboardingChannelLabel } from '@/lib/i18n/customer';
import { formatDate, formatDateTime } from '@/lib/i18n/presentation';
import type { Customer } from '@/lib/domain/customer';

function CountryValue({ code }: { code: string }) {
  return (
    <>
      {countryName(code)}{' '}
      <span className="font-mono text-xs text-muted-foreground">({code})</span>
    </>
  );
}

export function CustomerProfile({ customer }: { customer: Customer }) {
  const t = messages.customerWorkspace;
  return (
    <section
      aria-labelledby="customer-profile"
      className="space-y-4 rounded-xl border border-border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="customer-profile" className="text-base font-medium">
          {t.profileTitle}
        </h2>
        <Badge variant="outline">{customerStatusLabel(customer.status)}</Badge>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.fields.externalReference}</dt>
          <dd className="mt-1 break-words font-mono text-xs">
            {customer.externalReference}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.fields.fullName}</dt>
          <dd className="mt-1 break-words">{customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.fields.dateOfBirth}</dt>
          <dd className="mt-1">{formatDate(customer.dateOfBirth)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.fields.onboardingChannel}</dt>
          <dd className="mt-1">{onboardingChannelLabel(customer.onboardingChannel)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.fields.countryOfBirth}</dt>
          <dd className="mt-1">
            <CountryValue code={customer.countryOfBirth} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.fields.nationality}</dt>
          <dd className="mt-1">
            <CountryValue code={customer.nationality} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.fields.residenceCountry}</dt>
          <dd className="mt-1">
            <CountryValue code={customer.residenceCountry} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.recordedLabel}</dt>
          <dd className="mt-1">{formatDateTime(customer.createdAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

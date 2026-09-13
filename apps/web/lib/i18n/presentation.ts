export type Iso4217Currency = string;
export type IanaTimeZone = string;
export type Bcp47Locale = string;

export type PresentationConfig = {
  locale: Bcp47Locale;
  timeZone: IanaTimeZone;
  currency: Iso4217Currency;
  currencyMinorDigits: number;
};

export const defaultPresentation: PresentationConfig = {
  locale: 'en-US',
  timeZone: 'UTC',
  currency: 'USD',
  currencyMinorDigits: 2,
};

export function formatDateTime(
  isoUtc: string,
  config: PresentationConfig = defaultPresentation,
) {
  return new Intl.DateTimeFormat(config.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: config.timeZone,
  }).format(new Date(isoUtc));
}

export function formatNumber(
  value: number,
  config: PresentationConfig = defaultPresentation,
) {
  return new Intl.NumberFormat(config.locale).format(value);
}

export function formatPercent(
  value: number,
  config: PresentationConfig = defaultPresentation,
) {
  return new Intl.NumberFormat(config.locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatCurrencyFromMinorUnits(
  minorUnits: number,
  config: PresentationConfig = defaultPresentation,
) {
  const major = minorUnits / 10 ** config.currencyMinorDigits;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
  }).format(major);
}

export function formatScore(score: number, max = 100) {
  return `${score}/${max}`;
}

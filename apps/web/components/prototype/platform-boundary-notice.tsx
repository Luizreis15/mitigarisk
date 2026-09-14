import { messages } from '@/lib/i18n/messages';

export function PlatformBoundaryNotice() {
  return (
    <section
      aria-labelledby="platform-boundary"
      className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h2 id="platform-boundary" className="text-base font-semibold">
        {messages.platformGovernance.boundaryTitle}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        {messages.platformGovernance.boundaryBody}
      </p>
      <h3 className="text-sm font-medium">{messages.platformGovernance.contextsTitle}</h3>
      <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
        <li>{messages.platformGovernance.contextPlatform}</li>
        <li>{messages.platformGovernance.contextCompany}</li>
        <li>{messages.platformGovernance.contextOperator}</li>
      </ul>
    </section>
  );
}

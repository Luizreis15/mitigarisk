import { messages } from '@/lib/i18n/messages';

export function ConceptSeparationNotice() {
  return (
    <section
      aria-labelledby="intake-concepts"
      className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h2 id="intake-concepts" className="text-base font-semibold">
        {messages.entityIntake.conceptsTitle}
      </h2>
      <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
        <li>{messages.entityIntake.factsConcept}</li>
        <li>{messages.entityIntake.qualityConcept}</li>
        <li>{messages.entityIntake.recommendationConcept}</li>
        <li>{messages.entityIntake.decisionConcept}</li>
      </ul>
    </section>
  );
}

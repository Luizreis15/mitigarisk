'use client';

import { Suspense, useId, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { AppShell } from '@/components/prototype/app-shell';
import { ConceptSeparationNotice } from '@/components/prototype/concept-separation-notice';
import {
  EntityIntakeLoadingFallback,
  EntityIntakeStateView,
} from '@/components/prototype/entity-intake-state';
import { QualityStatus } from '@/components/prototype/status-badge';
import { usePrototypeFeedback } from '@/components/prototype/use-prototype-feedback';
import {
  type ActivityBand,
  type EntityRelationship,
  type EvaluationIntakeValues,
  type FactProvenance,
  type OperationalChannel,
  canStartEvaluation,
  companyEvaluateCapabilities,
  emptyIntakeValues,
  entityHref,
  getEntity,
  getIntakePolicy,
  intakeQuality,
  intakeTenant,
  northstarEntities,
  northstarIntakePolicies,
  parseIntakeState,
  publishedIntakePolicies,
  valuesFromEntity,
} from '@/lib/demo/entity-intake';
import { interpolate, messages } from '@/lib/i18n/messages';
import { presentation } from '@/lib/demo/data';

type IntakeStep = 'edit' | 'review' | 'done';

export default function NewEvaluationPage() {
  return (
    <Suspense fallback={<EntityIntakeLoadingFallback />}>
      <NewEvaluationContent />
    </Suspense>
  );
}

function NewEvaluationContent() {
  const params = useSearchParams();
  const state = parseIntakeState(params.get('state'));
  const capabilities = companyEvaluateCapabilities();
  const notify = usePrototypeFeedback();
  const formId = useId();
  const requestedEntity = getEntity(params.get('entity'));
  const [step, setStep] = useState<IntakeStep>('edit');
  const [values, setValues] = useState<EvaluationIntakeValues>(() =>
    requestedEntity ? valuesFromEntity(requestedEntity) : emptyIntakeValues(),
  );
  const [showErrors, setShowErrors] = useState(false);

  const quality = intakeQuality(values);
  const selectedPolicy = getIntakePolicy(values.policyId);
  const errors = useMemo(() => collectErrors(values), [values]);
  const hasErrors = Object.keys(errors).length > 0;

  function update<K extends keyof EvaluationIntakeValues>(
    key: K,
    value: EvaluationIntakeValues[K],
  ) {
    setValues((current) => {
      if (key === 'entityId' && typeof value === 'string') {
        const entity = getEntity(value);
        return entity ? valuesFromEntity(entity) : { ...current, entityId: value };
      }
      return { ...current, [key]: value };
    });
  }

  const workspace = {
    name: intakeTenant.name,
    environment: intakeTenant.environment,
    policyVersion: intakeTenant.policyVersion,
  };

  if (state === 'denied' || !canStartEvaluation(capabilities)) {
    return (
      <AppShell view="company" capabilities={capabilities} workspace={workspace}>
        <EntityIntakeStateView state="denied" retryHref="/evaluations/new" />
      </AppShell>
    );
  }

  if (state !== 'ready') {
    return (
      <AppShell view="company" capabilities={capabilities} workspace={workspace}>
        <EntityIntakeStateView state={state} retryHref="/evaluations/new" />
      </AppShell>
    );
  }

  return (
    <AppShell view="company" capabilities={capabilities} workspace={workspace}>
      <div className="grid max-w-3xl gap-6">
        <section className="rounded-2xl bg-[image:var(--gradient-shell)] p-6 text-white">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-white/70">
            {messages.entityIntake.kicker}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.2] font-semibold">
            {messages.entityIntake.intakeTitle}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {messages.entityIntake.intakeIntro}
          </p>
        </section>

        <ConceptSeparationNotice />

        {step === 'edit' ? (
          <Card>
            <CardHeader>
              <CardTitle>{messages.entityIntake.intakeTitle}</CardTitle>
              <CardDescription>{messages.entityIntake.policyHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (hasErrors) {
                    setShowErrors(true);
                    return;
                  }
                  setShowErrors(false);
                  setStep('review');
                }}
              >
                <Field
                  id={`${formId}-entity`}
                  label={messages.entityIntake.entityLabel}
                  error={showErrors ? errors.entityId : undefined}
                >
                  <NativeSelect
                    id={`${formId}-entity`}
                    className="h-11 w-full"
                    value={values.entityId}
                    aria-invalid={showErrors && Boolean(errors.entityId)}
                    onChange={(event) => update('entityId', event.target.value)}
                  >
                    {northstarEntities.map((entity) => (
                      <NativeSelectOption key={entity.id} value={entity.id}>
                        {entity.displayName} · {entity.reference}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                <Field
                  id={`${formId}-name`}
                  label={messages.entityIntake.displayName}
                  required
                  error={showErrors ? errors.displayName : undefined}
                >
                  <Input
                    id={`${formId}-name`}
                    className="h-11"
                    value={values.displayName}
                    aria-invalid={showErrors && Boolean(errors.displayName)}
                    onChange={(event) => update('displayName', event.target.value)}
                  />
                </Field>

                <Field
                  id={`${formId}-ref`}
                  label={messages.entityIntake.reference}
                  required
                  error={showErrors ? errors.reference : undefined}
                >
                  <Input
                    id={`${formId}-ref`}
                    className="h-11"
                    value={values.reference}
                    aria-invalid={showErrors && Boolean(errors.reference)}
                    onChange={(event) => update('reference', event.target.value)}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`${formId}-rel`} label={messages.entityIntake.relationship}>
                    <NativeSelect
                      id={`${formId}-rel`}
                      className="h-11 w-full"
                      value={values.relationship}
                      onChange={(event) =>
                        update('relationship', event.target.value as EntityRelationship)
                      }
                    >
                      {(Object.keys(messages.entityIntake.relationships) as EntityRelationship[]).map(
                        (key) => (
                          <NativeSelectOption key={key} value={key}>
                            {messages.entityIntake.relationships[key]}
                          </NativeSelectOption>
                        ),
                      )}
                    </NativeSelect>
                  </Field>
                  <Field id={`${formId}-channel`} label={messages.entityIntake.channel}>
                    <NativeSelect
                      id={`${formId}-channel`}
                      className="h-11 w-full"
                      value={values.channel}
                      onChange={(event) =>
                        update('channel', event.target.value as OperationalChannel)
                      }
                    >
                      {(Object.keys(messages.entityIntake.channels) as OperationalChannel[]).map(
                        (key) => (
                          <NativeSelectOption key={key} value={key}>
                            {messages.entityIntake.channels[key]}
                          </NativeSelectOption>
                        ),
                      )}
                    </NativeSelect>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`${formId}-band`} label={messages.entityIntake.activityBand}>
                    <NativeSelect
                      id={`${formId}-band`}
                      className="h-11 w-full"
                      value={values.activityBand}
                      onChange={(event) =>
                        update('activityBand', event.target.value as ActivityBand)
                      }
                    >
                      {(Object.keys(messages.entityIntake.activityBands) as ActivityBand[]).map(
                        (key) => (
                          <NativeSelectOption key={key} value={key}>
                            {messages.entityIntake.activityBands[key]}
                          </NativeSelectOption>
                        ),
                      )}
                    </NativeSelect>
                  </Field>
                  <Field id={`${formId}-prov`} label={messages.entityIntake.provenance}>
                    <NativeSelect
                      id={`${formId}-prov`}
                      className="h-11 w-full"
                      value={values.provenance}
                      onChange={(event) =>
                        update('provenance', event.target.value as FactProvenance)
                      }
                    >
                      {(
                        Object.keys(
                          messages.entityIntake.provenanceValues,
                        ) as FactProvenance[]
                      ).map((key) => (
                        <NativeSelectOption key={key} value={key}>
                          {messages.entityIntake.provenanceValues[key]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>

                <Field
                  id={`${formId}-facts`}
                  label={messages.entityIntake.declaredFacts}
                  required
                  error={showErrors ? errors.declaredFacts : undefined}
                >
                  <Textarea
                    id={`${formId}-facts`}
                    className="min-h-28"
                    value={values.declaredFacts}
                    aria-invalid={showErrors && Boolean(errors.declaredFacts)}
                    onChange={(event) => update('declaredFacts', event.target.value)}
                  />
                </Field>

                <Field
                  id={`${formId}-policy`}
                  label={messages.entityIntake.policyChoice}
                  required
                  error={showErrors ? errors.policyId : undefined}
                >
                  <NativeSelect
                    id={`${formId}-policy`}
                    className="h-11 w-full"
                    value={values.policyId}
                    aria-invalid={showErrors && Boolean(errors.policyId)}
                    onChange={(event) => update('policyId', event.target.value)}
                  >
                    {northstarIntakePolicies.map((policy) => (
                      <NativeSelectOption
                        key={policy.id}
                        value={policy.id}
                        disabled={policy.lifecycle !== 'published'}
                      >
                        {policy.id} · v{policy.versionNumber} ·{' '}
                        {messages.entityIntake.policyLifecycle[policy.lifecycle]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                <p className="text-sm text-muted-foreground">
                  {messages.entityIntake.presentationHint}{' '}
                  {interpolate(messages.presentation.summary, {
                    timeZone: presentation.timeZone,
                    currency: presentation.currency,
                    locale: presentation.locale,
                  })}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {messages.entityIntake.completeness}
                  </span>
                  <QualityStatus quality={quality} />
                </div>

                {showErrors && hasErrors ? (
                  <p className="text-sm text-destructive" role="alert">
                    {messages.entityIntake.validationTitle}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" className="h-11">
                    {messages.entityIntake.review}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    render={<Link href="/entities" />}
                  >
                    {messages.entityIntake.listTitle}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11"
                    render={<Link href="/company" />}
                  >
                    {messages.flow.backCompany}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {step === 'review' ? (
          <Card>
            <CardHeader>
              <CardTitle>{messages.entityIntake.reviewTitle}</CardTitle>
              <CardDescription>{messages.entityIntake.reviewIntro}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <Row label={messages.entityIntake.displayName} value={values.displayName} />
              <Row label={messages.entityIntake.reference} value={values.reference} />
              <Row
                label={messages.entityIntake.relationship}
                value={messages.entityIntake.relationships[values.relationship]}
              />
              <Row
                label={messages.entityIntake.channel}
                value={messages.entityIntake.channels[values.channel]}
              />
              <Row
                label={messages.entityIntake.activityBand}
                value={messages.entityIntake.activityBands[values.activityBand]}
              />
              <Row
                label={messages.entityIntake.provenance}
                value={messages.entityIntake.provenanceValues[values.provenance]}
              />
              <Row
                label={messages.entityIntake.policyChoice}
                value={
                  selectedPolicy
                    ? `${selectedPolicy.id} · v${selectedPolicy.versionNumber}`
                    : values.policyId
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {messages.entityIntake.completeness}
                </span>
                <QualityStatus quality={quality} />
              </div>
              <div>
                <p className="text-muted-foreground">{messages.entityIntake.declaredFacts}</p>
                <p className="mt-1 leading-6">{values.declaredFacts}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-11"
                  onClick={() => {
                    notify(
                      messages.entityIntake.toastTitle,
                      messages.entityIntake.toastBody,
                    );
                    setStep('done');
                  }}
                >
                  {messages.entityIntake.submit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setStep('edit')}
                >
                  {messages.entityIntake.backToEdit}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 'done' ? (
          <Acknowledgement
            entityId={values.entityId}
            exampleEvaluationId={getEntity(values.entityId)?.exampleEvaluationId}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function Acknowledgement({
  entityId,
  exampleEvaluationId,
}: {
  entityId: string;
  exampleEvaluationId: string | null | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.entityIntake.ackTitle}</CardTitle>
        <CardDescription>{messages.entityIntake.ackBody}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {messages.entityIntake.exampleResultHint}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-11"
            render={
              <Link href={`/evaluations/${exampleEvaluationId ?? 'ev_10461'}`} />
            }
          >
            {messages.entityIntake.exampleResult}
          </Button>
          <Button
            variant="secondary"
            className="h-11"
            render={<Link href={entityHref(entityId)} />}
          >
            {messages.entityIntake.openRecord}
          </Button>
          <Button variant="outline" className="h-11" render={<Link href="/entities" />}>
            {messages.entityIntake.listTitle}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function collectErrors(values: EvaluationIntakeValues) {
  const errors: Partial<Record<keyof EvaluationIntakeValues, string>> = {};
  if (!values.entityId) errors.entityId = messages.entityIntake.validationEntity;
  if (!values.displayName.trim()) {
    errors.displayName = messages.entityIntake.validationName;
  }
  if (!values.reference.trim()) {
    errors.reference = messages.entityIntake.validationReference;
  }
  if (values.declaredFacts.trim().length < 24) {
    errors.declaredFacts = messages.entityIntake.validationFacts;
  }
  if (!publishedIntakePolicies().some((item) => item.id === values.policyId)) {
    errors.policyId = messages.entityIntake.validationPolicy;
  }
  return errors;
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-muted-foreground"> · {messages.entityIntake.required}</span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

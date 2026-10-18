'use client';

import Link from 'next/link';
import { accessBadge, checkoutChoices, type CourseAccessMode } from '@/lib/institution-commerce';

const chip = 'min-h-11 rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function AccessBadge({ mode }: { mode: CourseAccessMode }) {
  const badge = accessBadge(mode);
  return (
    <span className="inline-flex max-w-full flex-col rounded-2xl border border-border bg-card px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">{badge.title}</span>
      <span className="text-sm text-muted-foreground">{badge.detail}</span>
    </span>
  );
}

export function CheckoutChoice({
  mode,
  value,
  onChange,
}: {
  mode: CourseAccessMode;
  value: 'subscription' | 'a_la_carte';
  onChange: (choice: 'subscription' | 'a_la_carte') => void;
}) {
  const choices = checkoutChoices(mode);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="group" aria-label="How to pay for this course">
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={value === choice}
          onClick={() => onChange(choice)}
          className={`${chip} ${value === choice ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
        >
          {choice === 'subscription' ? 'Subscription' : 'A la carte, lifetime'}
        </button>
      ))}
    </div>
  );
}

export function FeeSummary() {
  const rows = [
    ['Independent student', 'Pays their level plan and monthly Sparks'],
    ['Parent', 'Free. Sees only their own children'],
    ['Second independent child', '30% off that child\'s plan'],
    ['Independent teacher', 'Teacher plan. Marketplace sales pay out through Stripe Connect'],
    ['Institution', 'Pays per student seat. Teachers and parents are free staff'],
    ['Marketplace', 'Card, wallet, or an institution invoice. Sparks cannot buy it'],
  ];
  return (
    <dl className="overflow-hidden rounded-2xl border border-border text-sm">
      {rows.map(([who, bill]) => (
        <div key={who} className="border-t border-border px-4 py-3 first:border-t-0 sm:grid sm:grid-cols-2 sm:gap-4">
          <dt className="font-semibold">{who}</dt>
          <dd className="mt-1 text-muted-foreground sm:mt-0">{bill}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OnboardingList({ steps }: { steps: { id: string; label: string; done: boolean; href?: string }[] }) {
  const done = steps.filter((step) => step.done).length;
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">{done} of {steps.length} complete.</p>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${step.done ? 'bg-success' : 'bg-muted'}`} />
            {step.href ? <Link href={step.href} className="font-medium underline-offset-2 hover:underline">{step.label}</Link> : <span>{step.label}</span>}
            <span className="sr-only">{step.done ? ', done' : ', not done'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

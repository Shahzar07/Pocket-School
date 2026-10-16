'use client';

import { accessBadge, checkoutChoices, type CourseAccessMode } from '@/lib/institution-commerce';

export function AccessBadge({ mode }: { mode: CourseAccessMode }) {
  const badge = accessBadge(mode);
  return (
    <span className="inline-flex flex-col rounded-2xl border border-border bg-card px-3 py-2">
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
    <div className="flex flex-wrap gap-2" role="group" aria-label="How to pay for this course">
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          onClick={() => onChange(choice)}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${value === choice ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
        >
          {choice === 'subscription' ? 'Subscription' : 'A la carte · lifetime'}
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
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([who, bill]) => (
            <tr key={who} className="border-t border-border first:border-t-0">
              <th className="px-4 py-3 text-left font-semibold">{who}</th>
              <td className="px-4 py-3 text-muted-foreground">{bill}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OnboardingList({ steps }: { steps: { id: string; label: string; done: boolean }[] }) {
  const done = steps.filter((step) => step.done).length;
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">{done} of {steps.length} complete.</p>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-muted'}`} />
            {step.label}
          </li>
        ))}
      </ol>
    </section>
  );
}

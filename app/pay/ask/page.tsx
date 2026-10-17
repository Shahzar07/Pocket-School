import Link from 'next/link';

/** Parent landing for a child's ask-to-pay notice. */
export default function PayAskPage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Billing</p>
      <h1 className="font-heading text-4xl text-foreground">A child asked for a plan</h1>
      <p className="text-sm text-muted-foreground">
        Approve and pay from family billing, or decline. The child never sees a payment form.
      </p>
      <Link
        href="/dashboard/parent/billing"
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        Open family billing
      </Link>
    </main>
  );
}

import Link from 'next/link';
import { ManageSubscription } from '@/components/billing/manage-subscription';

/** Stripe fix-payment link from a renewal or failed-payment notice. */
export default function PayFixPage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Billing</p>
      <h1 className="font-heading text-4xl text-foreground">Update a payment</h1>
      <p className="text-sm text-muted-foreground">
        Stripe subscribers open the customer portal. Apple and Google subscriptions are managed in the store. A child does not enter payment details here.
      </p>
      <ManageSubscription returnPath="/dashboard/parent/billing" />
      <p className="text-sm text-muted-foreground">
        Apple: <a className="underline" href="https://apps.apple.com/account/subscriptions">apps.apple.com/account/subscriptions</a>
        {' · '}
        Google: <a className="underline" href="https://play.google.com/store/account/subscriptions">play.google.com/store/account/subscriptions</a>
      </p>
      <Link href="/dashboard/parent/billing" className="inline-flex text-sm font-semibold text-primary underline">
        Family billing
      </Link>
    </main>
  );
}

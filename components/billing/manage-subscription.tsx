'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';

/** Opens the Stripe customer portal, or the Apple / Google subscription page. */
export function ManageSubscription({ returnPath = '/dashboard', institutionId }: { returnPath?: string; institutionId?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void authedFetch('/api/billing/portal', {
          method: 'POST',
          body: JSON.stringify({ returnPath, institutionId }),
        }).then((data) => {
          const url = typeof data.url === 'string' ? data.url : '';
          if (!url) {
            toast.error(typeof data.error === 'string' ? data.error : 'Billing could not be opened.');
            return;
          }
          window.location.href = url;
        }).catch((error: unknown) => {
          toast.error(error instanceof Error ? error.message : 'Billing could not be opened.');
        }).finally(() => setBusy(false));
      }}
    >
      {busy ? 'Opening…' : 'Manage subscription'}
    </button>
  );
}

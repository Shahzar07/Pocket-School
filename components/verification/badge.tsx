import { tierLabel } from '@/lib/verification/policy';

/** Profile mark for the server-written verification tier. */
export function VerificationBadge({ tier }: { tier: number }) {
  return (
    <span className="mt-3 inline-flex min-h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-bold text-foreground">
      {tierLabel(tier)}
    </span>
  );
}

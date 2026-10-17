'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

function analyticsAllowed(): boolean {
  try {
    const raw = localStorage.getItem('poket-cookie-consent');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { analytics?: boolean };
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

/** Fires only after the visitor has allowed analytics on the rest of the site. */
export function trackOfferCta(id: string, href: string) {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  const detail = { event: 'reads_offer_cta', id, href };
  const host = window as Window & { dataLayer?: unknown[] };
  if (Array.isArray(host.dataLayer)) host.dataLayer.push(detail);
  window.dispatchEvent(new CustomEvent('poket-analytics', { detail }));
}

const VARIANTS = {
  /**
   * Electric cyan fill. White on #3FE0D0 is 1.6:1, so the label is dark ink
   * (8.0:1). The blue border keeps the control at 3:1 against a white card.
   * Hover #14B8A6 still holds dark ink at 5.3:1. That darker cyan is 2.5:1
   * on white, so it is not used as text.
   */
  primary: 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337] hover:bg-[#14B8A6]',
  secondary: 'bg-primary text-primary-foreground',
  quiet: 'border border-border bg-card text-foreground',
} as const;

export function OfferCta({
  href,
  id,
  children,
  variant = 'primary',
}: {
  href: string;
  id: string;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-analytics-id={id}
      onClick={() => trackOfferCta(id, href)}
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-center text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83] ${VARIANTS[variant]}`}
    >
      {children}
    </Link>
  );
}

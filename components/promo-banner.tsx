'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bannerCopy, type PromoDraft } from '@/lib/promos';

interface BannerPromo extends PromoDraft {
  code: string;
  remaining: number;
}

export function PromoBanner() {
  const [copy, setCopy] = useState<string | null>(null);
  const [href, setHref] = useState('/pricing');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch('/api/promos')
      .then((response) => response.json())
      .then((data: { promos?: BannerPromo[] }) => {
        const first = data.promos?.[0];
        if (!first) return;
        const text = bannerCopy({
          item: first.item,
          kind: first.kind,
          percentOff: first.percentOff,
          quantityLimit: first.remaining,
          redeemed: 0,
          endsAt: first.endsAt,
          banner: true,
        }, today);
        if (!text) return;
        setCopy(text);
        setHref(`/r/${encodeURIComponent(first.code)}`);
      })
      .catch(() => undefined);
  }, []);

  if (!copy) return null;
  return (
    <Link href={href} className="block bg-foreground text-background text-center text-sm font-semibold px-4 py-2">
      {copy}
    </Link>
  );
}

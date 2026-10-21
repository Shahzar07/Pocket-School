'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bannerCopy, type PromoDraft } from '@/lib/promos';
import { CloseControl, useLayerDismiss } from '@/components/ui/close-control';
import { dismissPromo, isPromoDismissed } from '@/lib/ui/dismissed-promos';

interface BannerPromo extends PromoDraft {
  code: string;
  remaining: number;
}

export function PromoBanner() {
  const [copy, setCopy] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [href, setHref] = useState('/pricing');
  const [hidden, setHidden] = useState(false);

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
        if (!text || isPromoDismissed(first.code)) return;
        setCode(first.code);
        setCopy(text);
        setHref(`/r/${encodeURIComponent(first.code)}`);
      })
      .catch(() => undefined);
  }, []);

  const visible = Boolean(copy) && !hidden;
  const dismiss = () => {
    if (code) dismissPromo(code);
    setHidden(true);
  };
  useLayerDismiss(visible, dismiss);

  if (!visible || !copy) return null;
  return (
    <div className="relative bg-foreground text-background" data-promo-banner="1">
      <Link href={href} className="block px-14 py-2 text-center text-sm font-semibold">
        {copy}
      </Link>
      <CloseControl
        onClose={dismiss}
        className="absolute top-1/2 right-1 -translate-y-1/2 text-background hover:bg-background/15 focus-visible:ring-offset-foreground"
      />
    </div>
  );
}

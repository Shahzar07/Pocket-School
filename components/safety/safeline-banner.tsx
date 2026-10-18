'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/api-client';
import type { BannerSnapshot } from '@/lib/safety/banner';

const EMPTY: BannerSnapshot = { show: false, count: 0, oldestLabel: '', href: '' };

export function SafeLineBanner({ snapshot }: { snapshot?: BannerSnapshot }) {
  const [live, setLive] = useState<BannerSnapshot>(snapshot ?? EMPTY);

  useEffect(() => {
    if (snapshot) {
      setLive(snapshot);
      return;
    }
    let stop = false;
    const load = () => {
      authedFetch('/api/safety/banner')
        .then((data) => {
          if (stop) return;
          setLive({
            show: data.show === true,
            count: typeof data.count === 'number' ? data.count : 0,
            oldestLabel: typeof data.oldestLabel === 'string' ? data.oldestLabel : '',
            href: typeof data.href === 'string' && data.href ? data.href : '/dashboard/admin/hotline',
          });
        })
        .catch(() => {
          if (!stop) setLive(EMPTY);
        });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [snapshot]);

  if (!live.show || live.count < 1) return null;
  const noun = live.count === 1 ? 'ticket' : 'tickets';
  return (
    <aside className="rounded-[20px] border-[3px] border-[#1E6A83] bg-white px-4 py-4 text-[#203337]" role="status">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">Poket SafeLine</p>
      <p className="mt-1 font-heading text-2xl">{live.count} open emergency or high-priority {noun}</p>
      <p className="mt-1 text-sm">Oldest timer: {live.oldestLabel}</p>
      <Link href={live.href} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]">
        Open Poket SafeLine
      </Link>
    </aside>
  );
}

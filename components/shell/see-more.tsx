'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Keeps a dashboard to one focus, and reveals the rest on request. */
export function SeeMore({
  label = 'See more',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-primary hover:bg-secondary"
      >
        {open ? 'Show less' : label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="mt-3 space-y-4">{children}</div>}
    </div>
  );
}

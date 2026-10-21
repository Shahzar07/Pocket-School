'use client';

import type { ReactNode } from 'react';

/** A tool workspace that fills the studio shell. No centred page, no dashboard card. */
export function StudioCanvas({
  canvas,
  title,
  description,
  actions,
  children,
}: {
  canvas: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden" data-studio-fill="1" data-studio-canvas={canvas}>
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--studio-border-soft)] px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl tracking-tight text-[var(--studio-text)] sm:text-3xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--studio-dim)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
    </div>
  );
}

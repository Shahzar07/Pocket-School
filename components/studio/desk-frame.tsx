import type { ReactNode } from 'react';

/** Shared heading for an ET AI Studio mode. */
export function DeskFrame({
  kicker,
  title,
  blurb,
  testId,
  children,
}: {
  kicker: string;
  title: string;
  blurb: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 overflow-auto bg-background text-foreground" data-testid={testId}>
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">ET AI · Poket School</p>
        <h1 className="mt-1 font-heading text-3xl tracking-[-0.04em] text-foreground">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{blurb}</p>
        <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{kicker}</p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

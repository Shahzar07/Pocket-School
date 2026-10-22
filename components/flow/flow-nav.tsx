'use client';

import Link from 'next/link';
import { flowCopy } from '@/lib/flow/copy';
import { useDockHeight } from '@/components/shell/dock-height';

export function FlowNav({
  backHref,
  nextHref,
  onBack,
  onNext,
  backDisabled = false,
  nextDisabled = false,
  backLabel = flowCopy.back,
  nextLabel = flowCopy.next,
  aboveActions = false,
}: {
  backHref?: string;
  nextHref?: string;
  onBack?: () => void;
  onNext?: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  backLabel?: string;
  nextLabel?: string;
  /** On a phone, sit in a fixed row above the lesson action bar. */
  aboveActions?: boolean;
}) {
  const dockRef = useDockHeight('quiz');
  const backClass = 'inline-flex h-11 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] disabled:opacity-40 dark:border-[#3FE0D0] dark:text-[#3FE0D0]';
  const nextClass = 'inline-flex h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-40';
  const showBackLink = Boolean(backHref) && !backDisabled;
  const showNextLink = Boolean(nextHref) && !nextDisabled;
  const place = aboveActions
    ? 'max-lg:fixed max-lg:inset-x-0 max-lg:z-[31] max-lg:bg-card max-lg:px-3 max-lg:bottom-[calc(4rem+env(safe-area-inset-bottom)+var(--ps-lesson-dock,0px))] lg:sticky lg:bottom-0 lg:z-30'
    : 'sticky bottom-0 z-30';
  return (
    <div ref={aboveActions ? dockRef : undefined} data-flow-nav className={`mt-auto flex w-full max-w-full flex-wrap items-center justify-between gap-3 border-t border-border bg-[var(--studio-bg,#F4FBFC)]/95 px-1 py-3 backdrop-blur dark:bg-[#121E22]/95 ${place}`}>
      {showBackLink ? (
        <Link href={backHref!} className={backClass} aria-label={backLabel} onClick={onBack}>← {backLabel}</Link>
      ) : (
        <button type="button" className={backClass} disabled={backDisabled || !onBack} aria-label={backLabel} onClick={onBack}>← {backLabel}</button>
      )}
      {showNextLink ? (
        <Link href={nextHref!} className={nextClass} aria-label={nextLabel} onClick={onNext}>{nextLabel} →</Link>
      ) : (
        <button type="button" className={nextClass} disabled={nextDisabled || !onNext} aria-label={nextLabel} onClick={onNext}>{nextLabel} →</button>
      )}
    </div>
  );
}

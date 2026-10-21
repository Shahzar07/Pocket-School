'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { flowCopy } from '@/lib/study/official-flow-copy';
import { flowIndex, flowKeyTarget, type StudentStepId, STUDENT_STEPS, studentCrumbHref, type ExamChoice, ADMIN_STEPS, type AdminStepId } from '@/lib/study/official-flow';

const future = 'text-sm font-semibold text-[#203337]/45 dark:text-[#EDEAE4]/45';
const done = 'text-sm font-semibold text-[#1E6A83] underline-offset-4 hover:underline dark:text-[#3FE0D0]';
const current = 'rounded-full bg-[#3FE0D0] px-3 py-1 text-sm font-semibold text-[#203337]';

export function OfficialTrail({
  choice,
  currentId,
  steps = STUDENT_STEPS,
  hrefFor,
}: {
  choice?: ExamChoice;
  currentId: string;
  steps?: readonly { id: string; label: string }[];
  hrefFor?: (id: string) => string | null;
}) {
  const index = flowIndex(steps, currentId);
  return (
    <nav aria-label={flowCopy.trail} data-flow-trail className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 py-1">
        {steps.map((step, stepIndex) => {
          const active = stepIndex === index;
          const complete = stepIndex < index;
          const href = complete ? (hrefFor ? hrefFor(step.id) : choice ? studentCrumbHref(step.id as StudentStepId, choice) : null) : null;
          return (
            <li key={step.id} className="flex items-center gap-1">
              {stepIndex > 0 ? <span aria-hidden className="px-0.5 text-[#1E6A83] dark:text-[#3FE0D0]">→</span> : null}
              {active ? (
                <span data-flow-step={step.id} aria-current="step" className={current}>{step.label}</span>
              ) : complete && href ? (
                <Link data-flow-step={step.id} href={href} className={done}>{step.label}</Link>
              ) : (
                <span data-flow-step={step.id} className={complete ? done : future}>{step.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AdminTrail({ currentId }: { currentId: AdminStepId }) {
  return (
    <OfficialTrail
      currentId={currentId}
      steps={ADMIN_STEPS}
      hrefFor={(id) => {
        const step = id as AdminStepId;
        return step === 'pack' ? '/dashboard/admin/exam-packs' : `/dashboard/admin/exam-packs/${step}`;
      }}
    />
  );
}

export function OfficialNav({
  backHref,
  nextHref,
  backLabel = flowCopy.back,
  nextLabel = flowCopy.next,
  onNext,
  nextDisabled = false,
}: {
  backHref?: string;
  nextHref?: string;
  backLabel?: string;
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
}) {
  const backClass = 'inline-flex h-11 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] disabled:opacity-40 dark:border-[#3FE0D0] dark:text-[#3FE0D0]';
  const nextClass = 'inline-flex h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-40';
  return (
    <div data-flow-nav className="sticky bottom-0 z-30 mt-auto flex items-center justify-between gap-3 border-t border-border bg-[var(--studio-bg,#F4FBFC)]/95 px-1 py-3 backdrop-blur dark:bg-[#1A1918]/95">
      {backHref ? (
        <Link href={backHref} className={backClass} aria-label={backLabel}>← {backLabel}</Link>
      ) : (
        <button type="button" className={backClass} disabled aria-label={backLabel}>← {backLabel}</button>
      )}
      {nextHref && !nextDisabled ? (
        <Link href={nextHref} className={nextClass} aria-label={nextLabel} onClick={onNext}>{nextLabel} →</Link>
      ) : (
        <button type="button" className={nextClass} disabled={nextDisabled || !onNext} aria-label={nextLabel} onClick={onNext}>{nextLabel} →</button>
      )}
    </div>
  );
}

export function FlowRow({ href, title, meta, trailing }: { href: string; title: string; meta?: string; trailing?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 border-b border-border px-1 py-3 text-[#203337] hover:bg-[#3FE0D0]/10 dark:text-[#EDEAE4]">
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {meta ? <span className="block text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{meta}</span> : null}
      </span>
      <span className="shrink-0 font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">
        {(trailing ?? '→').replace('→', '').trim() ? <span>{(trailing ?? '→').replace('→', '').trim()}</span> : null}
        <span aria-hidden> →</span>
      </span>
    </Link>
  );
}

export function QuestionArrows({ index, count, onChange }: { index: number; count: number; onChange: (index: number) => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const next = flowKeyTarget(event, count, index);
      if (next === null) return;
      event.preventDefault();
      onChange(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, index, onChange]);
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button type="button" className="inline-flex h-11 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] disabled:opacity-40 dark:border-[#3FE0D0] dark:text-[#3FE0D0]" aria-label={flowCopy.previousQuestion} disabled={index <= 0} onClick={() => onChange(index - 1)}>← {flowCopy.previousQuestion}</button>
      <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{flowCopy.questionCount} {index + 1} {flowCopy.of} {count}</p>
      <button type="button" className="inline-flex h-11 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] disabled:opacity-40 dark:border-[#3FE0D0] dark:text-[#3FE0D0]" aria-label={flowCopy.nextQuestion} disabled={index >= count - 1} onClick={() => onChange(index + 1)}>{flowCopy.nextQuestion} →</button>
    </div>
  );
}

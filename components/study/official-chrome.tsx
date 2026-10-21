'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FlowNav } from '@/components/flow/flow-nav';
import { FlowTrail } from '@/components/flow/flow-trail';
import { flowCopy } from '@/lib/study/official-flow-copy';
import { flowIndex, flowKeyTarget, type StudentStepId, STUDENT_STEPS, studentCrumbHref, type ExamChoice, ADMIN_STEPS, type AdminStepId } from '@/lib/study/official-flow';

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
    <FlowTrail
      steps={steps}
      currentId={currentId}
      label={flowCopy.trail}
      hrefFor={(id) => {
        const stepIndex = steps.findIndex((step) => step.id === id);
        if (stepIndex < 0 || stepIndex >= index) return null;
        if (hrefFor) return hrefFor(id);
        return choice ? studentCrumbHref(id as StudentStepId, choice) : null;
      }}
    />
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
  return (
    <FlowNav
      backHref={backHref}
      nextHref={nextHref}
      backLabel={backLabel}
      nextLabel={nextLabel}
      onNext={onNext}
      nextDisabled={nextDisabled}
    />
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

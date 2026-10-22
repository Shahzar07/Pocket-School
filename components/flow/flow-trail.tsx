'use client';

import Link from 'next/link';
import { flowCopy } from '@/lib/flow/copy';
import { flowIndex, type FlowStep } from '@/lib/flow/steps';

const future = 'text-sm font-semibold text-[#203337]/45 dark:text-[#E9F7FA]/45';
const done = 'text-sm font-semibold text-[#1E6A83] underline-offset-4 hover:underline dark:text-[#3FE0D0]';
const current = 'rounded-full bg-[#3FE0D0] px-3 py-1 text-sm font-semibold text-[#203337]';

export function FlowTrail({
  steps,
  currentId,
  hrefFor,
  onSelect,
  allowAhead = false,
  label = flowCopy.trail,
}: {
  steps: readonly FlowStep[];
  currentId: string;
  hrefFor?: (id: string) => string | null;
  onSelect?: (id: string) => void;
  allowAhead?: boolean;
  label?: string;
}) {
  const index = flowIndex(steps, currentId);
  return (
    <nav aria-label={label} data-flow-trail className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 py-1">
        {steps.map((step, stepIndex) => {
          const active = stepIndex === index;
          const complete = stepIndex < index;
          const href = complete && hrefFor ? hrefFor(step.id) : null;
          return (
            <li key={step.id} className="flex items-center gap-1">
              {stepIndex > 0 ? <span aria-hidden className="px-0.5 text-[#1E6A83] dark:text-[#3FE0D0]">→</span> : null}
              {active ? (
                <span data-flow-step={step.id} aria-current="step" className={current}>{step.label}</span>
              ) : href ? (
                <Link data-flow-step={step.id} href={href} className={done}>{step.label}</Link>
              ) : onSelect && (complete || allowAhead) ? (
                <button
                  type="button"
                  data-flow-step={step.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(step.id)}
                  className={complete ? done : future}
                >
                  {step.label}
                </button>
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

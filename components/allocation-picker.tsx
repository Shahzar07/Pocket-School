'use client';

import { BOOK_TARGETS, type BookTarget } from '@/lib/reads/types';

const LABELS: Record<BookTarget, string> = {
  students: 'Students',
  teachers: 'Teachers',
  parents: 'Parents',
  institutions: 'Institutions',
  all: 'Everyone',
  marketplace: 'Marketplace',
};

/** Multi-select of allocator audiences. The value is the array of chosen targets. */
export function AllocationPicker({
  value,
  onChange,
  label,
}: {
  value: readonly BookTarget[];
  onChange: (next: BookTarget[]) => void;
  label: string;
}) {
  const selected = new Set(value);
  const toggle = (target: BookTarget) => {
    const next = selected.has(target)
      ? value.filter(item => item !== target)
      : [...value, target];
    onChange(BOOK_TARGETS.filter(item => next.includes(item)));
  };

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {BOOK_TARGETS.map(target => {
          const on = selected.has(target);
          return (
            <label
              key={target}
              className={`inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-sm font-semibold ${on ? 'bg-foreground text-background' : 'border border-border'}`}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(target)} />
              {LABELS[target]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

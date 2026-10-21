'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LEVEL_GROUPS, levelLabel, levelsInGroup, resolveLevel, type LevelId } from '@/lib/levels';

export function LevelMenu({
  value,
  onChange,
  ariaLabel = 'Level',
  allowEmpty = false,
  emptyLabel = 'Level',
  extra = [],
  disabled = false,
  className = '',
  valueKind = 'id',
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  extra?: readonly string[];
  disabled?: boolean;
  className?: string;
  /** `id` stores primary/masters. `label` stores the visible name. */
  valueKind?: 'id' | 'label';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const resolved = resolveLevel(value);
  const shown = resolved ? levelLabel(resolved) : (value.trim() || emptyLabel);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} data-level-menu>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm font-normal text-foreground disabled:opacity-50"
      >
        <span className="truncate">{shown}</span>
        <span aria-hidden className="text-[#1E6A83]">▾</span>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          data-level-options
          className="absolute z-50 mt-1 max-h-80 w-full min-w-[16rem] overflow-auto rounded-2xl border border-border bg-card p-2 text-foreground shadow-lg"
        >
          {allowEmpty ? (
            <li>
              <button type="button" role="option" aria-selected={!resolved && !value} className="w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => choose('')}>
                {emptyLabel}
              </button>
            </li>
          ) : null}
          {LEVEL_GROUPS.map((group) => (
            <li key={group.id} className="mt-1">
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E6A83] dark:text-[#3FE0D0]">{group.label}</p>
              <ul>
                {levelsInGroup(group.id).map((level) => {
                  const stored = valueKind === 'label' ? level.label : level.id;
                  const selected = resolved === level.id;
                  return (
                    <li key={level.id}>
                      <button
                        type="button"
                        role="option"
                        data-level-id={level.id}
                        aria-selected={selected}
                        onClick={() => choose(stored)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm ${selected ? 'bg-[#3FE0D0] font-semibold text-[#203337]' : 'hover:bg-muted'}`}
                      >
                        {level.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {extra.filter((item) => item && !resolveLevel(item)).map((item) => (
            <li key={item}>
              <button type="button" role="option" aria-selected={value === item} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => choose(item)}>
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type { LevelId };

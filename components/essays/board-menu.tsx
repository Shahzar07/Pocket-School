'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { boardMemoryKey, boardsForLevel, resolveBoard } from '@/lib/essay/board-styles';
import { resolveLevel } from '@/lib/levels';

export function BoardMenu({
  level,
  value,
  onChange,
}: {
  level: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const options = useMemo(() => boardsForLevel(level), [level]);
  const current = resolveBoard(level, value);
  const shown = options.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const id = resolveLevel(level);
    if (!id || typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(boardMemoryKey(id));
    if (saved && options.some((item) => item.id === saved) && saved !== value) onChange(saved);
    // Remembered choice wins when the level changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  useEffect(() => {
    const id = resolveLevel(level);
    if (!id || typeof window === 'undefined' || !value) return;
    window.localStorage.setItem(boardMemoryKey(id), resolveBoard(level, value).id);
  }, [level, value]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative" data-board-menu>
      <button
        type="button"
        aria-label="Exam board style"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="mt-1 flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm font-normal"
      >
        <span className="truncate">{current.label}</span>
        <span aria-hidden className="text-[#1E6A83]">▾</span>
      </button>
      {open ? (
        <div id={listId} role="listbox" aria-label="Exam board style" data-board-options className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-2xl border border-border bg-card p-2 shadow-lg">
          <input
            aria-label="Search exam board style"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="mb-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
          {shown.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              data-board-id={item.id}
              aria-selected={item.id === current.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(item.id); setOpen(false); setQuery(''); }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${item.id === current.id ? 'bg-[#3FE0D0] font-semibold text-[#203337]' : 'hover:bg-muted'}`}
            >
              {item.label}
            </button>
          ))}
          {shown.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">No matching style.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

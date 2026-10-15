'use client';

import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

/**
 * Keyboard and pointer controls for one row in an ordered list.
 * Alt+Arrow moves the row. The buttons do the same thing for a keyboard
 * that is not holding Alt, and for a pointer.
 */
export function ReorderControls({
  index,
  count,
  label,
  onMove,
}: {
  index: number;
  count: number;
  label: string;
  onMove: (toIndex: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      <span
        draggable
        onDragStart={event => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(index));
        }}
        className="p-1 rounded text-muted-foreground/50 cursor-grab"
        title={`Drag ${label}`}
        aria-hidden
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <button
        type="button"
        className="p-1 rounded hover:bg-muted disabled:opacity-30"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={event => { event.stopPropagation(); onMove(index - 1); }}
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className="p-1 rounded hover:bg-muted disabled:opacity-30"
        aria-label={`Move ${label} down`}
        disabled={index >= count - 1}
        onClick={event => { event.stopPropagation(); onMove(index + 1); }}
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

/** Alt+ArrowUp / Alt+ArrowDown on a focused row. */
export function reorderKeyDown(event: React.KeyboardEvent, index: number, count: number, onMove: (toIndex: number) => void) {
  if (!event.altKey) return;
  if (event.key === 'ArrowUp' && index > 0) {
    event.preventDefault();
    onMove(index - 1);
  }
  if (event.key === 'ArrowDown' && index < count - 1) {
    event.preventDefault();
    onMove(index + 1);
  }
}

'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Harry: every popup uses this label, hit area, and focus ring. */
export const CLOSE_LABEL = 'Close';

export const closeControlClass =
  'inline-grid size-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6A83] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function confirmIfDirty(dirty: boolean): boolean {
  if (!dirty) return true;
  return window.confirm('You have unsaved changes. Close without saving?');
}

export function CloseControl({
  onClose,
  className,
  dirty = false,
}: {
  onClose: () => void;
  className?: string;
  dirty?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={CLOSE_LABEL}
      data-close="1"
      onClick={() => {
        if (!confirmIfDirty(dirty)) return;
        onClose();
      }}
      className={cn(closeControlClass, className)}
    >
      <X className="size-5" aria-hidden />
    </button>
  );
}

const DISMISS_REASONS = new Set(['escape-key', 'outside-press', 'close-press', 'focus-out']);

/** Cancel a Base UI close when a form has unsaved edits and the visitor says no. */
export function guardDismiss(
  open: boolean,
  dirty: boolean,
  details: { reason: string; cancel: () => void },
): boolean {
  if (open || !dirty || !DISMISS_REASONS.has(details.reason)) return false;
  if (confirmIfDirty(true)) return false;
  details.cancel();
  return true;
}

/**
 * Escape closes the layer. Focus goes back to whatever was active when it opened.
 * `root` limits Escape so a banner does not steal it from a text field elsewhere.
 */
export function useLayerDismiss(
  open: boolean,
  onClose: () => void,
  dirty = false,
  root?: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  const dirtyRef = useRef(dirty);
  const rootRef = useRef(root);
  onCloseRef.current = onClose;
  dirtyRef.current = dirty;
  rootRef.current = root;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const layer = rootRef.current?.current;
      const target = event.target;
      if (layer && target instanceof Node && !layer.contains(target)) {
        const typing = target instanceof HTMLElement
          && target.closest('input, textarea, select, [contenteditable="true"]');
        if (typing) return;
      }
      if (!confirmIfDirty(dirtyRef.current)) return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);
}

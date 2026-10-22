'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Phone height of a fixed lesson or quiz bar, read by the bars stacked above it. */
export function useDockHeight(name: 'lesson' | 'quiz') {
  const cleanup = useRef<(() => void) | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    const property = `--ps-${name}-dock`;
    if (!node) {
      document.documentElement.style.setProperty(property, '0px');
      return;
    }
    const apply = () => {
      const mobile = window.matchMedia('(max-width: 1023px)').matches;
      const shown = mobile && node.getClientRects().length > 0;
      document.documentElement.style.setProperty(property, shown ? `${node.offsetHeight}px` : '0px');
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    const media = window.matchMedia('(max-width: 1023px)');
    media.addEventListener('change', apply);
    cleanup.current = () => {
      observer.disconnect();
      media.removeEventListener('change', apply);
      document.documentElement.style.setProperty(property, '0px');
    };
  }, [name]);

  useEffect(() => () => cleanup.current?.(), [ref]);
  return ref;
}

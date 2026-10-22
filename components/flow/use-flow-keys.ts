'use client';

import { useEffect } from 'react';
import { flowKeyTarget } from '@/lib/flow/steps';

export function useFlowKeys(
  index: number,
  count: number,
  onChange: (index: number) => void,
  enabled = true,
  yieldToCapture = false,
) {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKey(event: KeyboardEvent) {
      if (yieldToCapture && document.querySelector('[data-flow-capture]')) return;
      const next = flowKeyTarget(event, count, index);
      if (next === null) return;
      event.preventDefault();
      onChange(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, enabled, index, onChange, yieldToCapture]);
}

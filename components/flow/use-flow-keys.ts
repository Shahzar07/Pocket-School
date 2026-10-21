'use client';

import { useEffect } from 'react';
import { flowKeyTarget } from '@/lib/flow/steps';

export function useFlowKeys(index: number, count: number, onChange: (index: number) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKey(event: KeyboardEvent) {
      const next = flowKeyTarget(event, count, index);
      if (next === null) return;
      event.preventDefault();
      onChange(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, enabled, index, onChange]);
}

'use client';

import { useSyncExternalStore } from 'react';

const titles = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function setCrumbTitle(segment: string, title: string) {
  const next = title.trim();
  if (!segment || !next || titles.get(segment) === next) return;
  titles.set(segment, next);
  emit();
}

export function clearCrumbTitle(segment: string) {
  if (!titles.delete(segment)) return;
  emit();
}

export function crumbLabel(segment: string): string | undefined {
  return titles.get(segment);
}

export function useCrumbVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => 0,
  );
}

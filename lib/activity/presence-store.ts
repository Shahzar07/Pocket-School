'use client';

/** Shared with lesson and focus timers. True until a session says otherwise. */
let counted = true;
const listeners = new Set<() => void>();

export function isCountedActive(): boolean {
  return counted;
}

export function setCountedActive(next: boolean): void {
  if (counted === next) return;
  counted = next;
  listeners.forEach((listener) => listener());
}

export function subscribeCounted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

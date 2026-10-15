'use client';

import { useEffect, useRef, useState } from 'react';

/** Debounced local draft. The host decides what "saved" means for the server. */
export function useAutosave<T>(key: string, value: T, delay = 800): number | null {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const skip = useRef(true);
  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
        setSavedAt(Date.now());
      } catch {
        /* private mode or a full disk */
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [key, value, delay]);
  return savedAt;
}

/** Write immediately. A failed server save uses this so a reload can restore the draft. */
export function writeAutosave<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    /* private mode or a full disk */
  }
}

export function readAutosave<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: T };
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

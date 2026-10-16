'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  contentCacheKey,
  displayedFields,
  type TranslationFields,
} from '@/lib/i18n/content-translation';
import { DEFAULT_LANGUAGE } from '@/lib/languages';

const memory = new Map<string, TranslationFields>();

function readCache(key: string): TranslationFields | null {
  const hit = memory.get(key);
  if (hit) return hit;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TranslationFields;
    if (!parsed || typeof parsed !== 'object') return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: TranslationFields) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or quota */
  }
}

export type TranslationStatus = 'source' | 'loading' | 'ready' | 'unavailable';

export function useContentTranslation(
  id: string,
  source: TranslationFields,
  language: string,
  enabled: boolean,
) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [translated, setTranslated] = useState<TranslationFields | null>(null);
  const [status, setStatus] = useState<TranslationStatus>('source');
  const cacheKey = contentCacheKey(id, language, source);
  const sourceKey = useMemo(() => JSON.stringify(source), [source]);

  useEffect(() => {
    setShowOriginal(false);
    if (!enabled || !language || language === DEFAULT_LANGUAGE) {
      setTranslated(null);
      setStatus('source');
      return;
    }
    const cached = readCache(cacheKey);
    if (cached) {
      setTranslated(cached);
      setStatus('ready');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    setTranslated(null);
    fetch('/api/ai/translate-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...source, targetLanguage: language, viewer: true }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json() as TranslationFields & { unavailable?: boolean; error?: string };
        if (data.unavailable || !res.ok) {
          setStatus('unavailable');
          return;
        }
        const next: TranslationFields = {};
        for (const key of Object.keys(source)) {
          next[key] = typeof data[key] === 'string' ? data[key] : source[key];
        }
        writeCache(cacheKey, next);
        setTranslated(next);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('unavailable');
      });
    return () => controller.abort();
  }, [cacheKey, enabled, language, sourceKey]);

  const values = displayedFields(source, translated, showOriginal || status !== 'ready');
  return {
    values,
    status,
    showOriginal,
    toggle: () => setShowOriginal((current) => !current),
    autoTranslated: status === 'ready' && !showOriginal,
  };
}

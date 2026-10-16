'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  contentCacheKey,
  displayedFields,
  type TranslationFields,
} from '@/lib/i18n/content-translation';
import { DEFAULT_LANGUAGE, textDirection } from '@/lib/languages';

export interface ContentTranslationOptions {
  /** Translate the source into English, even though English is the default. */
  intoEnglish?: boolean;
  /** Direction of the source text. English lessons are left to right. */
  sourceDirection?: 'ltr' | 'rtl';
}

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
  options?: ContentTranslationOptions,
) {
  const intoEnglish = options?.intoEnglish === true;
  const sourceDirection = options?.sourceDirection ?? 'ltr';
  const [showOriginal, setShowOriginal] = useState(false);
  const [translated, setTranslated] = useState<TranslationFields | null>(null);
  const [status, setStatus] = useState<TranslationStatus>('source');
  const [notice, setNotice] = useState('');
  const target = intoEnglish ? 'en-from-source' : language;
  const cacheKey = contentCacheKey(id, target, source);
  const sourceKey = useMemo(() => JSON.stringify(source), [source]);

  useEffect(() => {
    setShowOriginal(false);
    setNotice('');
    if (!enabled || !language || (!intoEnglish && language === DEFAULT_LANGUAGE)) {
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
    fetch('/api/content/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, language, fields: source, intoEnglish }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json() as {
          fields?: TranslationFields;
          unavailable?: boolean;
          error?: string;
          notice?: string;
        };
        if (data.unavailable || !res.ok || !data.fields) {
          setNotice(data.error || data.notice || '');
          setStatus('unavailable');
          return;
        }
        const next: TranslationFields = {};
        for (const key of Object.keys(source)) {
          next[key] = typeof data.fields[key] === 'string' ? data.fields[key] : source[key];
        }
        writeCache(cacheKey, next);
        setTranslated(next);
        setNotice(data.notice ?? '');
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('unavailable');
      });
    return () => controller.abort();
  }, [cacheKey, enabled, id, intoEnglish, language, sourceKey]);

  const showingSource = showOriginal || status !== 'ready';
  const values = displayedFields(source, translated, showingSource);
  const dir: 'ltr' | 'rtl' = showingSource
    ? sourceDirection
    : (intoEnglish ? 'ltr' : textDirection(language));
  return {
    values,
    status,
    notice,
    dir,
    showOriginal,
    toggle: () => setShowOriginal((current) => !current),
    autoTranslated: status === 'ready' && !showOriginal,
  };
}

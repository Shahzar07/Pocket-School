import 'server-only';
import { createHash } from 'node:crypto';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { callOpenRouter, CONTENT_MODEL, isOpenRouterConfigured } from '@/lib/openrouter';
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, isSupportedLanguage } from '@/lib/languages';
import {
  TRANSLATION_GUARD,
  chunksForTranslation,
  contentCacheKey,
  parseModelFields,
  type TranslationFields,
} from '@/lib/i18n/content-translation';

const memory = new Map<string, TranslationFields>();

export function cacheDocId(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 40);
}

export async function readCachedFields(docId: string): Promise<TranslationFields | null> {
  const local = memory.get(docId);
  if (local) return local;
  if (!isAdminConfigured()) return null;
  try {
    const snap = await adminDb().collection('content_translations').doc(docId).get();
    if (!snap.exists) return null;
    const fields = snap.data()?.fields;
    if (!fields || typeof fields !== 'object') return null;
    const out: TranslationFields = {};
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value;
    }
    if (!Object.keys(out).length) return null;
    memory.set(docId, out);
    return out;
  } catch (err) {
    console.error('[content-cache] read', err);
    return null;
  }
}

export async function writeCachedFields(
  docId: string,
  meta: { id: string; language: string; fields: TranslationFields },
): Promise<'firestore' | 'memory'> {
  memory.set(docId, meta.fields);
  if (!isAdminConfigured()) return 'memory';
  try {
    await adminDb().collection('content_translations').doc(docId).set({
      contentId: meta.id.slice(0, 300),
      language: meta.language,
      fields: meta.fields,
      updatedAt: Date.now(),
    });
    return 'firestore';
  } catch (err) {
    console.error('[content-cache] write', err);
    return 'memory';
  }
}

async function translateChunk(text: string, languageName: string, key: string): Promise<string> {
  const raw = await callOpenRouter(
    [{
      role: 'user',
      content: [
        TRANSLATION_GUARD,
        `Translate the following into ${languageName}.`,
        `Return ONLY a JSON object {"${key}":"..."} and do not wrap it in a code fence.`,
        '',
        text,
      ].join('\n'),
    }],
    { model: CONTENT_MODEL, temperature: 0.2, jsonMode: true, maxTokens: 4000 },
  );
  return parseModelFields(raw, [key])?.[key] ?? text;
}

async function translateFields(fields: TranslationFields, languageName: string): Promise<TranslationFields> {
  const keys = Object.keys(fields);
  const payload = JSON.stringify(fields);
  const shortEnough = payload.length <= 12_000 && Object.values(fields).every(value => value.length <= 6000);
  if (shortEnough) {
    const raw = await callOpenRouter(
      [{
        role: 'user',
        content: [
          TRANSLATION_GUARD,
          `Translate every string value into ${languageName}.`,
          `Return ONLY a JSON object with these string keys: ${keys.map(key => `"${key}"`).join(', ')}.`,
          'Do not wrap the JSON in a code fence.',
          '',
          payload,
        ].join('\n'),
      }],
      { model: CONTENT_MODEL, temperature: 0.2, jsonMode: true, maxTokens: 4000 },
    );
    const parsed = parseModelFields(raw, keys);
    if (parsed) {
      const out: TranslationFields = {};
      for (const key of keys) out[key] = parsed[key] ?? fields[key];
      return out;
    }
  }

  const out: TranslationFields = {};
  for (const key of keys) {
    const pieces = chunksForTranslation(fields[key] ?? '').slice(0, 4);
    const translated: string[] = [];
    for (const piece of pieces) translated.push(await translateChunk(piece, languageName, 'text'));
    let joined = translated.join('');
    if (chunksForTranslation(fields[key] ?? '').length > 4) {
      joined += '\n\nThe rest of this section is still in English.';
    }
    out[key] = joined.trim() || fields[key];
  }
  return out;
}

export interface TranslateRequest {
  id: string;
  language: string;
  fields: TranslationFields;
  intoEnglish?: boolean;
}

export interface TranslateResult {
  fields: TranslationFields;
  cached: boolean;
  store: 'firestore' | 'memory' | 'none';
  unavailable?: boolean;
  error?: string;
  notice?: string;
}

export async function translateContent(input: TranslateRequest): Promise<TranslateResult> {
  const language = input.intoEnglish ? DEFAULT_LANGUAGE : input.language;
  if (!input.intoEnglish && (!isSupportedLanguage(language) || language === DEFAULT_LANGUAGE)) {
    return { fields: input.fields, cached: false, store: 'none' };
  }
  const languageName = input.intoEnglish ? 'English' : (LANGUAGE_NAMES[language] ?? language);
  const key = contentCacheKey(input.id, input.intoEnglish ? 'en-from-source' : language, input.fields);
  const docId = cacheDocId(key);
  const hit = await readCachedFields(docId);
  if (hit) return { fields: { ...input.fields, ...hit }, cached: true, store: isAdminConfigured() ? 'firestore' : 'memory' };
  if (!isOpenRouterConfigured()) {
    return {
      fields: input.fields,
      cached: false,
      store: 'none',
      unavailable: true,
      error: 'OPENROUTER_API_KEY is not set. Showing the English original.',
    };
  }
  const translated = await translateFields(input.fields, languageName);
  const store = await writeCachedFields(docId, { id: input.id, language, fields: translated });
  return {
    fields: translated,
    cached: false,
    store,
    notice: store === 'memory'
      ? 'Firestore is not configured on this server, so this translation is kept for the current server session and this browser.'
      : undefined,
  };
}

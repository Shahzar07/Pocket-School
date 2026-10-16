/**
 * On-demand translation of course and lesson content.
 * Saved localizations win. Machine output is cached per source hash and
 * labelled in the UI. Without an AI key the caller keeps the original.
 */

export interface TranslationFields {
  [key: string]: string;
}

export function hashFields(fields: TranslationFields): string {
  const payload = Object.keys(fields).sort().map((key) => `${key}:${fields[key] ?? ''}`).join('\n');
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function contentCacheKey(id: string, language: string, fields: TranslationFields): string {
  return `poket-mt:${id}:${language}:${hashFields(fields)}`;
}

export function displayedField(source: string, translated: string | undefined, showOriginal: boolean): string {
  if (showOriginal) return source;
  const next = translated?.trim();
  return next ? next : source;
}

export function displayedFields(
  source: TranslationFields,
  translated: TranslationFields | null,
  showOriginal: boolean,
): TranslationFields {
  const out: TranslationFields = {};
  for (const key of Object.keys(source)) {
    out[key] = displayedField(source[key] ?? '', translated?.[key], showOriginal);
  }
  return out;
}

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

/** Names and marks the model must not rewrite while translating learner content. */
export const TRANSLATION_GUARD =
  'Keep these names exactly as written: Poket School, ET AI, Poket Reads, ET AI Essay Writer, ET AI Live, and any teacher name that starts with "ET " plus a subject (for example ET Maths). Never replace a teacher name with the letters ET on their own. Do not add calendar years. Preserve Markdown, LaTeX ($...$ and $$...$$), and valid JSON.';

/** Split long lessons and chapters on paragraph boundaries before a model call. */
export function chunksForTranslation(text: string, size = 6000): string[] {
  if (text.length <= size) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const window = rest.slice(0, size);
    const paragraph = window.lastIndexOf('\n\n');
    const line = window.lastIndexOf('\n');
    const sentence = window.lastIndexOf('. ');
    const cut = Math.max(paragraph, line, sentence);
    const at = cut > size * 0.4 ? cut + (window[cut] === '.' ? 2 : window[cut] === '\n' ? 1 : 2) : size;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  if (rest.trim()) parts.push(rest);
  return parts;
}

/** Read the JSON object a translation model returns, keeping only requested string keys. */
export function parseModelFields(raw: string, keys: readonly string[]): TranslationFields | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    const out: TranslationFields = {};
    for (const key of keys) {
      const value = parsed[key];
      if (typeof value === 'string' && value.trim()) out[key] = value.trim();
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

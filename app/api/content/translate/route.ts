import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { translateContent } from '@/lib/i18n/content-cache';
import type { TranslationFields } from '@/lib/i18n/content-translation';

export const maxDuration = 60;

const MAX_FIELDS = 12;
const MAX_FIELD = 24_000;

/**
 * POST /api/content/translate
 * Lazy translation of English course content, quizzes, books, essay feedback,
 * and an English rendering of an AI teacher reply. Cached per content and language.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`content-translate:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many translation requests. Please wait a moment.' }, { status: 429 });
  }
  let body: { id?: unknown; language?: unknown; fields?: unknown; intoEnglish?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id.slice(0, 300) : '';
  const language = typeof body.language === 'string' ? body.language : '';
  if (!id || !language || !body.fields || typeof body.fields !== 'object') {
    return NextResponse.json({ error: 'id, language, and fields are required.' }, { status: 400 });
  }
  const fields: TranslationFields = {};
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>).slice(0, MAX_FIELDS)) {
    if (typeof value !== 'string') continue;
    fields[key.slice(0, 40)] = value.slice(0, MAX_FIELD);
  }
  if (!Object.values(fields).some(value => value.trim())) {
    return NextResponse.json({ error: 'Nothing to translate.' }, { status: 400 });
  }
  try {
    const result = await translateContent({
      id,
      language,
      fields,
      intoEnglish: body.intoEnglish === true,
    });
    return NextResponse.json(result, { status: result.unavailable ? 200 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed';
    console.error('[content/translate]', err);
    return NextResponse.json({ error: message, unavailable: true }, { status: 500 });
  }
}

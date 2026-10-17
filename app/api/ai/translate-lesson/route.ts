import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import { translateContent } from '@/lib/i18n/content-cache';
import { DEFAULT_LANGUAGE, isSupportedLanguage } from '@/lib/languages';

const MAX_TITLE = 300;
const MAX_BODY = 12_000;

/** CMS lesson draft translation. Same translator and cache as learner content. */
export async function POST(req: NextRequest) {
  const denied = await enforceAiAccess(req);
  if (denied) return denied;
  try {
    const body = await req.json() as Record<string, unknown>;
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : '';
    if (!isSupportedLanguage(targetLanguage) || targetLanguage === DEFAULT_LANGUAGE) {
      return NextResponse.json({ error: 'Choose a supported language other than English.' }, { status: 400 });
    }
    const title = typeof body.title === 'string' ? body.title.slice(0, MAX_TITLE) : '';
    const text = typeof body.text === 'string' ? body.text.slice(0, MAX_BODY) : '';
    if (!title.trim() && !text.trim()) {
      return NextResponse.json({ error: 'Nothing to translate.' }, { status: 400 });
    }
    const result = await translateContent({
      id: `cms-lesson:${targetLanguage}`,
      language: targetLanguage,
      fields: { title, text },
    });
    if (result.unavailable) {
      return NextResponse.json({ unavailable: true, error: result.error });
    }
    return NextResponse.json({
      title: result.fields.title ?? title,
      text: result.fields.text ?? text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed';
    console.error('[translate-lesson]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

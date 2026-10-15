import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, isSupportedLanguage } from '@/lib/languages';

const MAX_TITLE = 300;
const MAX_BODY = 12_000;

function parseTranslation(raw: string): { title: string; text: string } | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { title?: unknown; text?: unknown };
    const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, MAX_TITLE) : '';
    const text = typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 20_000) : '';
    if (!title && !text) return null;
    return { title, text };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title?: unknown; text?: unknown; targetLanguage?: unknown };
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : '';
    if (!isSupportedLanguage(targetLanguage) || targetLanguage === DEFAULT_LANGUAGE) {
      return NextResponse.json({ error: 'Choose a supported language other than English.' }, { status: 400 });
    }
    const title = String(body.title ?? '').slice(0, MAX_TITLE);
    const text = String(body.text ?? '').slice(0, MAX_BODY);
    if (!title.trim() && !text.trim()) {
      return NextResponse.json({ error: 'Nothing to translate.' }, { status: 400 });
    }
    const name = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
    const prompt = [
      `Translate this lesson into ${name}.`,
      'Return ONLY a JSON object with two string keys: "title" and "text".',
      'Preserve Markdown and LaTeX ($...$ and $$...$$). Do not add commentary, and do not wrap the JSON in code fences.',
      '',
      `Title:\n${title}`,
      '',
      `Body:\n${text}`,
    ].join('\n');

    const raw = await callOpenRouter(
      [{ role: 'user', content: prompt }],
      { model: CONTENT_MODEL, temperature: 0.2 },
    );
    const parsed = parseTranslation(raw);
    if (!parsed) {
      return NextResponse.json({ error: 'The translation could not be read. Please try again.' }, { status: 422 });
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed';
    console.error('[translate-lesson]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

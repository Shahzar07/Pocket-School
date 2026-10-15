import { NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';
import { isPlatformAdmin } from '@/lib/reads/verify-admin';

export const runtime = 'nodejs';

/**
 * Returns a language version. It is not stored. The localisation PR owns
 * the review queue this should join.
 */
export async function POST(request: Request) {
  const admin = await isPlatformAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Sign in as a platform admin to translate.' }, { status: 401 });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not set.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as {
    language?: string;
    sourceVersion?: number;
    title?: string;
    blurb?: string;
    chapters?: { id: string; title: string; markdown: string }[];
  } | null;
  if (!body?.language || !body.title || !body.chapters?.length) {
    return NextResponse.json({ error: 'Language, title and chapters are required.' }, { status: 400 });
  }

  try {
    const raw = await callOpenRouter([
      {
        role: 'system',
        content: 'Translate this Poket Reads book. Keep names, RM prices and curriculum terms accurate. Mark nothing as approved. Reply with JSON only: {"title": string, "blurb": string, "chapters": [{"id": string, "title": string, "markdown": string}]}. Same chapter ids, same order.',
      },
      { role: 'user', content: JSON.stringify({ language: body.language, title: body.title, blurb: body.blurb, chapters: body.chapters }) },
    ], { model: CONTENT_MODEL, jsonMode: true, maxTokens: 4000 });
    const parsed = JSON.parse(raw) as { title?: string; blurb?: string; chapters?: { id: string; title: string; markdown: string }[] };
    return NextResponse.json({
      language: body.language,
      sourceVersion: body.sourceVersion ?? 1,
      status: 'review',
      aiTranslated: true,
      title: parsed.title ?? body.title,
      blurb: parsed.blurb ?? body.blurb ?? '',
      chapters: parsed.chapters ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Translation failed.' }, { status: 502 });
  }
}

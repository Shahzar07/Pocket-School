import { NextResponse } from 'next/server';
import { translateContent } from '@/lib/i18n/content-cache';
import { isSupportedLanguage } from '@/lib/languages';
import { isPlatformAdmin } from '@/lib/reads/verify-admin';

export const runtime = 'nodejs';

/**
 * Admin preview of a Poket Reads language version. It is not stored.
 * Each field goes through the shared content translator.
 */
export async function POST(request: Request) {
  const admin = await isPlatformAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Sign in as a platform admin to translate.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    language?: string;
    sourceVersion?: number;
    title?: string;
    blurb?: string;
    chapters?: { id: string; title: string; markdown: string }[];
  } | null;
  if (!body?.language || !isSupportedLanguage(body.language) || !body.title || !body.chapters?.length) {
    return NextResponse.json({ error: 'Language, title and chapters are required.' }, { status: 400 });
  }

  try {
    const cover = await translateContent({
      id: `reads-preview:${body.language}`,
      language: body.language,
      fields: { title: body.title, blurb: body.blurb ?? '' },
    });
    if (cover.unavailable) {
      return NextResponse.json({ error: cover.error || 'OPENROUTER_API_KEY is not set.' }, { status: 503 });
    }

    const chapters = [];
    for (const chapter of body.chapters) {
      const translated = await translateContent({
        id: `reads-preview:${body.language}:${chapter.id}`,
        language: body.language,
        fields: { title: chapter.title, markdown: chapter.markdown },
      });
      if (translated.unavailable) {
        return NextResponse.json({ error: translated.error || 'OPENROUTER_API_KEY is not set.' }, { status: 503 });
      }
      chapters.push({
        id: chapter.id,
        title: translated.fields.title ?? chapter.title,
        markdown: translated.fields.markdown ?? chapter.markdown,
      });
    }

    return NextResponse.json({
      language: body.language,
      sourceVersion: body.sourceVersion ?? 1,
      status: 'review',
      aiTranslated: true,
      title: cover.fields.title ?? body.title,
      blurb: cover.fields.blurb ?? body.blurb ?? '',
      chapters,
    });
  } catch (err) {
    console.error('[reads/translate]', err);
    return NextResponse.json({ error: 'Translation failed.' }, { status: 502 });
  }
}

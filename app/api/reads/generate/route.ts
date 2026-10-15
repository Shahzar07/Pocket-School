import { NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';
import { isPlatformAdmin } from '@/lib/reads/verify-admin';

export const runtime = 'nodejs';

/**
 * Admin-only outline. Nothing is written to Firestore from here.
 * The studio keeps a local copy and a human still has to move
 * draft → review → published.
 */
export async function POST(request: Request) {
  const admin = await isPlatformAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { error: 'Sign in as a platform admin to generate. This preview does not store the outline.' },
      { status: 401 },
    );
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not set.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as {
    title?: string;
    category?: string;
    form?: string;
    genre?: string;
    ageRating?: string;
    readingLevel?: string;
  } | null;
  if (!body?.title) {
    return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
  }

  try {
    const raw = await callOpenRouter([
      {
        role: 'system',
        content: 'You draft Poket Reads books. The author is always ET AI. Reply with JSON only: {"title": string, "blurb": string, "chapters": [{"title": string, "summary": string}]}. Three to six chapters. UK English. Age-appropriate for the rating given. Academic books stay factual. Fiction must not spoil later chapters in earlier summaries.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          title: body.title,
          category: body.category,
          form: body.form,
          genre: body.genre,
          ageRating: body.ageRating,
          readingLevel: body.readingLevel,
        }),
      },
    ], { model: CONTENT_MODEL, jsonMode: true, maxTokens: 1200 });

    const parsed = JSON.parse(raw) as { title?: string; blurb?: string };
    return NextResponse.json({ title: parsed.title ?? body.title, blurb: parsed.blurb ?? '' });
  } catch {
    return NextResponse.json({ error: 'Outline generation failed.' }, { status: 502 });
  }
}

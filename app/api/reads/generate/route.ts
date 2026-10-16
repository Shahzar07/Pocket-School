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
    kind?: string;
    title?: string;
    blurb?: string;
    ageBand?: string;
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
    const story = body.kind === 'story';
    const raw = await callOpenRouter([
      {
        role: 'system',
        content: story
          ? 'You are ET AI writing a Poket Reads children\'s picture book. Use the age band given, such as Ages 5–7. Do not mention school years or the word Year followed by a number. Each chapter is one page a child can hear aloud: a very short paragraph, plus one illustration note. The same child, clothes, and place appear in every illustration note. No letters inside the picture. The author must still edit and approve. Reply with JSON only: {"title": string, "blurb": string, "chapters": [{"title": string, "summary": string, "illustration": string}]}.'
          : 'You draft Poket Reads books. The author is always ET AI. Reply with JSON only: {"title": string, "blurb": string, "chapters": [{"title": string, "summary": string}]}. Three to six chapters. UK English. Age-appropriate for the rating given. Academic books stay factual. Fiction must not spoil later chapters in earlier summaries.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          title: body.title,
          blurb: body.blurb,
          ageBand: body.ageBand,
          category: body.category,
          form: body.form,
          genre: body.genre,
          ageRating: body.ageRating,
          readingLevel: body.readingLevel,
        }),
      },
    ], { model: CONTENT_MODEL, jsonMode: true, maxTokens: 1200 });

    const parsed = JSON.parse(raw) as {
      title?: string;
      blurb?: string;
      chapters?: { title?: string; summary?: string; illustration?: string }[];
    };
    const chapters = Array.isArray(parsed.chapters)
      ? parsed.chapters
        .filter(chapter => typeof chapter?.title === 'string' && chapter.title.trim())
        .map(chapter => ({
          title: chapter.title!.trim(),
          summary: (chapter.summary ?? '').trim(),
          illustration: (chapter.illustration ?? '').trim(),
        }))
      : [];
    return NextResponse.json({ title: parsed.title ?? body.title, blurb: parsed.blurb ?? '', chapters });
  } catch {
    return NextResponse.json({ error: 'Outline generation failed.' }, { status: 502 });
  }
}

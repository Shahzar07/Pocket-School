import { NextResponse } from 'next/server';
import { callOpenRouter, LIVE_MODEL } from '@/lib/openrouter';

export const runtime = 'nodejs';

/** Ask ET about the chapter currently open. Fiction answers stay inside that chapter. */
export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'Ask ET needs the AI key. The chapter guide still works offline.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as {
    title?: string;
    fiction?: boolean;
    chapterTitle?: string;
    chapterText?: string;
    question?: string;
  } | null;
  if (!body?.question || !body.chapterText) {
    return NextResponse.json({ error: 'A question and the open chapter are required.' }, { status: 400 });
  }

  const spoiler = body.fiction
    ? 'This is fiction. Answer only from the chapter text supplied. Do not guess later plot, name a twist, or use knowledge from outside this chapter.'
    : 'This is a study book. Explain the idea in the chapter. Do not invent facts that are not in the text.';

  try {
    const answer = await callOpenRouter([
      {
        role: 'system',
        content: `You are ET, the reading tutor inside Poket Reads. UK English. Short answers a student can read on a phone. ${spoiler} If the question asks for something the chapter does not contain, say so.`,
      },
      {
        role: 'user',
        content: `Book: ${body.title ?? 'Untitled'}\nChapter: ${body.chapterTitle ?? ''}\n\n${body.chapterText.slice(0, 8000)}\n\nQuestion: ${body.question}`,
      },
    ], { model: LIVE_MODEL, temperature: 0.4, maxTokens: 500 });
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: 'ET could not answer just now.' }, { status: 502 });
  }
}

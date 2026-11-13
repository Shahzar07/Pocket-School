import { NextResponse } from 'next/server';
import { isOpenRouterConfigured, LIVE_MODEL, openRouterFetch } from '@/lib/openrouter';
import { decodeDataUrl, parsePaperTimetable, textChunksFromPng } from '@/lib/timetable/paper';

/** Model calls outlast the platform default. Without this the request is cut off mid-answer. */
export const maxDuration = 60;

export const runtime = 'nodejs';

const PROMPT = 'Read this photographed school timetable. Return only lines you can see, each as: Monday, P1, Subject, Level, Teacher, Room. Use level names such as Primary 2 or IGCSE. Do not invent a row.';

async function readPhoto(image: string): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) return '';
  const response = await openRouterFetch({
    chain: [LIVE_MODEL, ...['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash-001']],
    build: (model, fallbacks) => ({
      model,
      ...(fallbacks.length ? { models: [model, ...fallbacks] } : {}),
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: image } },
        ],
      }],
    }),
  }).catch(() => null);
  if (!response) return '';
  if (!response.ok) return '';
  const data = await response.json() as { choices?: { message?: { content?: unknown } }[] };
  const content = data.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { image?: unknown } | null;
  const image = typeof body?.image === 'string' && body.image.startsWith('data:image/') && body.image.length < 2_000_000
    ? body.image
    : '';
  if (!image) return NextResponse.json({ source: 'unread', text: '', rows: [] });
  const bytes = decodeDataUrl(image);
  const embedded = bytes ? textChunksFromPng(bytes).join('\n') : '';
  const embeddedRows = parsePaperTimetable(embedded);
  if (isOpenRouterConfigured()) {
    try {
      const seen = await readPhoto(image);
      const rows = parsePaperTimetable(seen);
      if (rows.length > 0) return NextResponse.json({ source: 'openrouter', text: seen, rows });
    } catch {
      /* The embedded text and the typed line still work. */
    }
  }
  if (embeddedRows.length > 0) return NextResponse.json({ source: 'image-text', text: embedded, rows: embeddedRows });
  return NextResponse.json({ source: 'unread', text: '', rows: [] });
}

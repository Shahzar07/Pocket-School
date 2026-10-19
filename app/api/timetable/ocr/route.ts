import { NextResponse } from 'next/server';
import { isOpenRouterConfigured, LIVE_MODEL } from '@/lib/openrouter';
import { decodeDataUrl, parsePaperTimetable, textChunksFromPng } from '@/lib/timetable/paper';

export const runtime = 'nodejs';

const PROMPT = 'Read this photographed school timetable. Return only lines you can see, each as: Monday, P1, Subject, Level, Teacher, Room. Use level names such as Primary 2 or IGCSE. Do not invent a row.';

async function readPhoto(image: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return '';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://poketschool.ai',
      'X-Title': 'Poket School',
    },
    body: JSON.stringify({
      model: LIVE_MODEL,
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: image } },
        ],
      }],
    }),
  });
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

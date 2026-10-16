import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import {
  AI_CALENDAR_UNAVAILABLE,
  aiKeyPresent,
  calendarLink,
  draftsFromModelText,
  importCalendarText,
  type ImportDraft,
} from '@/lib/insights/planner-import';

export const runtime = 'nodejs';

const MAX_BYTES = 8_000_000;
const TEXT_PROMPT = 'List every school date you can see, one per line, as "Title YYYY-MM-DD". Do not invent dates. If a date is unreadable, skip it.';

function json(draft: ImportDraft, status = 200) {
  return NextResponse.json({
    ok: draft.events.length > 0,
    events: draft.events,
    notice: draft.notice,
    needsReview: true,
    published: false,
  }, { status });
}

export async function POST(request: NextRequest) {
  const denied = await enforceAiAccess(request);
  if (denied) return denied;
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null) as { url?: string } | null;
      const checked = calendarLink(body?.url ?? '');
      if (!checked.url) return json({ events: [], notice: checked.notice, needsReview: true });
      const text = await fetchCalendar(checked.url);
      if (!text) {
        return json({
          events: [],
          notice: 'That calendar link could not be read. Download the ICS file and upload it. Nothing was published.',
          needsReview: true,
        });
      }
      return json(importCalendarText('school.ics', text));
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return json({ events: [], notice: 'Choose a calendar file.', needsReview: true }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ events: [], notice: 'Files need to be under 8 MB.', needsReview: true }, 413);
    }
    const name = file.name.toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());
    if (name.endsWith('.pdf')) return json(await draftFromPdf(bytes));
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
      return json(await draftFromImage(bytes, file.type || 'image/jpeg'));
    }
    return json(importCalendarText(file.name, bytes.toString('utf8')));
  } catch {
    return json({
      events: [],
      notice: 'That calendar could not be read. Try an ICS, CSV, or XLSX file. Nothing was published.',
      needsReview: true,
    });
  }
}

async function fetchCalendar(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/calendar, text/plain, */*' },
    });
    if (!response.ok || !calendarLink(response.url).url) return null;
    const text = await response.text();
    return text.length > 1_000_000 ? null : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function draftFromPdf(bytes: Buffer): Promise<ImportDraft> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = typeof extracted.text === 'string' ? extracted.text : '';
    if (text.trim()) {
      const draft = draftsFromModelText(text);
      return {
        ...draft,
        notice: draft.events.length
          ? 'Dates were read from the PDF as a draft. A person still has to publish them.'
          : 'No dates were found in that PDF. Type them, or upload an ICS, CSV, or XLSX file.',
      };
    }
  } catch {
    // A scanned PDF has no text layer. Fall through to the AI path.
  }
  if (!aiKeyPresent(process.env)) {
    return { events: [], notice: AI_CALENDAR_UNAVAILABLE, needsReview: true };
  }
  return { events: [], notice: 'This PDF has no text layer. Upload a photo of the page, or type the dates. Nothing was published.', needsReview: true };
}

async function draftFromImage(bytes: Buffer, mime: string): Promise<ImportDraft> {
  if (!aiKeyPresent(process.env)) {
    return { events: [], notice: AI_CALENDAR_UNAVAILABLE, needsReview: true };
  }
  const text = await readImage(bytes, mime);
  if (!text) {
    return {
      events: [],
      notice: 'The photo could not be read. Type the dates, or upload an ICS, CSV, or XLSX file. Nothing was published.',
      needsReview: true,
    };
  }
  const draft = draftsFromModelText(text);
  return {
    ...draft,
    notice: draft.events.length
      ? 'The photo was read as a draft. Check every date before you publish.'
      : 'No dates were found in that photo. Type them in. Nothing was published.',
  };
}

async function readImage(bytes: Buffer, mime: string): Promise<string | null> {
  const openRouter = process.env.OPENROUTER_API_KEY?.trim();
  const gemini = process.env.GEMINI_API_KEY?.trim();
  try {
    if (openRouter && aiKeyPresent({ OPENROUTER_API_KEY: openRouter })) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouter}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://poketschool.ai',
          'X-Title': 'Poket School',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: TEXT_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${bytes.toString('base64')}` } },
            ],
          }],
        }),
      });
      if (!response.ok) return null;
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
      return payload.choices?.[0]?.message?.content ?? null;
    }
    if (gemini && aiKeyPresent({ GEMINI_API_KEY: gemini })) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(gemini)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: TEXT_PROMPT },
                { inline_data: { mime_type: mime, data: bytes.toString('base64') } },
              ],
            }],
          }),
        },
      );
      if (!response.ok) return null;
      const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('\n') ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

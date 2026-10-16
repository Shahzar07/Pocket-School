import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import { LANGUAGE_NAMES } from '@/lib/languages';
import { providerStatus } from '@/lib/speech/capabilities';

export const maxDuration = 60;

const MAX_AUDIO = 2_500_000;

async function transcribeWithGemini(apiKey: string, audio: string, mime: string, languageName: string): Promise<string | null> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Transcribe this learner voice note in ${languageName}. Reply with only the spoken words. If the audio is silent, reply with an empty string.` },
            { inline_data: { mime_type: mime, data: audio } },
          ],
        }],
      }),
    },
  );
  if (!response.ok) return null;
  const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join(' ').trim() ?? '';
  return text;
}

/**
 * POST /api/ai/transcribe
 * Body: { audio: base64, mime?: string, language?: string }
 * Uses SPEECH_API_KEY, then GEMINI_API_KEY. Missing keys return fallback: true.
 */
export async function POST(req: NextRequest) {
  const denied = await enforceAiAccess(req);
  if (denied) return denied;
  let audio = '';
  let mime = 'audio/webm';
  let language = 'en';
  try {
    const body = await req.json() as { audio?: unknown; mime?: unknown; language?: unknown };
    audio = typeof body.audio === 'string' ? body.audio : '';
    if (typeof body.mime === 'string' && /^audio\/[a-z0-9.+-]+$/i.test(body.mime)) mime = body.mime;
    if (typeof body.language === 'string') language = body.language;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!audio.trim()) return NextResponse.json({ error: 'audio is required' }, { status: 400 });
  if (audio.length > MAX_AUDIO) {
    return NextResponse.json({ error: 'That voice note is too long. Record a shorter one.' }, { status: 413 });
  }
  const status = providerStatus(process.env);
  const languageName = LANGUAGE_NAMES[language] ?? 'English';
  const keys = [
    status.speech ? process.env.SPEECH_API_KEY?.trim() : '',
    status.gemini ? process.env.GEMINI_API_KEY?.trim() : '',
  ].filter((key): key is string => Boolean(key));
  if (!keys.length) {
    return NextResponse.json({
      fallback: true,
      reason: 'SPEECH_API_KEY is not set, and GEMINI_API_KEY is not set. Voice notes can still use this browser’s transcript.',
    });
  }
  for (const key of keys) {
    try {
      const transcript = await transcribeWithGemini(key, audio, mime, languageName);
      if (transcript !== null) return NextResponse.json({ transcript, fallback: false });
    } catch (err) {
      console.error('[ai/transcribe]', err);
    }
  }
  return NextResponse.json({
    fallback: true,
    reason: 'The speech service could not transcribe that note. You can type it, or use this browser’s transcript when one is available.',
  });
}

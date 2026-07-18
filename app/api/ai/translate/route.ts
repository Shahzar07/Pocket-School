import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';

export const maxDuration = 60;

const LANG_NAMES: Record<string, string> = {
  en: 'English', ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German',
  pt: 'Portuguese', zh: 'Chinese (Simplified)', hi: 'Hindi', ur: 'Urdu',
  tr: 'Turkish', ja: 'Japanese', ko: 'Korean', it: 'Italian', ru: 'Russian',
  sw: 'Swahili',
};

/**
 * POST /api/ai/translate — translate a video storyboard (or any lesson text)
 * into a target language while preserving the storyboard structure so the
 * player can re-parse it scene by scene.
 *
 * Body: { text: string, language: string }
 * → { result: string }
 */
export async function POST(req: NextRequest) {
  let text = '';
  let language = '';
  try {
    const body = await req.json();
    text = (body.text ?? '').toString().slice(0, 16000);
    language = (body.language ?? '').toString();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });
  const langName = LANG_NAMES[language];
  if (!langName) return NextResponse.json({ error: `Unsupported language: ${language}` }, { status: 400 });
  if (language === 'en') return NextResponse.json({ result: text });

  try {
    const result = await callOpenRouter(
      [{
        role: 'user',
        content:
          `Translate the following educational video storyboard into ${langName}.\n` +
          `STRICT RULES:\n` +
          `- Keep EXACTLY the same number of scenes and the same markdown structure.\n` +
          `- Keep headings in the form "### Scene N — <translated title>".\n` +
          `- Keep "[VISUAL: ...]" lines, translating only the text inside the brackets.\n` +
          `- Translate all narration naturally and conversationally, as spoken ${langName}.\n` +
          `- Do not add commentary, notes, or anything outside the storyboard.\n\n` +
          `Storyboard:\n${text}`,
      }],
      { model: CONTENT_MODEL, maxTokens: 8000 }
    );
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error('[translate]', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Translation failed' }, { status: 500 });
  }
}

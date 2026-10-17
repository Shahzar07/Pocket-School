import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES } from '@/lib/study/prompts';

export const maxDuration = 60;

interface ReadResult {
  problems: { text: string }[];
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

interface WritingResult {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

/** POST { image: dataURL, purpose?: 'maths' | 'writing' }. Maths returns problems. Writing returns the handwritten words. */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const image = body?.image;
    const purpose = body?.purpose === 'writing' ? 'writing' : 'maths';
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return Response.json({ error: 'Send a photo of the problem.' }, { status: 400 });
    }
    if (image.length > 6_000_000) return Response.json({ error: 'That photo is too large — crop closer to the problem.' }, { status: 413 });

    if (purpose === 'writing') {
      const result = await chatJSON<WritingResult>({
        models: MODELS.VISION,
        maxTokens: 2000,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `You transcribe photographed writing, printed or handwritten, exactly as written.
- Keep the student's words, spelling, and paragraph breaks. Never correct, complete, mark, or continue the work.
- If part of the image is unreadable, transcribe what you can and say what is unclear in "note".
${JSON_RULES}
Shape: {"text":"...","confidence":"high"|"medium"|"low","note":"optional"}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe the writing in this image.' },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      });
      const text = String(result.text ?? '').trim();
      if (!text) {
        return Response.json({ error: result.note || "I couldn't read any writing in that photo. Try a closer, brighter shot." }, { status: 422 });
      }
      return Response.json({ text, confidence: result.confidence ?? 'medium', note: result.note ?? null });
    }

    const result = await chatJSON<ReadResult>({
      models: MODELS.VISION,
      maxTokens: 1500,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You transcribe photographed maths problems, printed or handwritten, exactly as written.
- Keep every number, sign, exponent, fraction, unit and instruction ("find", "show that", "hence"). Never solve, simplify or correct anything.
- If there are several separate questions, return each one separately, in reading order, including its own number or letter.
- If part of the image is unreadable, transcribe what you can and say what is unclear in "note".
${JSON_RULES}
Shape: {"problems":[{"text":"..."}],"confidence":"high"|"medium"|"low","note":"optional"}`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe the maths problem(s) in this image.' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    });
    const problems = (result.problems ?? []).map(p => ({ text: String(p.text ?? '').trim() })).filter(p => p.text);
    if (!problems.length) {
      return Response.json({ error: result.note || "I couldn't find a maths problem in that photo. Try a closer, brighter shot." }, { status: 422 });
    }
    return Response.json({ problems, confidence: result.confidence ?? 'medium', note: result.note ?? null });
  } catch (e) {
    return errorResponse(e, 'Could not read the photo.');
  }
}

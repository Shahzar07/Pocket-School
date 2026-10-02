import { requireUser, errorResponse } from '@/lib/server-auth';
import { streamChat, textStreamResponse, MODELS, type ChatMessage } from '@/lib/study/ai';
import { LEVEL_HINT, lang } from '@/lib/study/prompts';

export const maxDuration = 60;

/** POST { message, history, topic, subject, material, level, language } → streamed answer grounded in the student's notes. */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const topic = body.topic ?? null;
    const history: ChatMessage[] = (Array.isArray(body.history) ? body.history : []).slice(-12).map((m: { role: string; text: string }) => ({
      role: m.role === 'tutor' ? 'assistant' : 'user',
      content: String(m.text ?? '').slice(0, 3000),
    }));
    const stream = await streamChat({
      models: MODELS.TUTOR,
      temperature: 0.5,
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content: `You are ET, Poket School's tutor, helping a student revise for their ${body.subject || ''} exam — "as if they were talking to their own notes".
${topic ? `They are studying the topic "${topic.title}": ${topic.summary ?? ''}` : 'They may ask about any topic in their material.'}
Answer from THEIR material first and say so when you do ("your notes define it as…"). If the material doesn't cover something, say that, then answer correctly at their level.
Teach rather than tell: explain clearly, give a short example, and when useful end with a quick question to check understanding. Keep replies under 180 words. Use LaTeX ($...$) for maths and short paragraphs, not walls of bullets.
${LEVEL_HINT(body.level)}
${lang(body.language)}

STUDENT'S MATERIAL:
${String(body.material ?? '').slice(0, 80_000) || '(none provided)'}`,
        },
        ...history,
        { role: 'user', content: String(body.message ?? '').slice(0, 3000) },
      ],
    });
    return textStreamResponse(stream);
  } catch (e) {
    return errorResponse(e, 'ET is unavailable right now.');
  }
}

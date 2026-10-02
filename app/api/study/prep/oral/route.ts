import { requireUser, errorResponse } from '@/lib/server-auth';
import { streamChat, textStreamResponse, MODELS, type ChatMessage } from '@/lib/study/ai';
import { LEVEL_HINT, lang } from '@/lib/study/prompts';

export const maxDuration = 60;

/**
 * POST { transcript, topics, subject, questionNumber, totalQuestions, level, language }
 * → the examiner's next spoken turn, streamed. Exam conditions: the examiner
 * probes and moves on, but does not teach or give away answers mid-exam.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const n = Number(body.questionNumber) || 1;
    const total = Number(body.totalQuestions) || 5;
    const topics: { title: string; summary: string }[] = body.topics ?? [];
    const transcript: ChatMessage[] = (body.transcript ?? []).slice(-16).map((m: { role: string; text: string }) => ({
      role: m.role === 'examiner' ? 'assistant' : 'user',
      content: String(m.text ?? '').slice(0, 2000),
    }));
    const stream = await streamChat({
      models: MODELS.TUTOR,
      temperature: 0.6,
      maxTokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are ET acting as a calm, professional oral examiner for a ${body.subject || ''} exam. Everything you say is spoken aloud, so use plain spoken language: no Markdown, no LaTeX, no lists.
The exam has ${total} main questions; this is turn for question ${n}.
- If this is the start, welcome the student in one sentence, explain there are ${total} questions and they should explain their thinking out loud, then ask question 1.
- Otherwise: acknowledge their last answer neutrally in a few words (do NOT say if it was right or teach the answer). If it was vague or incomplete, you may ask ONE short follow-up probe instead of moving on. Otherwise ask the next question.
- Questions should require explanation, not one-word recall: "Explain why…", "Walk me through how you would…", "What's the difference between…". Cover different topics, getting harder.
- When all ${total} questions are answered, thank them and say the exam is over — do not grade them.
Keep each turn under 60 words.
Topics: ${topics.map(t => `${t.title} (${t.summary})`).join('; ')}
${LEVEL_HINT(body.level)}
${lang(body.language)}`,
        },
        ...transcript,
        ...(transcript.length ? [] : [{ role: 'user' as const, content: 'I am ready to start.' }]),
      ],
    });
    return textStreamResponse(stream);
  } catch (e) {
    return errorResponse(e, 'The examiner is unavailable right now.');
  }
}

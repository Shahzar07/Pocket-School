import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES, LEVEL_HINT, lang } from '@/lib/study/prompts';
import type { MockQuestion } from '@/lib/study/types';

export const maxDuration = 120;

/**
 * POST { topics, subject, material, minutes, level, language, focus? }
 * → a timed mock paper covering the topics in proportion to their weight,
 * with a mark scheme the marker uses afterwards.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const topics: { id: string; title: string; summary: string; weight: number }[] = (body.topics ?? []).slice(0, 14);
    if (!topics.length) return Response.json({ error: 'This exam prep has no topics yet.' }, { status: 400 });
    const minutes = Math.max(10, Math.min(120, Number(body.minutes) || 30));
    const count = Math.max(5, Math.min(16, Math.round(minutes / 3.5)));

    const out = await chatJSON<{ questions: Omit<MockQuestion, 'id'>[] }>({
      models: MODELS.SOLVER,
      effort: 'low',
      maxTokens: 9000,
      messages: [
        {
          role: 'system',
          content: `You are a senior examiner setting a ${minutes}-minute mock paper for a student's ${body.subject || ''} exam, written in the style of the real exam.
Write ${count} questions. Cover the topics below in proportion to their weight (1–5)${body.focus?.length ? `, with extra questions on these weak topics: ${body.focus.join(', ')}` : ''}.
Mix types: "mcq" (4 options, 1 mark), "short" (1–3 marks), "structured" (4–8 marks, multi-step). Increase difficulty through the paper.
For every question give:
- "topicId": one of the ids below.
- "question": the question as it would appear on the paper (state marks for structured parts).
- "options": only for mcq.
- "marks": integer.
- "markScheme": how marks are awarded, point by point (M1/A1 style for maths).
- "answer": the model answer.
Ground questions in the student's material where it has examples or past-paper questions.
Topics:
${topics.map(t => `- ${t.id} (weight ${t.weight}): ${t.title} — ${t.summary}`).join('\n')}
${LEVEL_HINT(body.level)}
${JSON_RULES}
Shape: {"questions":[{"topicId":"","type":"mcq","question":"","options":["","","",""],"marks":1,"markScheme":"","answer":""}]}
${lang(body.language)}`,
        },
        { role: 'user', content: `STUDENT'S MATERIAL:\n${String(body.material ?? '').slice(0, 70_000) || '(none)'}` },
      ],
    });

    const ids = new Set(topics.map(t => t.id));
    const questions: MockQuestion[] = (out.questions ?? [])
      .filter(q => q?.question)
      .map((q, i) => ({
        id: `q${i + 1}`,
        topicId: ids.has(q.topicId) ? q.topicId : topics[i % topics.length].id,
        type: q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2 ? 'mcq' : q.type === 'structured' ? 'structured' : 'short',
        question: String(q.question),
        options: q.type === 'mcq' ? (q.options ?? []).map(String) : undefined,
        marks: Math.max(1, Math.min(12, Math.round(Number(q.marks) || 1))),
        markScheme: String(q.markScheme ?? ''),
        answer: String(q.answer ?? ''),
      }));
    if (questions.length < 3) throw new Error('The paper came back too short — please try again.');
    return Response.json({ questions, minutes });
  } catch (e) {
    return errorResponse(e, 'Could not set the mock exam.');
  }
}

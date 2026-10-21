import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES, lang } from '@/lib/study/prompts';
import { packTopics, type PackQuestion } from '@/lib/study/exam-packs';
import { publishedPack } from '@/lib/study/pack-server';

export const maxDuration = 120;

const DIFF = {
  easier: 'at the easier end of the paper (early questions, 1–3 marks)',
  similar: 'across the typical range of the paper (2–6 marks)',
  harder: 'at the hard end of the paper (long, multi-step questions, 5–9 marks)',
};

/**
 * POST { packId, topicId, difficulty, language } → 5 exam-style questions for
 * one syllabus topic, each with a mark scheme–quality worked solution.
 * Written by the reasoning model so the answers can be trusted.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const pack = await publishedPack(String(body.packId));
    const topic = pack ? packTopics(pack).find(tp => tp.id === body.topicId) : null;
    if (!pack || !topic) return Response.json({ error: 'Unknown pack or topic.' }, { status: 400 });
    const difficulty = (['easier', 'similar', 'harder'].includes(body.difficulty) ? body.difficulty : 'similar') as keyof typeof DIFF;

    const out = await chatJSON<{ questions: PackQuestion[] }>({
      models: MODELS.SOLVER,
      effort: 'medium',
      maxTokens: 9000,
      messages: [
        {
          role: 'system',
          content: `You are a senior examiner for ${pack.name} (${pack.board}, ${pack.level}). Write 5 original exam-style questions on the syllabus topic "${topic.title}" (${topic.unit}), ${DIFF[difficulty]}.
- Match the board's real style: command words, notation, units, mark allocations, and multi-part (a)(b) structure where typical.
- Questions must be original — never reproduce a real past-paper question.
- Every question must be fully specified and have a clean, checkable answer. Verify each answer yourself.
For each: "question" (Markdown + LaTeX), "marks", "paper" (e.g. "Paper 2"), "answer" (final answer only), "solution" (complete worked solution showing the method marks, step by step).
${JSON_RULES}
Shape: {"questions":[{"question":"","marks":4,"paper":"","answer":"","solution":""}]}
${lang(body.language)}`,
        },
        { role: 'user', content: `Write the 5 questions on ${topic.title}.` },
      ],
    });
    const questions = (out.questions ?? []).filter(q => q?.question && q?.solution).slice(0, 6).map(q => ({
      question: String(q.question), marks: Math.max(1, Math.min(12, Math.round(Number(q.marks) || 3))),
      paper: String(q.paper ?? ''), answer: String(q.answer ?? ''), solution: String(q.solution),
    }));
    if (questions.length < 2) throw new Error('The question set came back incomplete — please try again.');
    return Response.json({ questions });
  } catch (e) {
    return errorResponse(e, 'Could not create practice questions.');
  }
}

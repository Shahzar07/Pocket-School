import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES, lang } from '@/lib/study/prompts';
import { correctIndex } from '@/lib/quiz-answer';
import type { KnowledgeGap, MarkedAnswer, MockQuestion } from '@/lib/study/types';

export const maxDuration = 120;

/**
 * POST { questions, answers: {qid: text}, topics, subject, language }
 * → marks per question against the mark scheme, a summary, and the
 * knowledge gaps ranked by how much they cost.
 *
 * Multiple-choice is marked exactly, in code. Only written answers go to the
 * model — partial credit needs judgement; picking option B does not.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const questions: MockQuestion[] = body.questions ?? [];
    const answers: Record<string, string> = body.answers ?? {};
    const topics: { id: string; title: string }[] = body.topics ?? [];
    const topicTitle = (id: string) => topics.find(t => t.id === id)?.title ?? id;

    const marked: Record<string, MarkedAnswer> = {};
    const written: MockQuestion[] = [];
    for (const q of questions) {
      const given = (answers[q.id] ?? '').trim();
      if (q.type === 'mcq' && q.options?.length) {
        const right = given && correctIndex(q.options, given) === correctIndex(q.options, q.answer);
        marked[q.id] = { questionId: q.id, awarded: right ? q.marks : 0, marks: q.marks, feedback: right ? 'Correct.' : `The answer is: ${q.answer}` };
      } else if (!given) {
        marked[q.id] = { questionId: q.id, awarded: 0, marks: q.marks, feedback: 'Not answered.' };
      } else written.push(q);
    }

    let summary = '';
    let gaps: KnowledgeGap[] = [];
    if (written.length || questions.length) {
      const out = await chatJSON<{ marks: { questionId: string; awarded: number; feedback: string }[]; summary: string; gaps: { topicId: string; severity: string; issue: string; fix: string }[] }>({
        models: MODELS.SOLVER,
        effort: 'low',
        maxTokens: 7000,
        messages: [
          {
            role: 'system',
            content: `You are a fair, experienced examiner marking a student's mock exam against the mark scheme.
For each WRITTEN answer: award marks strictly by the scheme, allowing method marks for correct working even when the final answer is wrong, and accepting equivalent correct forms. Feedback is 1–2 sentences, specific: what earned marks, what lost them.
Then, looking at the WHOLE paper (including the multiple-choice results given), write:
- "summary": 2–3 encouraging, honest sentences on overall performance.
- "gaps": the knowledge gaps, each {"topicId","severity":"weakest"|"attention"|"minor","issue":"what they don't yet understand","fix":"exactly what to practise next"}. Rank most costly first. At most 5. Omit topics they handled well.
${JSON_RULES}
Shape: {"marks":[{"questionId":"","awarded":0,"feedback":""}],"summary":"","gaps":[]}
${lang(body.language)}`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              written: written.map(q => ({ id: q.id, topicId: q.topicId, question: q.question, marks: q.marks, markScheme: q.markScheme, modelAnswer: q.answer, studentAnswer: (answers[q.id] ?? '').slice(0, 4000) })),
              multipleChoice: questions.filter(q => q.type === 'mcq').map(q => ({ id: q.id, topicId: q.topicId, question: q.question, correct: marked[q.id]?.awarded > 0 })),
              unanswered: questions.filter(q => marked[q.id]?.feedback === 'Not answered.').map(q => ({ id: q.id, topicId: q.topicId })),
            }),
          },
        ],
      });
      for (const m of out.marks ?? []) {
        const q = written.find(w => w.id === m.questionId);
        if (!q) continue;
        marked[q.id] = { questionId: q.id, awarded: Math.max(0, Math.min(q.marks, Math.round(Number(m.awarded) || 0))), marks: q.marks, feedback: String(m.feedback ?? '') };
      }
      summary = String(out.summary ?? '');
      gaps = (out.gaps ?? []).slice(0, 5).map(g => ({
        topicId: String(g.topicId),
        topic: topicTitle(String(g.topicId)),
        severity: (['weakest', 'attention', 'minor'].includes(g.severity) ? g.severity : 'attention') as KnowledgeGap['severity'],
        issue: String(g.issue ?? ''),
        fix: String(g.fix ?? ''),
      }));
    }
    // Anything the model skipped is marked zero rather than silently dropped.
    for (const q of written) if (!marked[q.id]) marked[q.id] = { questionId: q.id, awarded: 0, marks: q.marks, feedback: 'Could not be marked automatically — compare with the model answer.' };

    const list = questions.map(q => marked[q.id]);
    const score = list.reduce((s, m) => s + m.awarded, 0);
    const max = list.reduce((s, m) => s + m.marks, 0);
    // Per-topic percentages, used to update mastery.
    const byTopic: Record<string, { got: number; of: number }> = {};
    questions.forEach(q => {
      const m = marked[q.id];
      byTopic[q.topicId] ??= { got: 0, of: 0 };
      byTopic[q.topicId].got += m.awarded;
      byTopic[q.topicId].of += m.marks;
    });
    const topicScores = Object.fromEntries(Object.entries(byTopic).map(([k, v]) => [k, v.of ? Math.round((v.got / v.of) * 100) : 0]));
    return Response.json({ marked: list, score, max, percent: max ? Math.round((score / max) * 100) : 0, summary, gaps, topicScores });
  } catch (e) {
    return errorResponse(e, 'Could not mark the paper.');
  }
}

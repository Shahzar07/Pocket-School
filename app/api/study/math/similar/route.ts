import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES, LEVEL_HINT, lang } from '@/lib/study/prompts';

export const maxDuration = 60;

const DIFFICULTY = {
  easier: 'slightly EASIER: fewer steps or friendlier numbers, same core idea',
  similar: 'the SAME difficulty and method with different numbers and context',
  harder: 'a little HARDER: one extra step or a twist, at exam standard',
};

/** POST { problem, topic, difficulty } → a new practice problem of the same type. */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const { problem, topic, difficulty = 'similar', level, language } = await req.json();
    const d = DIFFICULTY[difficulty as keyof typeof DIFFICULTY] ?? DIFFICULTY.similar;
    const out = await chatJSON<{ problem: string }>({
      models: MODELS.FAST,
      temperature: 0.9,
      maxTokens: 800,
      messages: [
        {
          role: 'system',
          content: `You write maths practice problems. Write ONE new problem on "${topic || 'the same topic'}" that is ${d}. It must be fully specified and have a clean answer. Do not include the answer.
${LEVEL_HINT(level)}
${JSON_RULES}
Shape: {"problem":"Markdown with LaTeX"}
${lang(language)}`,
        },
        { role: 'user', content: `Original problem:\n${String(problem ?? '').slice(0, 3000)}` },
      ],
    });
    if (!out.problem) throw new Error('No problem was generated.');
    return Response.json({ problem: out.problem });
  } catch (e) {
    return errorResponse(e, 'Could not create a practice problem.');
  }
}

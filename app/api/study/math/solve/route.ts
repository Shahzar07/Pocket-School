import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES, LEVEL_HINT, lang } from '@/lib/study/prompts';
import type { MathSolution } from '@/lib/study/types';

export const maxDuration = 120;

/**
 * POST { problem, level?, language? } → a fully worked, self-checked solution.
 *
 * This is the answer key the tutor teaches from, so it runs on a reasoning
 * model and is asked to verify its own answer before replying. It is solved
 * once per problem; every tutoring turn after that is fast because it only
 * has to compare the student's work against this key.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const { problem, level, language } = await req.json();
    if (typeof problem !== 'string' || problem.trim().length < 2) {
      return Response.json({ error: 'Type or scan a problem first.' }, { status: 400 });
    }

    const solution = await chatJSON<MathSolution & { error?: string }>({
      models: MODELS.SOLVER,
      effort: 'medium',
      maxTokens: 6000,
      messages: [
        {
          role: 'system',
          content: `You are a meticulous mathematics examiner writing the official worked solution to a problem.
Solve it completely and correctly. Before answering, verify the result: substitute back, check signs, units, domain restrictions and extraneous roots. If the question has several parts, solve every part in order.
${LEVEL_HINT(level)}

Write the solution as a sequence of steps a strong teacher would use with this student:
- Each step is ONE move (expand, collect terms, factorise, apply a rule, substitute…). Usually 3–8 steps.
- "title": a short imperative, e.g. "Subtract 3 from both sides".
- "explanation": why this move, in 1–3 plain sentences.
- "result": the line of working the step produces, in LaTeX.

Also give:
- "problem": the problem restated cleanly (Markdown + LaTeX).
- "topic": the syllabus topic, e.g. "Quadratic equations".
- "level": typical level, e.g. "IGCSE".
- "method": one sentence naming the method.
- "finalAnswer": the final answer in LaTeX, every part included.
- "checkValues": the final numeric answer(s) as plain numbers when the answer is numeric, otherwise [].
- "commonMistakes": 1–3 mistakes students typically make on this kind of problem.
- "graph": when the problem involves a function, line, curve or inequality on a graph, give {"functions":["…"],"xMin":n,"xMax":n,"points":[{"x":n,"y":n,"label":"…"}]} with functions written in plain calculator syntax in x (e.g. "2*x^2-3", "sin(x)", "sqrt(x+1)") — never LaTeX. Mark roots, intercepts or turning points as points. Otherwise null.

If the input is not a maths problem, or is too incomplete to solve, return {"error":"a short, friendly explanation"} instead.
${JSON_RULES}
${lang(language)}`,
        },
        { role: 'user', content: `Problem:\n${problem.slice(0, 6000)}` },
      ],
    });

    if (solution.error) return Response.json({ error: solution.error }, { status: 422 });
    if (!Array.isArray(solution.steps) || !solution.steps.length || !solution.finalAnswer) {
      return Response.json({ error: "I couldn't produce a reliable solution for that. Check the problem is complete and try again." }, { status: 422 });
    }
    const clean: MathSolution = {
      problem: String(solution.problem || problem),
      topic: String(solution.topic || 'Mathematics'),
      level: String(solution.level || ''),
      method: String(solution.method || ''),
      finalAnswer: String(solution.finalAnswer),
      checkValues: (solution.checkValues ?? []).map(Number).filter(Number.isFinite),
      steps: solution.steps.slice(0, 14).map(s => ({
        title: String(s.title ?? ''), explanation: String(s.explanation ?? ''), result: String(s.result ?? ''),
      })),
      commonMistakes: (solution.commonMistakes ?? []).map(String).slice(0, 4),
      graph: solution.graph && Array.isArray(solution.graph.functions) && solution.graph.functions.length
        ? {
            functions: solution.graph.functions.map(String).slice(0, 4),
            xMin: Number.isFinite(solution.graph.xMin) ? solution.graph.xMin : undefined,
            xMax: Number.isFinite(solution.graph.xMax) ? solution.graph.xMax : undefined,
            points: (solution.graph.points ?? []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)).slice(0, 8),
          }
        : null,
    };
    return Response.json(clean);
  } catch (e) {
    return errorResponse(e, 'Could not solve that problem.');
  }
}

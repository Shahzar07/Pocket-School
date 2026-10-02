import { requireUser, errorResponse } from '@/lib/server-auth';
import { streamChat, textStreamResponse, MODELS, type ChatMessage } from '@/lib/study/ai';
import { LEVEL_HINT, lang } from '@/lib/study/prompts';
import type { MathSolution } from '@/lib/study/types';

export const maxDuration = 60;

export type TutorAction =
  | 'start' | 'step' | 'hint' | 'explain_again' | 'simpler' | 'reveal_step' | 'why' | 'check' | 'explain_step';

const ACTIONS: Record<TutorAction, string> = {
  start: 'The student has just opened this problem. Greet them in one short sentence, restate what the question asks in plain words, and ask what they think the first step is. Do not give the first step.',
  step: 'The student has proposed their next step (below). Judge it against the next unfinished step of the answer key. Accept any mathematically valid route, even if it differs from the key, and adapt. If it is right, confirm briefly and why, show the resulting line in LaTeX, then ask for the next step. If it is partly right, say what is right, point to exactly what is wrong, and ask them to try again. If it is wrong, do not give the answer — name the misconception and give a small nudge.',
  hint: 'Give ONE small hint towards the next unfinished step only. Do not state the step or its result.',
  explain_again: 'The student did not understand the last explanation. Explain the current step again in a completely different way — simpler words, an everyday analogy or a tiny numeric example. Then ask them to try.',
  simpler: 'Explain the idea behind the current step as you would to a younger student, using the simplest possible language and a concrete example. Then ask them to try.',
  reveal_step: 'The student is stuck. Show the next unfinished step fully: what to do, why, and the resulting line in LaTeX. Then ask them to attempt the step after it. This completes one more step.',
  why: 'The student asked a question (below). Answer it directly and clearly in the context of this problem, without revealing later steps unless they ask for them.',
  check: 'The student has given a final answer (below). Compare it with the answer key. If correct, celebrate briefly and summarise the method in one sentence. If not, say which part is wrong and give a hint — never just give the answer.',
  explain_step: 'The student wants one step of the worked solution explained in more depth (the step number is below). Explain why that step works and how you would know to do it, with a short example if it helps.',
};

/**
 * POST → streamed tutor reply.
 *
 * The reply opens with a control line the UI reads and hides:
 *   [[verdict:correct|partly|wrong|none]] [[done:N]]
 * where N is how many answer-key steps are complete after this reply. That
 * is how the step tracker moves without a second request.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const solution = body.solution as MathSolution | undefined;
    const action = (body.action as TutorAction) ?? 'why';
    if (!solution?.steps?.length) return Response.json({ error: 'Solve the problem first.' }, { status: 400 });
    if (!ACTIONS[action]) return Response.json({ error: 'Unknown action.' }, { status: 400 });

    const stepsDone = Math.max(0, Math.min(solution.steps.length, Number(body.stepsDone) || 0));
    const mode = body.mode === 'solve' ? 'solve' : 'guide';
    const key = solution.steps
      .map((s, i) => `Step ${i + 1}${i < stepsDone ? ' (DONE)' : i === stepsDone ? ' (NEXT)' : ''}: ${s.title} — ${s.explanation} ⇒ ${s.result}`)
      .join('\n');

    const system = `You are ET, Poket School's maths tutor: warm, precise and encouraging. You teach the way the best human tutors do — the student does the thinking, you guide.
${LEVEL_HINT(body.level)}

PROBLEM:
${solution.problem}

ANSWER KEY (private — written by an examiner and verified; trust it):
Method: ${solution.method}
${key}
Final answer: ${solution.finalAnswer}
Common mistakes: ${solution.commonMistakes.join('; ')}

Steps completed so far: ${stepsDone} of ${solution.steps.length}.
Mode: ${mode === 'guide' ? 'GUIDED — never reveal the final answer or the result of a step the student has not reached, unless the task below says to.' : 'WORKED SOLUTION — the student has seen the full solution; explain freely.'}

YOUR TASK NOW: ${ACTIONS[action]}

FORMAT — strictly:
1. The very first line is exactly: [[verdict:X]] [[done:N]]
   X is correct, partly, wrong, or none (none when you are not judging work). N is the number of key steps complete after this reply (${stepsDone} unless this reply completes a step).
2. Then your reply: at most 120 words, conversational, short paragraphs, LaTeX with $...$ for all maths. No headings. End with a question when the student should act.
3. When N reaches ${solution.steps.length}, congratulate them, state the final answer and offer a similar or harder problem.
${body.numericCheck ? `\nAn exact numeric check on the student's answer says it is ${body.numericCheck === 'match' ? 'CORRECT' : 'NOT equal to the key'} — rely on this.` : ''}
${lang(body.language)}`;

    const history: ChatMessage[] = (Array.isArray(body.history) ? body.history : [])
      .slice(-12)
      .map((m: { role: string; text: string }) => ({
        role: m.role === 'tutor' ? 'assistant' : 'user',
        content: String(m.text ?? '').slice(0, 3000),
      }));

    const input = String(body.input ?? '').slice(0, 3000);
    const userTurn = action === 'start'
      ? 'Start.'
      : action === 'explain_step'
        ? `Please explain step ${Number(body.stepIndex) + 1} in more depth.`
        : input || ACTIONS[action];

    const stream = await streamChat({
      models: MODELS.TUTOR,
      temperature: 0.5,
      maxTokens: 700,
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: userTurn }],
    });
    return textStreamResponse(stream);
  } catch (e) {
    return errorResponse(e, 'The tutor is unavailable right now.');
  }
}

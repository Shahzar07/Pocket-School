import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES, LEVEL_HINT, lang } from '@/lib/study/prompts';
import type { AssetType, Difficulty, PodcastStyle } from '@/lib/study/types';

export const maxDuration = 120;

const DIFF: Record<Difficulty, string> = {
  easier: 'Pitch it slightly EASIER than exam standard — build confidence, one idea per question.',
  similar: 'Pitch it at the standard of the real exam.',
  harder: 'Pitch it HARDER than typical exam questions — multi-step, unfamiliar contexts, common traps.',
};

const PODCAST: Record<PodcastStyle, string> = {
  dialogue: 'A relaxed conversation between Host (A), a friendly teacher, and Guest (B), a curious student who asks the questions a real student would. About 24–30 lines.',
  recap: 'A brisk recap by Host (A) alone — the essentials in the order they matter, like a revision voice note. About 10–14 lines, all speaker A.',
  qa: 'A quick-fire quiz show: Host (A) asks exam-style questions, Guest (B) answers, Host confirms or corrects with the reason. About 20–26 lines.',
  simple: 'Host (A) alone explains it as simply as possible, with everyday analogies, for someone meeting it for the first time. About 12–16 lines, all speaker A.',
  deepdive: 'Two teachers (A and B) go deeper — why it works, links to other topics, the exam-level subtleties. About 24–30 lines.',
};

const SPEC: Record<AssetType, (o: { difficulty: Difficulty; style: PodcastStyle }) => string> = {
  lesson: () => `Write a complete, engaging lesson on this topic.
- Flowing explanation in short paragraphs, the way a great teacher writes — NOT a list of bullet points. Use bullets only for a genuine list (e.g. steps of a method).
- Use "##" headings for 3–5 sections, **bold** for key terms, a worked example (with full working), and a Markdown table where a comparison helps.
- End with a short "## In the exam" section: how this is examined and the mistakes that lose marks.
- 450–800 words. Use the student's material as the source of truth.
Also give 2–3 "checkpoints": quick questions (with short answers) to check understanding.
Shape: {"markdown":"...","checkpoints":[{"question":"","answer":""}]}`,
  flashcards: () => `Make 12–16 flashcards covering every key fact, definition, formula and method in this topic.
Fronts are short prompts or questions; backs are crisp, complete answers (one or two sentences, or a formula).
Shape: {"cards":[{"front":"","back":""}]}`,
  quiz: ({ difficulty }) => `Write 7 multiple-choice questions testing understanding (not just recall). ${DIFF[difficulty]}
Each has exactly 4 options; distractors must be plausible and based on real misconceptions. "answer" is the EXACT text of the correct option. "explanation" says why it is right and why the tempting wrong option is wrong.
Shape: {"questions":[{"question":"","options":["","","",""],"answer":"","explanation":""}]}`,
  truefalse: () => `Write 10 true-or-false statements. Mix true and false roughly evenly; false ones should be subtly wrong in the way students get it wrong.
Shape: {"items":[{"statement":"","answer":true,"explanation":""}]}`,
  exercises: ({ difficulty }) => `Write 4 exam-style exercises with full mark-scheme-quality solutions. ${DIFF[difficulty]}
"prompt": the question (state the marks in the question if structured). "hint": one nudge. "solution": full worked solution, step by step. "answer": the final answer only. "marks": total marks.
Shape: {"exercises":[{"prompt":"","hint":"","solution":"","answer":"","marks":4}]}`,
  podcast: ({ style }) => `Write a podcast script about this topic for audio revision. ${PODCAST[style]}
Rules: spoken English, short sentences, no Markdown, no LaTeX (say maths in words: "x squared plus three"), no stage directions. Start with a hook, end with a one-line summary.
Also give a catchy "title".
Shape: {"title":"","lines":[{"speaker":"A","text":""}]}`,
};

/** Quantitative subjects get the reasoning model for anything with answers to check. */
const QUANT = /math|physic|chem|account|econ|statist|calculus|algebra|engineer|finance|matematik|fizik|kimia/i;

/**
 * POST { type, topic, subject, material, level, language, difficulty?, style? }
 * → the learning material for one topic. The client caches it, so each
 * piece is generated once.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const type = body.type as AssetType;
    if (!SPEC[type]) return Response.json({ error: 'Unknown material type.' }, { status: 400 });
    const topic = body.topic ?? {};
    const difficulty: Difficulty = ['easier', 'similar', 'harder'].includes(body.difficulty) ? body.difficulty : 'similar';
    const style: PodcastStyle = ['dialogue', 'recap', 'qa', 'simple', 'deepdive'].includes(body.style) ? body.style : 'dialogue';
    const material = String(body.material ?? '').slice(0, 90_000);
    const precise = (type === 'quiz' || type === 'exercises') && QUANT.test(`${body.subject} ${topic.title}`);

    const data = await chatJSON<Record<string, unknown>>({
      models: precise ? MODELS.SOLVER : MODELS.FAST,
      effort: 'low',
      maxTokens: type === 'lesson' || type === 'podcast' ? 7000 : 5000,
      temperature: type === 'podcast' ? 0.8 : 0.5,
      messages: [
        {
          role: 'system',
          content: `You create revision material for one topic of a student's exam, grounded in THEIR study material. Stay faithful to it: same definitions, notation and level. Where the material is thin, fill gaps with standard, correct content at the same level.
Subject: ${body.subject || 'General'}
Topic: ${topic.title}
What the student must be able to do: ${topic.summary ?? ''}
Key points: ${(topic.keyPoints ?? []).join('; ')}
${LEVEL_HINT(body.level)}

${SPEC[type]({ difficulty, style })}
${type === 'podcast' ? 'Return ONLY valid JSON.' : JSON_RULES}
${lang(body.language)}`,
        },
        { role: 'user', content: material ? `STUDENT'S MATERIAL:\n${material}` : 'No material was provided — use standard syllabus content for this topic.' },
      ],
    });

    // Light validation so the UI never receives an empty shell.
    const ok =
      (type === 'lesson' && typeof data.markdown === 'string' && data.markdown.length > 100) ||
      (type === 'flashcards' && Array.isArray(data.cards) && data.cards.length > 0) ||
      (type === 'quiz' && Array.isArray(data.questions) && data.questions.length > 0) ||
      (type === 'truefalse' && Array.isArray(data.items) && data.items.length > 0) ||
      (type === 'exercises' && Array.isArray(data.exercises) && data.exercises.length > 0) ||
      (type === 'podcast' && Array.isArray(data.lines) && data.lines.length > 2);
    if (!ok) throw new Error('The material came back incomplete — please try again.');

    if (type === 'podcast') {
      data.style = style;
      data.lines = (data.lines as { speaker: string; text: string }[])
        .map(l => ({ speaker: l.speaker === 'B' ? 'B' : 'A', text: String(l.text ?? '').trim() }))
        .filter(l => l.text);
    }
    return Response.json(data);
  } catch (e) {
    return errorResponse(e, 'Could not create that material.');
  }
}

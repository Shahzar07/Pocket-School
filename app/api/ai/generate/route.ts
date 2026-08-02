import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL, VIDEO_MODEL } from '@/lib/openrouter';

/** Video and audio scripts use the dedicated narrative model; everything
 * else uses the ultra-cheap content model. */
const MODEL_FOR_FORMAT = (format: string) =>
  format === 'videoScript' || format === 'audioScript' ? VIDEO_MODEL : CONTENT_MODEL;

const MATH_HINT = 'If the content involves mathematics, science formulas, or equations, use LaTeX notation: inline math with $...$ and display math with $$...$$. For example: $E = mc^2$, $\\frac{a}{b}$, $$\\int_0^1 f(x)\\,dx$$.\n\n';

/** Rules that keep markdown well-formed so it renders instead of showing
 * raw `#` / `***` on screen. */
const MARKDOWN_HINT =
  'FORMATTING RULES (must follow exactly): output clean, well-formed GitHub-flavoured Markdown. ' +
  'Always put a single space after heading hashes ("## Title", never "##Title"). ' +
  'Never use "***" — use "**bold**" for emphasis only. ' +
  'Never output a line made only of "#" characters and never use "#" as a separator or decoration. ' +
  'Do not escape markdown characters (no "\\#", no "\\*"). Do not wrap the answer in code fences. ' +
  'Leave exactly one blank line between blocks — never more.\n\n';

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  zh: 'Chinese (Simplified)', hi: 'Hindi', ur: 'Urdu', tr: 'Turkish',
  ja: 'Japanese', ko: 'Korean', it: 'Italian', ru: 'Russian', sw: 'Swahili',
};

const PROMPTS: Record<string, (c: string) => string> = {
  text: (c) => `You are an expert educator. ${MATH_HINT}${MARKDOWN_HINT}Transform the following raw lesson content into a well-structured, engaging lesson in Markdown format. Use headers (##, ###), bullet points, **bold** key terms, and clear explanations. Make it comprehensive yet readable.\n\nLesson content:\n${c}`,

  flashcards: (c) => `You are a study expert. ${MATH_HINT}Create 6-8 high-quality flashcard pairs from this lesson content. Return ONLY a valid JSON array, no prose before or after it:\n[{"question":"...","answer":"..."}]\n\nLesson content:\n${c}`,

  quiz: (c) => `You are an assessment expert. ${MATH_HINT}Create 5 multiple-choice quiz questions from this lesson content. Return ONLY a valid JSON array, no prose before or after it. CRITICAL: "answer" must be the EXACT full text of the correct option (copied verbatim from "options"), never a letter or index:\n[{"question":"...","options":["first option text","second option text","third option text","fourth option text"],"answer":"second option text","explanation":"why it is correct"}]\n\nLesson content:\n${c}`,

  slides: (c) => `You are a presentation designer. Create 5-6 presentation slides from this lesson content. Return ONLY a valid JSON array — no prose, no markdown code fences, before or after it. Every element MUST be an object with exactly two keys: "title" (a string) and "bullets" (an array of 3-4 short strings). Never use "heading", "points" or "content" as keys, and never return the bullets as one long string:\n[{"title":"...","bullets":["...","...","..."]}]\n\nLesson content:\n${c}`,

  notes: (c) => `You are a study notes expert. ${MATH_HINT}${MARKDOWN_HINT}Create concise, well-structured study notes from this lesson content in Markdown. Include **bold** key terms, bullet points, and memory aids or mnemonics where helpful.\n\nLesson content:\n${c}`,

  summary: (c) => `You are an expert summariser. ${MATH_HINT}${MARKDOWN_HINT}Write a clear, concise 3-5 sentence summary of this lesson content that captures all the essential takeaways. Use accessible language.\n\nLesson content:\n${c}`,

  problems: (c) => `You are a practice problems creator. ${MATH_HINT}${MARKDOWN_HINT}Create 4-5 practice problems from this lesson content. Mix difficulty levels. For each, provide the problem statement and a detailed worked solution. Format in Markdown with LaTeX for all equations.\n\nLesson content:\n${c}`,

  glossary: (c) => `You are a vocabulary expert. Extract 6-8 key terms from this lesson content and provide clear, concise definitions. Return ONLY a valid JSON array, no prose before or after it:\n[{"term":"...","definition":"..."}]\n\nLesson content:\n${c}`,

  mindmap: (c) => `You are a mind mapping expert. ${MATH_HINT}${MARKDOWN_HINT}Create a text-based mind map of this lesson content in Markdown. Use headings for main branches and nested bullet points for sub-branches. Put the main topic at the top.\n\nLesson content:\n${c}`,

  infographic: (c) => `You are an information designer. ${MARKDOWN_HINT}Produce a scannable, data-forward infographic for this lesson in Markdown, using EXACTLY this structure and nothing else:

1. One "# Title" line — a short, punchy title (max 8 words).
2. One short intro sentence (max 25 words) as a plain paragraph.
3. Then 3-5 stat lines, each on its own line, in EXACTLY this shape:
**<stat>** — <short label>
The stat must be a compact number, percentage, count, ratio or date (e.g. "70%", "3 laws", "1687", "2x"). The label must be under 8 words. No other text on the line.
4. Then 3-5 sections. Each section is a "## Section name" heading (3 words max) followed by 3-4 "- " bullet points. Each bullet is one crisp fact of 12-20 words. Bold the key term inside the bullet with **term**.
5. Optionally a "---" separator between major groups of sections.
6. Finish with ONE blockquote line starting with "> " containing the single key takeaway (max 30 words). This must be the last line of the output.

Do not add commentary, headings, or sections beyond that structure.

Lesson content:\n${c}`,

  videoScript: (c) => `You are an educational video scriptwriter. Write a 4-6 minute video script for this lesson in Markdown.

STRUCTURE — repeat for every scene (5-8 scenes):
### Scene N — <plain scene title>
[VISUAL: one line describing the animation, footage or on-screen text]
<the spoken narration, as plain prose paragraphs>

HARD RULES FOR THE NARRATION (it is fed straight into text-to-speech, so anything you write WILL be read out loud):
- Write only the words a narrator actually says. Nothing else.
- NEVER write speaker labels such as "Narrator:", "Presenter:", "Voiceover:", "VO:", "Host:" — not even once.
- NEVER write stage-direction words or section labels in the narration or in scene titles: no HOOK, INTRO, OUTRO, RECAP, CTA, MUSIC, SFX, B-ROLL, CUT TO, FADE IN/OUT, TITLE CARD, "(pause)", "(beat)".
- Scene titles must be plain descriptive titles ("The Tiny World"), never "HOOK: The Tiny World".
- No markdown inside the narration: no **bold**, no *italics*, no headings, no bullet points, no backticks.
- No ellipses ("..." or "…"), no em-dash asides used as breath marks. Use ordinary sentences with normal punctuation.
- All visual/production directions go ONLY inside the single [VISUAL: ...] line for that scene — never in the narration.

Open the first scene with an attention-grabbing question or fact (without labelling it as a hook) and close the last scene with a short recap (without labelling it as a recap). Conversational, age-appropriate tone.

Lesson content:\n${c}`,

  audioScript: (c) => `You are an educational podcast writer. Write a 60-90 second audio revision summary script for this lesson. Conversational, friendly tone as if speaking directly to one student. Plain prose only — no headings, no stage directions, no markdown — because it will be read aloud by text-to-speech. Cover the key points in a memorable order and end with one quick self-check question.\n\nLesson content:\n${c}`,
};

const JSON_FORMATS = new Set(['flashcards', 'quiz', 'slides', 'glossary']);

const MAX_CONTENT_CHARS = 12_000;
const MAX_BRIEF_CHARS = 4_000;

/** Required keys per JSON format — items missing these are rejected. */
const JSON_SHAPES: Record<string, string[]> = {
  flashcards: ['question', 'answer'],
  quiz: ['question', 'options', 'answer'],
  slides: ['title', 'bullets'],
  glossary: ['term', 'definition'],
};

function extractJsonArray(text: string, format: string): any[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  let items: any[] = parsed;

  if (format === 'slides') {
    // Models drift to {heading, points} / {title, content}. Normalise to
    // {title, bullets[]} so the viewer always receives the documented shape.
    items = items.map((item: any, i: number) => {
      if (typeof item === 'string') {
        const lines = item.split('\n').map((l) => l.trim()).filter(Boolean);
        return { title: lines[0] ?? `Slide ${i + 1}`, bullets: lines.slice(1) };
      }
      if (!item || typeof item !== 'object') return item;
      const title = item.title ?? item.heading ?? item.header ?? item.name ?? `Slide ${i + 1}`;
      const rawBullets = item.bullets ?? item.points ?? item.content ?? item.body ?? item.items ?? item.text;
      const bullets = Array.isArray(rawBullets)
        ? rawBullets.map((b: any) => String(typeof b === 'string' ? b : b?.text ?? '').replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean)
        : typeof rawBullets === 'string'
          ? rawBullets.split('\n').map((l: string) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean)
          : [];
      return { ...item, title: String(title).trim(), bullets };
    });
  }

  const keys = JSON_SHAPES[format] ?? [];
  const valid = items.filter(
    (item) => item && typeof item === 'object' && keys.every((k) => k in item)
  );
  if (valid.length === 0) return null;

  if (format === 'quiz') {
    // Normalise the answer to the exact option text: models occasionally
    // return "A"/"B" letters or prefixed options despite the prompt.
    for (const q of valid) {
      if (!Array.isArray(q.options)) continue;
      q.options = q.options.map((o: unknown) => String(o));
      const ans = String(q.answer ?? '').trim();
      const exact = q.options.find((o: string) => o.trim().toLowerCase() === ans.toLowerCase());
      if (exact) { q.answer = exact; continue; }
      // Letter form: A → options[0] …
      const letterIdx = 'ABCD'.indexOf(ans.toUpperCase());
      if (ans.length === 1 && letterIdx >= 0 && letterIdx < q.options.length) {
        q.answer = q.options[letterIdx];
        continue;
      }
      // "A) text" / "text" substring form.
      const fuzzy = q.options.find((o: string) =>
        o.toLowerCase().includes(ans.toLowerCase()) || ans.toLowerCase().includes(o.toLowerCase())
      );
      if (fuzzy) q.answer = fuzzy;
    }
  }
  return valid;
}

export async function POST(req: NextRequest) {
  try {
    const { content, format, briefPrompt, language } = await req.json();
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

    const promptFn = PROMPTS[format];
    if (!promptFn) return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });

    // Curriculum CMS passes the lesson's authored generation brief; prepend it
    // so every format follows the curriculum team's instructions.
    const cappedContent = String(content).slice(0, MAX_CONTENT_CHARS);
    const fullContent = briefPrompt
      ? `CONTENT BRIEF (follow these instructions):\n${String(briefPrompt).slice(0, MAX_BRIEF_CHARS)}\n\n${cappedContent}`
      : cappedContent;

    const langInstruction = language && language !== 'en'
      ? `\n\nIMPORTANT: Generate ALL content in the ${LANG_NAMES[language] || language} language. All text, explanations, questions, answers, terms, and definitions must be in ${LANG_NAMES[language] || language}. Only keep technical/scientific terms in their original form where appropriate.`
      : '';

    const prompt = promptFn(fullContent) + langInstruction;
    const text = await callOpenRouter([{ role: 'user', content: prompt }], { model: MODEL_FOR_FORMAT(format) });

    if (JSON_FORMATS.has(format)) {
      let parsed = extractJsonArray(text, format);
      if (!parsed) {
        // One repair attempt: ask the model to convert its own output to valid JSON.
        const repaired = await callOpenRouter(
          [
            { role: 'user', content: prompt },
            { role: 'assistant', content: text },
            { role: 'user', content: 'Your previous reply was not a valid JSON array in the required shape. Reply again with ONLY the corrected JSON array — no prose, no markdown fences.' },
          ],
          { model: MODEL_FOR_FORMAT(format), temperature: 0.2 }
        );
        parsed = extractJsonArray(repaired, format);
      }
      if (!parsed) {
        // Never return a raw string for array formats — it poisons Firestore
        // and crashes the typed viewers downstream.
        return NextResponse.json({ error: 'The AI response could not be parsed. Please try again.' }, { status: 422 });
      }
      return NextResponse.json({ result: parsed });
    }

    return NextResponse.json({ result: text });
  } catch (err: any) {
    console.error('[generate]', err);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

const MATH_HINT = 'If the content involves mathematics, science formulas, or equations, use LaTeX notation: inline math with $...$ and display math with $$...$$. For example: $E = mc^2$, $\\frac{a}{b}$, $$\\int_0^1 f(x)\\,dx$$.\n\n';

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  zh: 'Chinese (Simplified)', hi: 'Hindi', ur: 'Urdu', tr: 'Turkish',
  ja: 'Japanese', ko: 'Korean', it: 'Italian', ru: 'Russian', sw: 'Swahili',
};

const PROMPTS: Record<string, (c: string) => string> = {
  text: (c) => `You are an expert educator. ${MATH_HINT}Transform the following raw lesson content into a well-structured, engaging lesson in Markdown format. Use headers (##, ###), bullet points, **bold** key terms, and clear explanations. Make it comprehensive yet readable.\n\nLesson content:\n${c}`,

  flashcards: (c) => `You are a study expert. ${MATH_HINT}Create 6-8 high-quality flashcard pairs from this lesson content. Return ONLY a valid JSON array, no prose before or after it:\n[{"question":"...","answer":"..."}]\n\nLesson content:\n${c}`,

  quiz: (c) => `You are an assessment expert. ${MATH_HINT}Create 5 multiple-choice quiz questions from this lesson content. Return ONLY a valid JSON array, no prose before or after it:\n[{"question":"...","options":["A","B","C","D"],"answer":"A","explanation":"why A is correct"}]\n\nLesson content:\n${c}`,

  slides: (c) => `You are a presentation designer. Create 5-6 presentation slides from this lesson content. Return ONLY a valid JSON array, no prose before or after it:\n[{"title":"...","bullets":["...","...","..."]}]\n\nLesson content:\n${c}`,

  notes: (c) => `You are a study notes expert. ${MATH_HINT}Create concise, well-structured study notes from this lesson content in Markdown. Include **bold** key terms, bullet points, and memory aids or mnemonics where helpful.\n\nLesson content:\n${c}`,

  summary: (c) => `You are an expert summariser. ${MATH_HINT}Write a clear, concise 3-5 sentence summary of this lesson content that captures all the essential takeaways. Use accessible language.\n\nLesson content:\n${c}`,

  problems: (c) => `You are a practice problems creator. ${MATH_HINT}Create 4-5 practice problems from this lesson content. Mix difficulty levels. For each, provide the problem statement and a detailed worked solution. Format in Markdown with LaTeX for all equations.\n\nLesson content:\n${c}`,

  glossary: (c) => `You are a vocabulary expert. Extract 6-8 key terms from this lesson content and provide clear, concise definitions. Return ONLY a valid JSON array, no prose before or after it:\n[{"term":"...","definition":"..."}]\n\nLesson content:\n${c}`,

  mindmap: (c) => `You are a mind mapping expert. ${MATH_HINT}Create a text-based mind map of this lesson content in Markdown. Use headings for main branches and nested bullet points for sub-branches. Put the main topic at the top.\n\nLesson content:\n${c}`,

  infographic: (c) => `You are a visual learning expert. Create structured text-based infographic content for this lesson in Markdown. Use clear sections, key facts in blockquotes, bold statistics, and visual separators (---). Make it scannable.\n\nLesson content:\n${c}`,

  videoScript: (c) => `You are an educational video scriptwriter. Write a 4-6 minute video script for this lesson in Markdown. Structure it as numbered SCENES: each scene has a "### Scene N — title" heading, a one-line [VISUAL: ...] direction describing the animation or footage, and the narrator's spoken lines as plain text. Open with a hook, close with a recap. Conversational, age-appropriate tone.\n\nLesson content:\n${c}`,

  audioScript: (c) => `You are an educational podcast writer. Write a 60-90 second audio revision summary script for this lesson. Conversational, friendly tone as if speaking directly to one student. Plain prose only — no headings, no stage directions, no markdown — because it will be read aloud by text-to-speech. Cover the key points in a memorable order and end with one quick self-check question.\n\nLesson content:\n${c}`,
};

const JSON_FORMATS = new Set(['flashcards', 'quiz', 'slides', 'glossary']);

export async function POST(req: NextRequest) {
  try {
    const { content, format, briefPrompt, language } = await req.json();
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

    const promptFn = PROMPTS[format];
    if (!promptFn) return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });

    // Curriculum CMS passes the lesson's authored generation brief; prepend it
    // so every format follows the curriculum team's instructions.
    const fullContent = briefPrompt
      ? `CONTENT BRIEF (follow these instructions):\n${briefPrompt}\n\n${content}`
      : content;

    const langInstruction = language && language !== 'en'
      ? `\n\nIMPORTANT: Generate ALL content in the ${LANG_NAMES[language] || language} language. All text, explanations, questions, answers, terms, and definitions must be in ${LANG_NAMES[language] || language}. Only keep technical/scientific terms in their original form where appropriate.`
      : '';

    const text = await callOpenRouter(
      [{ role: 'user', content: promptFn(fullContent) + langInstruction }],
      { model: SMART_MODEL }
    );

    if (JSON_FORMATS.has(format)) {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return NextResponse.json({ result: JSON.parse(jsonMatch[0]) });
        } catch { /* fall through to text */ }
      }
    }

    return NextResponse.json({ result: text });
  } catch (err: any) {
    console.error('[generate]', err);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}

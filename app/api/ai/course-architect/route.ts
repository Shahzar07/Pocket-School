import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';

/**
 * Quill — Course Architect.
 *
 * Powers the AI assistance inside the Curriculum CMS. One route, five tasks:
 *   outline     → a full course structure (modules + lessons)
 *   objectives  → Bloom's-aligned lesson objectives
 *   brief       → an authoring brief for the AI content generator
 *   improve     → rewrite / expand / simplify a block of lesson text
 *   assessment  → Bloom's-weighted assessment section structure
 *
 * Every task answers with strict JSON. JSON-shaped tasks get one repair retry
 * (same approach as /api/ai/generate) before failing with a 422.
 */

export const maxDuration = 60;

/* ── Input caps ─────────────────────────────────────────────── */

const MAX_SHORT = 200;      // subject, year level, lesson title, bloom
const MAX_TEXT = 12_000;    // text to improve
const MAX_INSTRUCTION = 1_000;
const MIN_WEEKS = 1;
const MAX_WEEKS = 52;
const MAX_MARKS = 500;

const BLOOMS = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'];

const clean = (v: unknown, max = MAX_SHORT) =>
  String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const normaliseBloom = (v: unknown, fallback = 'Understand') => {
  const raw = clean(v, 40).toLowerCase();
  return BLOOMS.find(b => b.toLowerCase() === raw)
    ?? BLOOMS.find(b => b.toLowerCase().startsWith(raw.slice(0, 4)) && raw.length >= 3)
    ?? fallback;
};

/* ── JSON helpers ───────────────────────────────────────────── */

/** Pulls the first balanced-looking JSON object out of a model reply. */
function extractJsonObject(text: string): Record<string, any> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Runs a prompt, validates it, and retries once asking the model to repair its
 * own reply into the required shape. Returns null when both attempts fail. */
async function runJsonTask<T>(
  prompt: string,
  validate: (obj: Record<string, any>) => T | null,
): Promise<T | null> {
  const first = await callOpenRouter([{ role: 'user', content: prompt }], { model: CONTENT_MODEL });
  const parsedFirst = extractJsonObject(first);
  const okFirst = parsedFirst ? validate(parsedFirst) : null;
  if (okFirst) return okFirst;

  const repaired = await callOpenRouter(
    [
      { role: 'user', content: prompt },
      { role: 'assistant', content: first },
      {
        role: 'user',
        content:
          'Your previous reply was not a valid JSON object in the required shape. Reply again with ONLY the corrected JSON object — no prose, no markdown fences, no trailing commentary.',
      },
    ],
    { model: CONTENT_MODEL, temperature: 0.2 },
  );
  const parsedSecond = extractJsonObject(repaired);
  return parsedSecond ? validate(parsedSecond) : null;
}

/** Plain-text task (brief / improve) — the route wraps the reply in JSON. */
async function runTextTask(prompt: string): Promise<string | null> {
  const text = await callOpenRouter([{ role: 'user', content: prompt }], { model: CONTENT_MODEL });
  const stripped = text.replace(/^```(?:markdown|md|text)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return stripped.length > 0 ? stripped : null;
}

/* ── Validators ─────────────────────────────────────────────── */

interface OutlineLesson { title: string; objectives: string[]; durationWeeks: number }
interface OutlineModule { title: string; description: string; lessons: OutlineLesson[] }

function validateOutline(obj: Record<string, any>): { modules: OutlineModule[] } | null {
  const raw = Array.isArray(obj.modules) ? obj.modules : null;
  if (!raw) return null;
  const modules: OutlineModule[] = [];
  for (const m of raw.slice(0, 24)) {
    if (!m || typeof m !== 'object') continue;
    const title = clean(m.title, 140);
    if (!title) continue;
    const lessonsRaw = Array.isArray(m.lessons) ? m.lessons : [];
    const lessons: OutlineLesson[] = [];
    for (const l of lessonsRaw.slice(0, 30)) {
      if (!l || typeof l !== 'object') continue;
      const lTitle = clean(l.title, 140);
      if (!lTitle) continue;
      const objectives = (Array.isArray(l.objectives) ? l.objectives : [])
        .map((o: unknown) => (typeof o === 'string' ? clean(o, 300) : clean((o as any)?.text, 300)))
        .filter(Boolean)
        .slice(0, 8);
      lessons.push({ title: lTitle, objectives, durationWeeks: clampInt(l.durationWeeks, 1, 12, 1) });
    }
    if (lessons.length === 0) continue;
    modules.push({ title, description: clean(m.description, 500), lessons });
  }
  return modules.length ? { modules } : null;
}

function validateObjectives(obj: Record<string, any>): { objectives: { text: string; bloom: string }[] } | null {
  const raw = Array.isArray(obj.objectives) ? obj.objectives : null;
  if (!raw) return null;
  const objectives = raw
    .slice(0, 8)
    .map((o: any) => ({
      text: typeof o === 'string' ? clean(o, 300) : clean(o?.text, 300),
      bloom: normaliseBloom(typeof o === 'string' ? '' : o?.bloom),
    }))
    .filter((o: { text: string }) => o.text.length > 0);
  return objectives.length ? { objectives } : null;
}

function validateAssessment(obj: Record<string, any>): { sections: { bloom: string; description: string; marks: number }[] } | null {
  const raw = Array.isArray(obj.sections) ? obj.sections : null;
  if (!raw) return null;
  const sections = raw
    .slice(0, 12)
    .map((s: any) => ({
      bloom: normaliseBloom(s?.bloom, 'Remember'),
      description: clean(s?.description, 400),
      marks: clampInt(s?.marks, 1, MAX_MARKS, 10),
    }))
    .filter((s: { description: string }) => s.description.length > 0);
  return sections.length ? { sections } : null;
}

/* ── Prompts ────────────────────────────────────────────────── */

const RULES =
  'Return ONLY a single valid JSON object. No prose before or after, no markdown code fences. ' +
  'All content must be original, age-appropriate and free of copyrighted exam-board material.';

function outlinePrompt(subject: string, yearLevel: string, weeks: number) {
  const moduleHint = Math.max(2, Math.min(12, Math.round(weeks / 3)));
  return `You are Quill, an expert curriculum architect designing a scheme of work.

Design a complete course structure for:
- Subject: ${subject}
- Year / Level: ${yearLevel}
- Total duration: ${weeks} teaching weeks

Produce roughly ${moduleHint} modules covering the whole ${weeks} weeks, sequenced from foundational to advanced. Each module holds 3-6 lessons. The sum of every lesson's durationWeeks across all modules must be close to ${weeks}. Each lesson lists 2-4 measurable learning objectives written as "Students will be able to…".

${RULES}

Exact shape:
{"modules":[{"title":"...","description":"...","lessons":[{"title":"...","objectives":["..."],"durationWeeks":1}]}]}`;
}

function objectivesPrompt(lessonTitle: string, bloom: string, yearLevel: string) {
  return `You are Quill, an expert curriculum designer.

Write 4-5 measurable learning objectives for the lesson "${lessonTitle}"${yearLevel ? ` aimed at ${yearLevel} students` : ''}.

Every objective starts with "Students will be able to" followed by an action verb. Centre the set on Bloom's level "${bloom}" — at least three objectives must use verbs from that level, and the remainder may sit one level either side. Use only these Bloom's labels: ${BLOOMS.join(', ')}.

${RULES}

Exact shape:
{"objectives":[{"text":"Students will be able to…","bloom":"${bloom}"}]}`;
}

function briefPrompt(lessonTitle: string, subject: string, yearLevel: string) {
  return `You are Quill, a curriculum lead briefing an AI content generator.

Write a generation brief in Markdown for the lesson "${lessonTitle}"${subject ? ` in ${subject}` : ''}${yearLevel ? ` for ${yearLevel} students` : ''}.

Keep it under 300 words and use these headings exactly:
## Purpose
## Key concepts to cover
## Tone & reading level
## Worked examples & misconceptions
## Must avoid

Be concrete and specific to this lesson — no filler, no generic advice. Reply with the Markdown brief only, no code fences and no commentary.`;
}

function improvePrompt(text: string, instruction: string) {
  return `You are Quill, an expert educational editor.

Rewrite the lesson text below following this instruction: ${instruction}

Preserve every factual claim, keep the existing Markdown structure and heading levels where sensible, and keep mathematics in LaTeX ($…$ inline, $$…$$ display). Reply with the rewritten text only — no preamble, no commentary, no code fences.

--- LESSON TEXT ---
${text}`;
}

function assessmentPrompt(lessonTitle: string, totalMarks: number) {
  return `You are Quill, an assessment designer.

Design the section structure for an assessment on "${lessonTitle}" worth exactly ${totalMarks} marks in total.

Produce 3-5 sections ordered from lower to higher Bloom's demand. Each section states the Bloom's level (one of: ${BLOOMS.join(', ')}), a one-sentence description of what it tests and how it is answered, and its mark allocation. The marks across all sections must sum to exactly ${totalMarks}.

${RULES}

Exact shape:
{"sections":[{"bloom":"Remember","description":"...","marks":10}]}`;
}

/* ── Route ──────────────────────────────────────────────────── */

const PARSE_ERROR = 'Quill could not produce a usable result. Please try again.';

export async function POST(req: NextRequest) {
  let task = '';
  try {
    const body = await req.json().catch(() => ({}));
    task = clean(body?.task, 40);
    const context = (body?.context ?? {}) as Record<string, unknown>;

    switch (task) {
      case 'outline': {
        const subject = clean(context.subject);
        const yearLevel = clean(context.yearLevel);
        const weeks = clampInt(context.weeks, MIN_WEEKS, MAX_WEEKS, 12);
        if (!subject) return NextResponse.json({ error: 'subject is required' }, { status: 400 });
        const result = await runJsonTask(outlinePrompt(subject, yearLevel || 'general', weeks), validateOutline);
        if (!result) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json(result);
      }

      case 'objectives': {
        const lessonTitle = clean(context.lessonTitle);
        if (!lessonTitle) return NextResponse.json({ error: 'lessonTitle is required' }, { status: 400 });
        const bloom = normaliseBloom(context.bloom);
        const yearLevel = clean(context.yearLevel);
        const result = await runJsonTask(objectivesPrompt(lessonTitle, bloom, yearLevel), validateObjectives);
        if (!result) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json(result);
      }

      case 'brief': {
        const lessonTitle = clean(context.lessonTitle);
        if (!lessonTitle) return NextResponse.json({ error: 'lessonTitle is required' }, { status: 400 });
        const brief = await runTextTask(
          briefPrompt(lessonTitle, clean(context.subject), clean(context.yearLevel)),
        );
        if (!brief) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json({ brief });
      }

      case 'improve': {
        const text = String(context.text ?? '').slice(0, MAX_TEXT).trim();
        if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
        const instruction = clean(context.instruction, MAX_INSTRUCTION) || 'Improve clarity and flow without changing the meaning.';
        const improved = await runTextTask(improvePrompt(text, instruction));
        if (!improved) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json({ text: improved });
      }

      case 'assessment': {
        const lessonTitle = clean(context.lessonTitle);
        if (!lessonTitle) return NextResponse.json({ error: 'lessonTitle is required' }, { status: 400 });
        const totalMarks = clampInt(context.totalMarks, 1, MAX_MARKS, 40);
        const result = await runJsonTask(assessmentPrompt(lessonTitle, totalMarks), validateAssessment);
        if (!result) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown task: ${task || '(missing)'}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[course-architect]', task, err);
    return NextResponse.json({ error: err?.message || 'Quill request failed' }, { status: 500 });
  }
}

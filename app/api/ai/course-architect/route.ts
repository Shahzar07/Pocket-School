import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';

/**
 * ET — Course Architect.
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

/** A short bullet list from a caller-supplied array, for prompt context. */
const bulletList = (v: unknown, cap = 40, itemMax = 160): string => {
  if (!Array.isArray(v)) return '';
  return v
    .map(x => (typeof x === 'string' ? clean(x, itemMax) : clean((x as any)?.title ?? (x as any)?.text, itemMax)))
    .filter(Boolean)
    .slice(0, cap)
    .map(s => `- ${s}`)
    .join('\n');
};

/**
 * Force a set of integer parts to sum to an exact total, preserving their
 * proportions. Models are told to make marks (and weeks) add up and reliably
 * do not, which produced assessments worth 38 of a stated 40 marks.
 *
 * Every part is kept at 1 or more, so when there are more parts than the total
 * can cover the surplus is dropped — five sections cannot share three marks.
 * The returned array may therefore be shorter than the input, and callers must
 * truncate their own list to match.
 */
function normaliseToTotal(parts: number[], total: number): number[] {
  if (parts.length === 0 || total <= 0) return parts;
  if (parts.length > total) parts = parts.slice(0, total);

  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum === total) return parts;

  // Scale proportionally, floor, then hand out the remainder largest-first so
  // the rounding error lands where it is least noticeable.
  const scaled = parts.map(p => (sum > 0 ? (p / sum) * total : total / parts.length));
  const floored = scaled.map(s => Math.max(1, Math.floor(s)));
  let diff = total - floored.reduce((a, b) => a + b, 0);

  const order = scaled
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);

  let k = 0;
  while (diff > 0 && order.length) {
    floored[order[k % order.length].i] += 1;
    diff--; k++;
  }
  // If rounding overshot, claw back from the largest parts that can spare it.
  k = 0;
  while (diff < 0) {
    const idx = floored.indexOf(Math.max(...floored));
    if (floored[idx] <= 1) break;
    floored[idx] -= 1;
    diff++;
    if (++k > 1000) break;
  }
  return floored;
}

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

function outlinePrompt(subject: string, yearLevel: string, weeks: number, existingUnits: string) {
  const moduleHint = Math.max(2, Math.min(12, Math.round(weeks / 3)));
  // Without this the architect re-proposes units the course already has, so a
  // second run duplicates the first instead of extending it.
  const continuation = existingUnits
    ? `\n\nThis course ALREADY contains these units:\n${existingUnits}\n\nDo not repeat or re-word any of them. Design units that continue from where those leave off, assuming their content is already taught and can be built upon.`
    : '';
  return `You are ET, an expert curriculum architect designing a scheme of work.

Design a complete course structure for:
- Subject: ${subject}
- Year / Level: ${yearLevel}
- Total duration: ${weeks} teaching weeks${continuation}

Produce roughly ${moduleHint} modules covering the whole ${weeks} weeks, sequenced from foundational to advanced so each module depends only on earlier ones. Each module holds 3-6 lessons. The sum of every lesson's durationWeeks across all modules must be close to ${weeks}. Each lesson lists 2-4 measurable learning objectives written as "Students will be able to…".

Pitch the vocabulary, examples and cognitive demand at ${yearLevel} specifically — not at a general audience.

${RULES}

Exact shape:
{"modules":[{"title":"...","description":"...","lessons":[{"title":"...","objectives":["..."],"durationWeeks":1}]}]}`;
}

function objectivesPrompt(
  lessonTitle: string, bloom: string, yearLevel: string,
  subject: string, siblingLessons: string, lessonText: string,
) {
  // Objectives written blind describe the title; objectives written against the
  // lesson's actual content and its neighbours describe the lesson.
  const place = siblingLessons
    ? `\n\nOther lessons in the same unit, in order:\n${siblingLessons}\n\nWrite objectives that belong to "${lessonTitle}" specifically — do not restate what neighbouring lessons cover.`
    : '';
  const body = lessonText
    ? `\n\nThe lesson currently teaches this. Objectives must describe what THIS content achieves, not the title in the abstract:\n"""\n${lessonText}\n"""`
    : '';
  return `You are ET, an expert curriculum designer.

Write 4-5 measurable learning objectives for the lesson "${lessonTitle}"${subject ? ` in ${subject}` : ''}${yearLevel ? ` aimed at ${yearLevel} students` : ''}.${place}${body}

Every objective starts with "Students will be able to" followed by an action verb. Centre the set on Bloom's level "${bloom}" — at least three objectives must use verbs from that level, and the remainder may sit one level either side. Use only these Bloom's labels: ${BLOOMS.join(', ')}.

Each objective must be observable and assessable: avoid "understand", "know about" and "be aware of", which cannot be marked.

${RULES}

Exact shape:
{"objectives":[{"text":"Students will be able to…","bloom":"${bloom}"}]}`;
}

function briefPrompt(
  lessonTitle: string, subject: string, yearLevel: string,
  objectives: string, siblingLessons: string,
) {
  const aims = objectives
    ? `\n\nThe brief must serve these agreed learning objectives:\n${objectives}`
    : '';
  const place = siblingLessons
    ? `\n\nOther lessons in this unit:\n${siblingLessons}\nStay inside this lesson's scope and do not duplicate theirs.`
    : '';
  return `You are ET, a curriculum lead briefing an AI content generator.

Write a generation brief in Markdown for the lesson "${lessonTitle}"${subject ? ` in ${subject}` : ''}${yearLevel ? ` for ${yearLevel} students` : ''}.${aims}${place}

Keep it under 300 words and use these headings exactly:
## Purpose
## Key concepts to cover
## Tone & reading level
## Worked examples & misconceptions
## Must avoid

Be concrete and specific to this lesson — no filler, no generic advice. Reply with the Markdown brief only, no code fences and no commentary.`;
}

function improvePrompt(text: string, instruction: string, subject: string, yearLevel: string) {
  // "Simplify" is meaningless without a target reader; with the year level the
  // model has an actual reading age to write for.
  const audience = yearLevel || subject
    ? `\n\nWrite for ${yearLevel || 'the stated level'}${subject ? ` studying ${subject}` : ''}. Judge vocabulary, sentence length and example choice against that reader.`
    : '';
  return `You are ET, an expert educational editor.

Rewrite the lesson text below following this instruction: ${instruction}${audience}

Preserve every factual claim, keep the existing Markdown structure and heading levels where sensible, and keep mathematics in LaTeX ($…$ inline, $$…$$ display). Reply with the rewritten text only — no preamble, no commentary, no code fences.

--- LESSON TEXT ---
${text}`;
}

function assessmentPrompt(lessonTitle: string, totalMarks: number, objectives: string, yearLevel: string) {
  // An assessment that doesn't know the objectives tests the title, not the
  // lesson — the single biggest cause of "the quiz doesn't match what I taught".
  const aims = objectives
    ? `\n\nEvery section must assess at least one of these stated objectives, and together the sections must cover all of them:\n${objectives}`
    : '';
  return `You are ET, an assessment designer.

Design the section structure for an assessment on "${lessonTitle}"${yearLevel ? ` for ${yearLevel} students` : ''} worth exactly ${totalMarks} marks in total.${aims}

Produce 3-5 sections ordered from lower to higher Bloom's demand. Each section states the Bloom's level (one of: ${BLOOMS.join(', ')}), a one-sentence description of what it tests and how it is answered, and its mark allocation. The marks across all sections must sum to exactly ${totalMarks}.

${RULES}

Exact shape:
{"sections":[{"bloom":"Remember","description":"...","marks":10}]}`;
}

/* ── Route ──────────────────────────────────────────────────── */

const PARSE_ERROR = 'ET could not produce a usable result. Please try again.';

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
        const existingUnits = bulletList(context.existingUnits, 40, 140);
        const result = await runJsonTask(
          outlinePrompt(subject, yearLevel || 'general', weeks, existingUnits),
          validateOutline,
        );
        if (!result) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });

        // Deliberately not force-fitted to the week budget the way marks are.
        // A course can legitimately hold more lessons than it has weeks, so
        // pinning each lesson to a whole week would corrupt sensible outlines.
        // A scheme of work is an estimate; an assessment's mark total is not.
        return NextResponse.json(result);
      }

      case 'objectives': {
        const lessonTitle = clean(context.lessonTitle);
        if (!lessonTitle) return NextResponse.json({ error: 'lessonTitle is required' }, { status: 400 });
        const bloom = normaliseBloom(context.bloom);
        const yearLevel = clean(context.yearLevel);
        const result = await runJsonTask(
          objectivesPrompt(
            lessonTitle, bloom, yearLevel,
            clean(context.subject),
            bulletList(context.siblingLessons, 20, 140),
            String(context.lessonText ?? '').slice(0, 4000).trim(),
          ),
          validateObjectives,
        );
        if (!result) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json(result);
      }

      case 'brief': {
        const lessonTitle = clean(context.lessonTitle);
        if (!lessonTitle) return NextResponse.json({ error: 'lessonTitle is required' }, { status: 400 });
        const brief = await runTextTask(
          briefPrompt(
            lessonTitle, clean(context.subject), clean(context.yearLevel),
            bulletList(context.objectives, 10, 300),
            bulletList(context.siblingLessons, 20, 140),
          ),
        );
        if (!brief) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json({ brief });
      }

      case 'improve': {
        const text = String(context.text ?? '').slice(0, MAX_TEXT).trim();
        if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
        const instruction = clean(context.instruction, MAX_INSTRUCTION) || 'Improve clarity and flow without changing the meaning.';
        const improved = await runTextTask(
          improvePrompt(text, instruction, clean(context.subject), clean(context.yearLevel)),
        );
        if (!improved) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });
        return NextResponse.json({ text: improved });
      }

      case 'assessment': {
        const lessonTitle = clean(context.lessonTitle);
        if (!lessonTitle) return NextResponse.json({ error: 'lessonTitle is required' }, { status: 400 });
        const totalMarks = clampInt(context.totalMarks, 1, MAX_MARKS, 40);
        const result = await runJsonTask(
          assessmentPrompt(
            lessonTitle, totalMarks,
            bulletList(context.objectives, 10, 300),
            clean(context.yearLevel),
          ),
          validateAssessment,
        );
        if (!result) return NextResponse.json({ error: PARSE_ERROR }, { status: 422 });

        // The prompt demands the marks sum to the total and the model routinely
        // misses by a few — an assessment "worth 40" totalling 38 is a defect.
        const marks = normaliseToTotal(result.sections.map(s => s.marks), totalMarks);
        // normaliseToTotal drops sections it cannot fund; keep the lists aligned.
        result.sections = result.sections.slice(0, marks.length);
        result.sections.forEach((s, i) => { s.marks = marks[i]; });

        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown task: ${task || '(missing)'}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[course-architect]', task, err);
    return NextResponse.json({ error: err?.message || 'ET request failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';
import { stepsForRole, matchSteps, getStep, type TourRole } from '@/lib/tour-steps';

/**
 * POST /api/ai/tour — build a walkthrough for a typed question.
 *
 * The model does NOT write the tour. It picks and orders steps from the real
 * catalogue and writes one line of narration for each, so a walkthrough can
 * never point at a screen that does not exist. Any id it invents is dropped.
 *
 * Falls back to keyword matching whenever the model is unavailable or useless,
 * because a guide that answers "I could not help" is worse than a rough guess.
 */

export const maxDuration = 30;

const ROLES: TourRole[] = ['student', 'teacher', 'parent', 'admin', 'institution_admin'];

interface TourPlan {
  intro: string;
  steps: { id: string; note?: string }[];
}

function extractJson(text: string): Record<string, any> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  let question = '';
  let role: TourRole = 'student';
  try {
    const body = await req.json();
    question = String(body?.question ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (ROLES.includes(body?.role)) role = body.role;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });

  const available = stepsForRole(role).filter(s => s.id !== 'welcome');
  const catalogue = available
    .map(s => `${s.id} — ${s.title}: ${s.body.slice(0, 110)}`)
    .join('\n');

  /** Keyword fallback, shaped like a plan so both paths return the same thing. */
  const fallback = (): TourPlan => ({
    intro: `Here's where to look for that.`,
    steps: matchSteps(question, role).map(s => ({ id: s.id })),
  });

  const prompt = `You are Pip, the friendly in-app guide for Poket School. A ${role.replace('_', ' ')} asked:

"${question}"

Choose between 2 and 5 screens from this catalogue that answer it, in the order someone should visit them. Use ONLY these ids:

${catalogue}

For each, write "note": one short sentence (max 22 words) saying what to do on that screen for THIS question. Warm, direct, second person. No markdown, no emoji.

Also write "intro": one sentence (max 25 words) introducing the walkthrough.

If nothing in the catalogue fits, choose the 2 closest anyway — never return an empty list.

Return ONLY this JSON object, no prose and no code fences:
{"intro":"...","steps":[{"id":"...","note":"..."}]}`;

  try {
    const raw = await callOpenRouter([{ role: 'user', content: prompt }], { model: CONTENT_MODEL });
    const parsed = extractJson(raw);
    const rawSteps = Array.isArray(parsed?.steps) ? parsed!.steps : [];

    // Keep only ids that exist and are allowed for this role; drop duplicates.
    const seen = new Set<string>();
    const steps = rawSteps
      .map((s: any) => ({
        id: String(s?.id ?? '').trim(),
        note: String(s?.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || undefined,
      }))
      .filter((s: { id: string }) => {
        if (!s.id || seen.has(s.id)) return false;
        if (!available.some(a => a.id === s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .slice(0, 6);

    if (!steps.length) return NextResponse.json(fallback());

    const intro = String(parsed?.intro ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
      || 'Here’s where to look for that.';
    return NextResponse.json({ intro, steps } satisfies TourPlan);
  } catch (err: any) {
    console.error('[ai/tour]', err?.message || err);
    // A guide that cannot guide is worse than a keyword match.
    return NextResponse.json(fallback());
  }
}

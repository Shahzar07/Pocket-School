import { NextResponse } from 'next/server';
import { isOpenRouterConfigured, callOpenRouter, FAST_MODEL } from '@/lib/openrouter';
import { applyParsedConstraint, parseNaturalConstraint } from '@/lib/timetable/explain';
import { explainSolve, proposeSoftFixes, requestedCount, solveTimetable } from '@/lib/timetable/solver';
import type { TimetableDoc } from '@/lib/timetable/types';

export const runtime = 'nodejs';

/** Deterministic explanation. A model paragraph is added only when OPENROUTER_API_KEY is set. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { doc?: TimetableDoc; constraint?: string } | null;
  if (!body?.doc?.subjects || !body.doc.periods) {
    return NextResponse.json({ error: 'Send a timetable.' }, { status: 400 });
  }
  let doc = body.doc;
  let constraintSummary = '';
  if (body.constraint?.trim()) {
    const parsed = parseNaturalConstraint(body.constraint, doc.staff ?? [], doc.periods);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    doc = applyParsedConstraint(doc, parsed);
    constraintSummary = parsed.summary;
  }
  const result = solveTimetable(doc);
  const explanation = explainSolve(result, requestedCount(doc));
  const fixes = proposeSoftFixes(result.unmet);
  let model = '';
  if (isOpenRouterConfigured()) {
    try {
      model = await callOpenRouter([
        { role: 'system', content: 'You explain a school timetable in plain sentences. Do not invent lessons that are not in the notes.' },
        { role: 'user', content: `${constraintSummary}\n${explanation}\n${fixes.join('\n')}`.trim() },
      ], { model: FAST_MODEL, maxTokens: 280 });
    } catch {
      model = '';
    }
  }
  return NextResponse.json({
    lessons: result.lessons,
    quality: result.quality,
    unmet: result.unmet,
    unplaced: result.unplaced,
    explanation,
    fixes,
    model,
    source: model ? 'openrouter' : 'deterministic',
  });
}

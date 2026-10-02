import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS } from '@/lib/study/ai';
import { JSON_RULES, lang } from '@/lib/study/prompts';

export const maxDuration = 90;

interface OralGrade {
  criteria: { name: string; score: number; comment: string }[];
  percent: number;
  summary: string;
  strengths: string[];
  gaps: { topic: string; severity: string; issue: string; fix: string }[];
}

/** POST { transcript, topics, subject, language } → a rubric-based grade for the oral exam. */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const transcript: { role: string; text: string }[] = body.transcript ?? [];
    if (transcript.filter(t => t.role === 'student').length < 2) {
      return Response.json({ error: 'Answer at least two questions before ending the exam.' }, { status: 400 });
    }
    const out = await chatJSON<OralGrade>({
      models: MODELS.SOLVER,
      effort: 'low',
      maxTokens: 4000,
      messages: [
        {
          role: 'system',
          content: `You are grading a student's oral exam in ${body.subject || 'their subject'} from its transcript. Speech-to-text may contain small transcription errors — judge the ideas, not the spelling.
Score four criteria from 0 to 10, each with a one-sentence comment:
1. "Knowledge" — correct facts and concepts.
2. "Reasoning" — explains why, links ideas, works through problems.
3. "Terminology" — uses the subject's language accurately.
4. "Clarity" — structured, confident, answers the question asked.
"percent" = overall mark out of 100, consistent with the criteria. Give 2–3 "strengths" and up to 4 "gaps" ({"topic","severity":"weakest"|"attention"|"minor","issue","fix"}). "summary": 2–3 honest, encouraging sentences.
Topics examined: ${(body.topics ?? []).map((t: { title: string }) => t.title).join(', ')}
${JSON_RULES}
${lang(body.language)}`,
        },
        { role: 'user', content: transcript.map(t => `${t.role === 'examiner' ? 'EXAMINER' : 'STUDENT'}: ${t.text}`).join('\n').slice(0, 30_000) },
      ],
    });
    const criteria = (out.criteria ?? []).slice(0, 4).map(c => ({ name: String(c.name), score: Math.max(0, Math.min(10, Math.round(Number(c.score) || 0))), comment: String(c.comment ?? '') }));
    const fromCriteria = criteria.length ? Math.round((criteria.reduce((s, c) => s + c.score, 0) / (criteria.length * 10)) * 100) : 0;
    const percent = Number.isFinite(out.percent) ? Math.max(0, Math.min(100, Math.round(out.percent))) : fromCriteria;
    return Response.json({ ...out, criteria, percent });
  } catch (e) {
    return errorResponse(e, 'Could not grade the oral exam.');
  }
}

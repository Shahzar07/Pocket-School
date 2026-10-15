import { requireUser, errorResponse } from '@/lib/server-auth';
import { chatJSON, MODELS, type ContentPart } from '@/lib/study/ai';
import { JSON_RULES, LEVEL_HINT, lang } from '@/lib/study/prompts';

export const maxDuration = 120;

interface AnalyzeResult {
  title: string;
  subject: string;
  topics: { title: string; summary: string; keyPoints: string[]; weight: number }[];
  imageNotes?: string;
  warning?: string;
}

const MAX_TEXT = 150_000;
const MAX_IMAGES = 14;

/**
 * POST { texts:[{name,text}], images:[dataURL], subject?, examTitle?, level?, language? }
 * → the topics the exam will test, in teaching order, each weighted by how
 * much the material emphasises it. Photographed pages are transcribed so
 * later lessons can draw on them too.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const body = await req.json();
    const texts: { name: string; text: string }[] = Array.isArray(body.texts) ? body.texts : [];
    const images: string[] = (Array.isArray(body.images) ? body.images : [])
      .filter((x: unknown) => typeof x === 'string' && (x as string).startsWith('data:image/'))
      .slice(0, MAX_IMAGES);

    let budget = MAX_TEXT;
    const material = texts
      .map(t => {
        const chunk = String(t.text ?? '').slice(0, Math.max(0, budget));
        budget -= chunk.length;
        return chunk ? `=== ${String(t.name).slice(0, 120)} ===\n${chunk}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    if (!material.trim() && !images.length) {
      return Response.json({ error: 'Add some notes, a PDF or photos of your material first.' }, { status: 400 });
    }

    const content: ContentPart[] = [
      { type: 'text', text: `Exam: ${body.examTitle || '(not given)'}\nSubject: ${body.subject || '(work it out)'}\n\nMATERIAL:\n${material || '(see photos)'}` },
      ...images.map(url => ({ type: 'image_url' as const, image_url: { url } })),
    ];

    const result = await chatJSON<AnalyzeResult>({
      models: images.length ? MODELS.VISION : MODELS.FAST,
      maxTokens: images.length ? 12000 : 5000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are an expert teacher planning a student's revision from their own study material (notes, slides, past papers, worksheets, photos).
Identify the distinct topics this exam will test, using ONLY what is in the material — do not add topics it doesn't cover.
- 4 to 12 topics, in a sensible teaching order (foundations first).
- "title": short and specific (e.g. "Completing the square", not "Algebra").
- "summary": one sentence on what the student must be able to do.
- "keyPoints": 3–6 facts, definitions, formulas or skills, taken from the material.
- "weight": 1–5 — how heavily the material (and any past papers in it) emphasises the topic.
Also return "title" (a short name for this exam prep) and "subject".
${images.length ? '- "imageNotes": a faithful transcription of all the text, formulas and diagrams-as-words in the photos, so they can be studied later.' : ''}
If the material is too thin to plan from, still do your best and add a "warning" telling the student what to add.
${LEVEL_HINT(body.level)}
${JSON_RULES}
Shape: {"title":"","subject":"","topics":[{"title":"","summary":"","keyPoints":[""],"weight":3}]${images.length ? ',"imageNotes":""' : ''},"warning":null}
${lang(body.language)}`,
        },
        { role: 'user', content },
      ],
    });

    const topics = (result.topics ?? [])
      .filter(t => t?.title)
      .slice(0, 14)
      .map((t, i) => ({
        id: `t${i + 1}`,
        title: String(t.title).slice(0, 120),
        summary: String(t.summary ?? '').slice(0, 400),
        keyPoints: (t.keyPoints ?? []).map(String).slice(0, 8),
        weight: Math.max(1, Math.min(5, Math.round(Number(t.weight) || 3))),
        order: i,
      }));
    if (!topics.length) return Response.json({ error: "I couldn't find clear topics in that material. Try adding more notes or a clearer PDF." }, { status: 422 });

    return Response.json({
      title: String(result.title || body.examTitle || 'My exam'),
      subject: String(result.subject || body.subject || ''),
      topics,
      imageNotes: result.imageNotes ? String(result.imageNotes).slice(0, 60_000) : '',
      warning: result.warning || null,
    });
  } catch (e) {
    return errorResponse(e, 'Could not analyse your material.');
  }
}

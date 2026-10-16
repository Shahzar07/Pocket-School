import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';
import { getLanguage, isSupportedLanguage } from '@/lib/languages';
import { callOpenRouter, CONTENT_MODEL } from '@/lib/openrouter';
import { normaliseChildControls, withinSparksLimit } from '@/lib/parent-controls';
import { gateAiSpend } from '@/lib/payments/server/settings';
import {
  acceptParentTranslation,
  acceptResearchPack,
  acceptTeacherPack,
  canUseDeskTool,
  deskSparkCost,
  extractJsonObject,
  factsFromSnapshot,
  hasChildActivity,
  isDeskTool,
  isToolkitKind,
  ownsChild,
  parentExplainerFromFacts,
  parentTranslatePrompt,
  researchPrompt,
  researchQuestion,
  teacherPrompt,
  type DeskToolId,
  type ParentExplainer,
  type ResearchPack,
  type TeacherPack,
} from '@/lib/studio/desk';

export const maxDuration = 60;

const NOTES: Record<DeskToolId, string> = {
  'teacher-toolkit': 'ET AI Teacher Toolkit',
  'parent-explainer': 'ET AI Parent Explainer',
  'research-helper': 'ET AI Research Helper',
};

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function sparksSpentToday(uid: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const snap = await adminDb()
    .collection(`users/${uid}/spark_transactions`)
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .limit(100)
    .get();
  return snap.docs.reduce((sum, item) => {
    const amount = Number(item.data().amount ?? 0);
    return amount < 0 ? sum + Math.abs(amount) : sum;
  }, 0);
}

async function parentDailyLimit(uid: string): Promise<number> {
  const parents = await adminDb().collection('users').where('childIds', 'array-contains', uid).limit(10).get();
  let limit = Number.POSITIVE_INFINITY;
  for (const parent of parents.docs) {
    const controls = await adminDb().doc(`users/${parent.id}/child_controls/${uid}`).get();
    if (!controls.exists) continue;
    const normalised = normaliseChildControls({ childId: uid, ...(controls.data() ?? {}) });
    limit = Math.min(limit, normalised.sparksDailyLimit);
  }
  return limit;
}

async function debit(uid: string, tool: DeskToolId): Promise<number> {
  const cost = deskSparkCost(tool);
  const limit = await parentDailyLimit(uid);
  if (Number.isFinite(limit)) {
    const spent = await sparksSpentToday(uid);
    if (!withinSparksLimit(spent, cost, limit)) {
      const error = new Error('SPARKS_LIMIT');
      throw error;
    }
  }
  const userRef = adminDb().doc(`users/${uid}`);
  return adminDb().runTransaction(async tx => {
    const snap = await tx.get(userRef);
    const balance = Number(snap.data()?.sparksBalance ?? 0);
    if (balance < cost) throw new Error('INSUFFICIENT_SPARKS');
    const next = balance - cost;
    tx.update(userRef, { sparksBalance: next, updatedAt: FieldValue.serverTimestamp() });
    tx.set(userRef.collection('spark_transactions').doc(), {
      amount: -cost,
      type: 'studio',
      format: tool,
      note: NOTES[tool],
      balanceAfter: next,
      createdAt: FieldValue.serverTimestamp(),
    });
    return next;
  });
}

async function modelText(prompt: string, jsonMode: boolean): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  const capped = await gateAiSpend('openrouter');
  if (capped) throw new Error(capped);
  return callOpenRouter(
    [
      { role: 'system', content: 'You are ET AI at Poket School. Follow the user instructions exactly.' },
      { role: 'user', content: prompt },
    ],
    { model: CONTENT_MODEL, jsonMode, temperature: 0.4 },
  );
}

/** A model miss falls back to the checked template. A spend cap still stops the request. */
async function optionalModel(prompt: string, jsonMode: boolean): Promise<string | null> {
  try {
    return await modelText(prompt, jsonMode);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('spend cap')) throw error;
    console.error('[studio-desk] model', error);
    return null;
  }
}

function spendError(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : '';
  if (message === 'INSUFFICIENT_SPARKS') {
    return NextResponse.json({ error: 'You do not have enough Sparks for this.', code: 'INSUFFICIENT_SPARKS' }, { status: 402 });
  }
  if (message === 'SPARKS_LIMIT') {
    return NextResponse.json({ error: 'A parent limit stops this Sparks spend for today.', code: 'SPARKS_LIMIT' }, { status: 402 });
  }
  return null;
}

async function childActivity(childId: string) {
  const db = adminDb();
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const from = localDay(start);
  const to = localDay(today);
  const [child, snapshot, goals] = await Promise.all([
    db.doc(`users/${childId}`).get(),
    db.doc(`analytics_snapshots/student_${childId}`).get(),
    db.collection('daily_goals').where('studentId', '==', childId).limit(40).get(),
  ]);
  const name = typeof child.data()?.name === 'string' && child.data()?.name
    ? String(child.data()?.name)
    : 'Your child';
  const titles = goals.docs.flatMap(row => {
    const data = row.data();
    const dateKey = typeof data.dateKey === 'string' ? data.dateKey : '';
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    if (!title || dateKey < from || dateKey > to) return [];
    return [title];
  });
  const stored = snapshot.exists ? snapshot.data() as Record<string, unknown> : null;
  return factsFromSnapshot(name, stored, titles);
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { limit: 12, windowMs: 60_000 });
  if (isNextResponse(user)) return user;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const tool = typeof body?.tool === 'string' ? body.tool : '';
  if (!isDeskTool(tool)) {
    return NextResponse.json({ error: 'Choose a studio tool.', code: 'BAD_TOOL' }, { status: 400 });
  }

  const profile = await loadUser(user.uid);
  if (!profile) return NextResponse.json({ error: 'Account not found.', code: 'USER_NOT_FOUND' }, { status: 404 });
  const source = {
    role: typeof profile.role === 'string' ? profile.role : null,
    roles: Array.isArray(profile.roles) ? profile.roles.filter((item): item is string => typeof item === 'string') : [],
    email: user.email,
  };
  if (!canUseDeskTool(source, tool)) {
    return NextResponse.json({ error: 'This tool is not open for your role.', code: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    if (tool === 'teacher-toolkit') {
      const topic = String(body?.topic ?? '').trim().slice(0, 200);
      const subject = String(body?.subject ?? '').trim().slice(0, 80);
      const level = String(body?.level ?? '').trim().slice(0, 80);
      const kind = isToolkitKind(typeof body?.kind === 'string' ? body.kind : '') ? body?.kind as string : 'pack';
      if (!topic || !subject) {
        return NextResponse.json({ error: 'Add a subject and a topic.', code: 'BAD_INPUT' }, { status: 400 });
      }
      const input = { topic, subject, level: level || 'the programme', kind: kind as TeacherPack['kind'] };
      let pack = acceptTeacherPack(null, input);
      const text = await optionalModel(teacherPrompt(input), true);
      if (text) pack = acceptTeacherPack(extractJsonObject(text), input);
      const balance = await debit(user.uid, tool);
      return NextResponse.json({ tool, result: pack, cost: deskSparkCost(tool), balance });
    }

    if (tool === 'parent-explainer') {
      const childId = String(body?.childId ?? '').trim();
      const childIds = Array.isArray(profile.childIds) ? profile.childIds.filter((item): item is string => typeof item === 'string') : [];
      if (!ownsChild(childIds, childId)) {
        return NextResponse.json({ error: 'You can only explain a child linked to you.', code: 'NOT_YOUR_CHILD' }, { status: 403 });
      }
      const requested = typeof body?.language === 'string' ? body.language : '';
      const profileLanguage = typeof profile.language === 'string' ? profile.language : 'en';
      const language = isSupportedLanguage(requested) ? requested : isSupportedLanguage(profileLanguage) ? profileLanguage : 'en';
      const facts = await childActivity(childId);
      const explainer = parentExplainerFromFacts(facts);
      if (!hasChildActivity(facts)) {
        return NextResponse.json({ tool, result: explainer, cost: 0, balance: Number(profile.sparksBalance ?? 0) });
      }
      let result: ParentExplainer = explainer;
      if (language !== 'en') {
        const text = await optionalModel(parentTranslatePrompt(explainer, getLanguage(language).englishName), false);
        if (text) result = acceptParentTranslation(text, explainer, getLanguage(language).englishName);
      }
      const balance = await debit(user.uid, tool);
      return NextResponse.json({ tool, result, cost: deskSparkCost(tool), balance });
    }

    const asked = researchQuestion(String(body?.question ?? ''));
    if (!asked.question) {
      return NextResponse.json({ error: 'Add a research question.', code: 'BAD_INPUT' }, { status: 400 });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'AI is not configured on this server yet.', code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    }
    const text = await modelText(researchPrompt(asked.question), true);
    const pack: ResearchPack | null = text ? acceptResearchPack(extractJsonObject(text), asked) : null;
    if (!pack) {
      return NextResponse.json({
        error: 'ET AI could not find sources it is willing to stand behind. Nothing was written, and no Sparks were spent.',
        code: 'NO_SOURCES',
      }, { status: 422 });
    }
    const balance = await debit(user.uid, 'research-helper');
    return NextResponse.json({ tool: 'research-helper', result: pack, cost: deskSparkCost('research-helper'), balance });
  } catch (error) {
    const spent = spendError(error);
    if (spent) return spent;
    const message = error instanceof Error ? error.message : '';
    if (message.includes('spend cap')) {
      return NextResponse.json({ error: message, code: 'SPEND_CAP' }, { status: 402 });
    }
    console.error('[studio-desk]', error);
    return NextResponse.json({ error: 'ET AI could not finish that. No Sparks were spent.', code: 'FAILED' }, { status: 500 });
  }
}

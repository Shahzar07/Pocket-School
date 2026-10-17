/**
 * Server-side ET AI moderation. Every publish path calls reviewText.
 * Patterns always run. OpenRouter or Gemini can only make the result stricter.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { asAgeTier, type AgeTier } from '../age-tier';
import { ActionError } from './actions';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import {
  mergeScreen, parseModelScreen, screenContent, type ModerationSurface, type ModerationThresholds, type SafetySeverity,
} from '../moderation/screen';
import { muteActive, nextStrike, strikeLabel, type StrikeAction } from '../moderation/strikes';
import {
  alertCopy, categoryLabel, conversationGuide, detectPatterns, planAlert, redactExcerpt, shouldEscalate,
  type AlertAudience, type ParentSafetyLevel, type SafetyEvent,
} from '../moderation/safeguard';
import { casePdf } from '../moderation/pdf';
import { callOpenRouter, FAST_MODEL } from '../openrouter';

const AUDIT_MS = 90 * 24 * 60 * 60 * 1000;

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface ReviewInput {
  surface: ModerationSurface;
  authorId: string;
  authorName: string;
  ageTier: AgeTier;
  text: string;
  subjectPath: string;
  institutionId?: string;
  classId?: string;
  spaceLabel?: string;
  hasImage?: boolean;
  targetIds?: string[];
  teacherIds?: string[];
}

export interface ReviewOutcome {
  decision: 'allow' | 'hold' | 'block';
  reasons: string[];
  category: string;
  severity: SafetySeverity;
  authorMessage: string;
  queueId: string | null;
  strikeAction: StrikeAction;
}

async function modelOpinion(text: string, surface: string, ageTier: AgeTier): Promise<{ decision: 'allow' | 'hold' | 'block'; reasons: string[] } | null> {
  const prompt = 'You are ET AI moderating Poket School. Reply with JSON {"decision":"allow"|"hold"|"block","reasons":["hate"|"harassment"|"sexual"|"violence"|"self_harm"|"scam"|"spam"|"personal_data"|"grooming"|"investment_solicitation"]}. '
    + 'Block hate, harassment, sexual content, threats, self-harm, scams, spam, personal data, grooming, and unsolicited investment pitches. Hold borderline tone. Do not include the source text in your reply. '
    + `Surface: ${surface}. Age: ${ageTier}. Text:\n${text.slice(0, 1500)}`;
  const openRouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouter && !/^(your_|MY_|TODO)/i.test(openRouter)) {
    try {
      const raw = await callOpenRouter([{ role: 'user', content: prompt }], { model: FAST_MODEL, temperature: 0, maxTokens: 180, jsonMode: true });
      return parseModelScreen(raw);
    } catch (error) {
      console.error('ET AI moderation skipped', error);
    }
  }
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (!gemini || /^(your_|MY_|TODO)/i.test(gemini)) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(gemini)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    if (!response.ok) return null;
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return parseModelScreen(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  } catch (error) {
    console.error('ET AI moderation skipped', error);
    return null;
  }
}

async function thresholdsFor(institutionId: string, ageTier: AgeTier): Promise<Partial<ModerationThresholds>> {
  const [platform, school] = await Promise.all([
    db().doc('platform_settings/moderation').get(),
    institutionId ? db().doc(`safeguarding_settings/${institutionId}`).get() : Promise.resolve(null),
  ]);
  const raw = { ...(platform.data() ?? {}), ...(school?.data()?.thresholds ?? {}) } as Record<string, unknown>;
  const pick = (key: keyof ModerationThresholds): 'hold' | 'block' | undefined => {
    const value = raw[key];
    return value === 'hold' || value === 'block' ? value : undefined;
  };
  if (ageTier !== 'adult') {
    return { adultMildInsult: 'block', personalData: 'block', imageWithoutVision: pick('imageWithoutVision') ?? 'hold' };
  }
  return {
    adultMildInsult: pick('adultMildInsult'),
    personalData: pick('personalData'),
    imageWithoutVision: pick('imageWithoutVision'),
  };
}

async function notify(userId: string, title: string, body: string, link: string, severity: SafetySeverity) {
  if (!userId) return;
  await db().collection('notifications').add({
    userId,
    title,
    message: body,
    link,
    type: 'general',
    pushCategory: 'safety',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  try {
    await sendPush(
      { recipientUid: userId, category: 'safety', title, body, link, force: severity === 'critical' },
      { store: adminPushStore(), send: sendToDevice },
    );
  } catch (error) {
    console.error('safety push skipped', error);
  }
}

export async function reviewText(input: ReviewInput): Promise<ReviewOutcome> {
  const strikeSnap = await db().doc(`moderation_strikes/${input.authorId}`).get();
  const strikeData = strikeSnap.data() ?? {};
  const mutedUntilMs = typeof strikeData.mutedUntilMs === 'number' ? strikeData.mutedUntilMs : null;
  if (muteActive(mutedUntilMs, strikeData.suspended === true, Date.now())) {
    throw new ActionError('FORBIDDEN', `Posting is paused (${strikeLabel(str(strikeData.action) as StrikeAction)}). You can appeal from ${'/community-guidelines'}.`);
  }
  const thresholds = await thresholdsFor(input.institutionId ?? '', input.ageTier);
  const local = screenContent({
    text: input.text,
    surface: input.surface,
    ageTier: input.ageTier,
    hasImage: input.hasImage,
    thresholds,
  });
  const ai = local.decision === 'block' ? null : await modelOpinion(input.text, input.surface, input.ageTier);
  const result = mergeScreen(local, ai);
  const now = Date.now();
  let strikeAction: StrikeAction = 'none';
  if (result.decision === 'block') {
    const strike = nextStrike(typeof strikeData.count === 'number' ? strikeData.count : 0, result.severity, now);
    strikeAction = strike.action;
    await db().doc(`moderation_strikes/${input.authorId}`).set({
      userId: input.authorId,
      count: strike.count,
      action: strike.action,
      mutedUntilMs: strike.mutedUntilMs,
      suspended: strike.suspended,
      updatedAtMs: now,
    });
    await db().collection('moderation_actions').add({
      userId: input.authorId,
      action: strike.action,
      category: result.category,
      severity: result.severity,
      surface: input.surface,
      atMs: now,
    });
    await db().collection('moderation_audit').add({
      authorId: input.authorId,
      surface: input.surface,
      text: input.text.slice(0, 2000),
      category: result.category,
      severity: result.severity,
      institutionId: input.institutionId ?? '',
      createdAtMs: now,
      purgeAtMs: now + AUDIT_MS,
    });
  }
  let queueId: string | null = null;
  if (result.decision !== 'allow') {
    const ref = await db().collection('moderation_queue').add({
      surface: input.surface,
      authorId: input.authorId,
      ageTier: input.ageTier,
      text: input.text.slice(0, 2000),
      decision: result.decision,
      reasons: result.reasons,
      category: result.category,
      severity: result.severity,
      status: 'open',
      subjectPath: input.subjectPath,
      institutionId: input.institutionId ?? '',
      authorMessage: result.authorMessage,
      createdAtMs: now,
    });
    queueId = ref.id;
    await db().collection('moderation_events').add({
      authorId: input.authorId,
      targetIds: input.targetIds ?? [],
      category: result.category,
      severity: result.severity,
      surface: input.surface,
      atMs: now,
    });
  }
  if (result.safeguarding || result.severity === 'medium' || result.severity === 'high' || result.severity === 'critical') {
    await openSafeguarding(input, result.category, result.severity, result.decision);
  }
  return {
    decision: result.decision,
    reasons: result.reasons,
    category: result.category,
    severity: result.severity,
    authorMessage: result.authorMessage,
    queueId,
    strikeAction,
  };
}

async function openSafeguarding(
  input: ReviewInput,
  category: string,
  severity: SafetySeverity,
  decision: string,
) {
  const institutionId = input.institutionId ?? '';
  const settingsSnap = institutionId ? await db().doc(`safeguarding_settings/${institutionId}`).get() : null;
  const settings = settingsSnap?.data() ?? {};
  const parentLevel: ParentSafetyLevel = settings.parentLevel === 'all' || settings.parentLevel === 'medium' ? settings.parentLevel : 'high';
  const plan = planAlert({
    ageTier: input.ageTier,
    severity,
    category: category as never,
    parentLevel,
    tellTeacher: settings.tellTeacher !== false,
    now: new Date(),
    quietStart: str(settings.quietStart) || '21:00',
    quietEnd: str(settings.quietEnd) || '07:00',
  });
  const recent = await db().collection('moderation_events').where('authorId', '==', input.authorId).limit(40).get();
  const events: SafetyEvent[] = recent.docs.map(doc => ({
    authorId: input.authorId,
    targetIds: Array.isArray(doc.data().targetIds) ? doc.data().targetIds.filter((id: unknown): id is string => typeof id === 'string') : [],
    category: (str(doc.data().category) || 'borderline') as SafetyEvent['category'],
    severity: (str(doc.data().severity) || 'low') as SafetySeverity,
    atMs: typeof doc.data().atMs === 'number' ? doc.data().atMs : 0,
    surface: str(doc.data().surface),
  }));
  const patterns = detectPatterns(events, Date.now());
  const caseRef = await db().collection('safeguarding_cases').add({
    institutionId,
    authorId: input.authorId,
    authorName: input.authorName,
    targetIds: input.targetIds ?? [],
    category,
    severity,
    surface: input.surface,
    space: input.spaceLabel || input.surface,
    status: 'open',
    outcome: '',
    assignees: Array.isArray(settings.leadIds) ? settings.leadIds.filter((id: unknown): id is string => typeof id === 'string') : [],
    patterns: patterns.map(hit => hit.kind),
    timeline: [{ atMs: Date.now(), kind: 'opened', note: `${categoryLabel(category as never)} was ${decision}.` }],
    createdAtMs: Date.now(),
    trainingUse: false,
  });
  const actionTaken = decision === 'block' ? 'The content was removed.' : 'The content is held for review.';
  const excerpt = redactExcerpt(input.text);
  const audiences = new Set<AlertAudience>(plan.audiences);
  if (patterns.length && input.ageTier !== 'adult') audiences.add('safeguarding_lead');
  const leadIds = Array.isArray(settings.leadIds) ? settings.leadIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  const recipients: { id: string; audience: AlertAudience }[] = [];
  if (audiences.has('safeguarding_lead')) for (const id of leadIds) recipients.push({ id, audience: 'safeguarding_lead' });
  if (audiences.has('teacher')) for (const id of input.teacherIds ?? []) recipients.push({ id, audience: 'teacher' });
  if (audiences.has('admin') || audiences.has('moderator')) {
    const admins = await db().collection('users').where('role', '==', 'admin').limit(10).get();
    for (const doc of admins.docs) recipients.push({ id: doc.id, audience: 'admin' });
  }
  if (audiences.has('author_parent') || audiences.has('victim_parent')) {
    const parents = await db().collection('users').where('childIds', 'array-contains', input.authorId).limit(8).get();
    for (const doc of parents.docs) recipients.push({ id: doc.id, audience: 'author_parent' });
    for (const targetId of input.targetIds ?? []) {
      const victimParents = await db().collection('users').where('childIds', 'array-contains', targetId).limit(8).get();
      for (const doc of victimParents.docs) recipients.push({ id: doc.id, audience: 'victim_parent' });
    }
  }
  const seen = new Set<string>();
  for (const recipient of recipients) {
    const key = `${recipient.id}:${recipient.audience}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const firstName = input.authorName.split(' ')[0] || 'Your child';
    const copy = alertCopy({
      audience: recipient.audience,
      childFirstName: firstName,
      otherLabel: 'another student',
      category: category as never,
      severity,
      space: input.spaceLabel || 'a school space',
      actionTaken,
    });
    const staff = recipient.audience === 'safeguarding_lead' || recipient.audience === 'teacher' || recipient.audience === 'admin' || recipient.audience === 'moderator';
    await db().collection('safeguarding_alerts').add({
      caseId: caseRef.id,
      userId: recipient.id,
      audience: recipient.audience,
      severity,
      category,
      timing: plan.timing,
      title: copy.title,
      body: staff ? `${copy.body} ${excerpt}` : copy.body,
      excerpt: staff ? excerpt : '',
      fullTextVisible: staff,
      actionTaken,
      guide: conversationGuide({ audience: recipient.audience === 'author_parent' || recipient.audience === 'victim_parent' ? 'parent' : 'teacher', category: category as never }),
      status: 'open',
      ackAtMs: null,
      escalateAtMs: plan.escalateIfUnackedMs ? Date.now() + plan.escalateIfUnackedMs : null,
      institutionId,
      channels: { inbox: plan.inbox, push: plan.push, email: plan.email },
      createdAtMs: Date.now(),
    });
    if (plan.inbox && plan.timing !== 'digest') {
      await notify(recipient.id, copy.title, staff ? `${copy.body} ${excerpt}` : copy.body, `/dashboard/admin/safeguarding?case=${caseRef.id}`, severity);
    }
    if (plan.email) {
      await db().collection('safety_mail').add({
        userId: recipient.id,
        subject: copy.title,
        body: copy.body,
        severity,
        status: 'queued',
        createdAtMs: Date.now(),
      });
    }
  }
}

export async function appealRemoval(userId: string, queueId: string, note: string) {
  const item = await db().doc(`moderation_queue/${queueId}`).get();
  if (!item.exists || item.data()?.authorId !== userId) throw new ActionError('NOT_FOUND', 'That decision was not found.');
  const ref = await db().collection('moderation_appeals').add({
    queueId,
    userId,
    note: note.slice(0, 500),
    status: 'open',
    createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function resolveAppeal(actorId: string, appealId: string, restore: boolean) {
  const appeal = await db().doc(`moderation_appeals/${appealId}`).get();
  if (!appeal.exists) throw new ActionError('NOT_FOUND', 'Appeal not found.');
  const status = restore ? 'restored' : 'upheld';
  await appeal.ref.set({ status, resolvedBy: actorId, resolvedAtMs: Date.now() }, { merge: true });
  const queueId = str(appeal.data()?.queueId);
  const item = queueId ? await db().doc(`moderation_queue/${queueId}`).get() : null;
  const subjectPath = str(item?.data()?.subjectPath);
  if (subjectPath && restore) await db().doc(subjectPath).set({ moderation: 'allow' }, { merge: true });
  if (queueId) await db().doc(`moderation_queue/${queueId}`).set({ status: restore ? 'approved' : 'rejected' }, { merge: true });
  return { status };
}

export async function acknowledgeAlert(userId: string, alertId: string) {
  const alert = await db().doc(`safeguarding_alerts/${alertId}`).get();
  if (!alert.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  if (alert.data()?.userId !== userId && str(alert.data()?.audience) !== 'admin') {
    const user = await db().doc(`users/${userId}`).get();
    if (user.data()?.role !== 'admin' && user.data()?.role !== 'institution_admin') {
      throw new ActionError('FORBIDDEN', 'Only the recipient or a school admin can acknowledge this.');
    }
  }
  await alert.ref.set({ status: 'acknowledged', ackAtMs: Date.now() }, { merge: true });
  return { ok: true };
}

export async function escalateUnacked(now = Date.now()) {
  const snap = await db().collection('safeguarding_alerts').where('status', '==', 'open').limit(40).get();
  let escalated = 0;
  for (const doc of snap.docs) {
    const wait = typeof doc.data().escalateAtMs === 'number' ? doc.data().escalateAtMs as number : 0;
    const created = typeof doc.data().createdAtMs === 'number' ? doc.data().createdAtMs as number : now;
    if (!wait || !shouldEscalate(typeof doc.data().ackAtMs === 'number' ? doc.data().ackAtMs : null, created, wait - created, now)) continue;
    await doc.ref.set({ status: 'escalated' }, { merge: true });
    escalated += 1;
    const caseId = str(doc.data().caseId);
    if (caseId) {
      await db().doc(`safeguarding_cases/${caseId}`).set({
        timeline: FieldValue.arrayUnion({ atMs: now, kind: 'escalated', note: 'No acknowledgement within 15 minutes.' }),
      }, { merge: true });
    }
  }
  return { escalated };
}

/** Deletes expired social moderation logs only. Hotline and emergency records are never purged. */
export async function purgeAudit(now = Date.now()) {
  const snap = await db().collection('moderation_audit').where('purgeAtMs', '<=', now).limit(50).get();
  for (const doc of snap.docs) await doc.ref.delete();
  return { purged: snap.size };
}

export async function caseFile(actorId: string, caseId: string) {
  await assertSafeguarding(actorId);
  const item = await db().doc(`safeguarding_cases/${caseId}`).get();
  if (!item.exists) throw new ActionError('NOT_FOUND', 'Case not found.');
  return { id: item.id, ...item.data() };
}

export async function exportCasePdf(actorId: string, caseId: string) {
  const file = await caseFile(actorId, caseId);
  const record = file as { category?: string; severity?: string; status?: string; space?: string };
  const bytes = casePdf([
    'Poket School safeguarding case',
    `Category: ${record.category ?? ''}`,
    `Severity: ${record.severity ?? ''}`,
    `Status: ${record.status ?? ''}`,
    `Space: ${record.space ?? ''}`,
    'Flagged content is not used to train AI models.',
  ]);
  return { pdfBase64: Buffer.from(bytes).toString('base64') };
}

export async function addCaseNote(actorId: string, caseId: string, note: string) {
  await assertSafeguarding(actorId);
  await db().doc(`safeguarding_cases/${caseId}`).set({
    timeline: FieldValue.arrayUnion({ atMs: Date.now(), kind: 'note', actorId, note: note.slice(0, 1000) }),
  }, { merge: true });
  return { ok: true };
}

export async function setCaseStatus(actorId: string, caseId: string, status: string, outcome: string) {
  await assertSafeguarding(actorId);
  const allowed = status === 'open' || status === 'monitoring' || status === 'resolved';
  if (!allowed) throw new ActionError('VALIDATION', 'Status must be open, monitoring, or resolved.');
  await db().doc(`safeguarding_cases/${caseId}`).set({
    status,
    outcome: outcome.slice(0, 300),
    timeline: FieldValue.arrayUnion({ atMs: Date.now(), kind: 'status', actorId, note: status }),
  }, { merge: true });
  return { status };
}

export async function recordFalsePositive(actorId: string, queueId: string) {
  await assertSafeguarding(actorId);
  const item = await db().doc(`moderation_queue/${queueId}`).get();
  if (!item.exists) throw new ActionError('NOT_FOUND', 'Queue item not found.');
  await db().collection('safety_feedback').add({
    queueId,
    actorId,
    category: str(item.data()?.category),
    falsePositive: true,
    createdAtMs: Date.now(),
  });
  const category = str(item.data()?.category);
  if (category === 'harassment' && item.data()?.ageTier === 'adult') {
    await db().doc('platform_settings/moderation').set({ adultMildInsult: 'hold' }, { merge: true });
  }
  return { ok: true };
}

async function assertSafeguarding(actorId: string) {
  const user = await db().doc(`users/${actorId}`).get();
  const role = str(user.data()?.role);
  if (role !== 'admin' && role !== 'institution_admin' && role !== 'teacher') {
    throw new ActionError('FORBIDDEN', 'Safeguarding cases are for the safeguarding lead and admins.');
  }
}

export async function publishScreened(input: ReviewInput & { collection: 'alumni_wall_posts' | 'yearbook_notes'; extra?: Record<string, unknown> }) {
  const ref = db().collection(input.collection).doc();
  const mod = await reviewText({ ...input, subjectPath: `${input.collection}/${ref.id}` });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await ref.set({
    authorId: input.authorId,
    authorName: input.authorName,
    ageTier: asAgeTier(input.ageTier),
    institutionId: input.institutionId ?? '',
    body: input.text.slice(0, 4000),
    moderation: mod.decision,
    createdAtMs: Date.now(),
    ...(input.extra ?? {}),
  });
  return { id: ref.id, moderation: mod.decision, authorMessage: mod.authorMessage };
}

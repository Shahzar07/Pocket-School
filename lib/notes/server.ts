/**
 * Server-only note work: reminders, trash purge, study-group sharing,
 * and ET AI actions the owner explicitly starts.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { asAgeTier } from '../age-tier';
import { isQuietMinutes } from '../alerts/progress';
import { mergeModeration, moderateText, parseAiModeration } from '../community/moderation';
import { adminDb } from '../firebase-admin';
import { notifyUser } from '../server/device-push';
import { ActionError } from '../server/actions';
import { chat, MODELS } from '../study/ai';
import {
  TRASH_MS,
  noteActionPrompt,
  cleanChecklist,
  reminderDecision,
  shareAllowed,
  type NoteAction,
  type ShareSpace,
} from './model';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function deliverNoteReminders(now = Date.now()): Promise<{ sent: number; held: number }> {
  const db = adminDb();
  const due = await db.collectionGroup('notes')
    .where('remindedAt', '==', 0)
    .where('remindAt', '>', 0)
    .where('remindAt', '<=', now)
    .limit(40)
    .get();
  let sent = 0;
  let held = 0;
  for (const item of due.docs) {
    const data = item.data();
    const uid = item.ref.parent.parent?.id ?? '';
    if (!uid) continue;
    const settings = await db.doc(`notify_settings/${uid}`).get();
    const start = text(settings.data()?.quietStart) || '21:00';
    const end = text(settings.data()?.quietEnd) || '07:00';
    const clock = new Date(now);
    const quiet = isQuietMinutes(clock.getUTCHours() * 60 + clock.getUTCMinutes(), start, end);
    const decision = reminderDecision({
      remindAt: typeof data.remindAt === 'number' ? data.remindAt : 0,
      remindedAt: typeof data.remindedAt === 'number' ? data.remindedAt : 0,
      deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : null,
      now,
      quiet,
    });
    if (decision === 'wait') {
      held += 1;
      continue;
    }
    if (decision === 'skip') {
      await item.ref.set({ remindedAt: now }, { merge: true });
      continue;
    }
    const body = text(data.text).slice(0, 140) || 'Open your note.';
    await notifyUser({
      userId: uid,
      title: 'Note reminder',
      message: body,
      type: 'general',
      pref: 'general',
      link: '/dashboard/notes',
    });
    await item.ref.set({ remindedAt: now }, { merge: true });
    sent += 1;
  }
  return { sent, held };
}

export async function purgeNoteTrash(now = Date.now()): Promise<{ deleted: number }> {
  const cutoff = now - TRASH_MS;
  const old = await adminDb().collectionGroup('notes')
    .where('deletedAt', '>', 0)
    .where('deletedAt', '<=', cutoff)
    .limit(40)
    .get();
  await Promise.all(old.docs.map((item) => item.ref.delete()));
  return { deleted: old.size };
}

export async function listStudyGroups(uid: string): Promise<{ id: string; title: string; kind: string }[]> {
  const db = adminDb();
  const user = await db.doc(`users/${uid}`).get();
  const ageTier = asAgeTier(user.data()?.ageTier);
  const institutionId = text(user.data()?.institutionId);
  const [member, staff] = await Promise.all([
    db.collection('spaces').where('memberIds', 'array-contains', uid).limit(30).get(),
    db.collection('spaces').where('staffIds', 'array-contains', uid).limit(20).get(),
  ]);
  const seen = new Set<string>();
  const groups = [];
  for (const item of [...member.docs, ...staff.docs]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const space = spaceOf(item.data());
    if (!shareAllowed({ uid, ageTier, userInstitutionId: institutionId, space }).ok) continue;
    groups.push({ id: item.id, title: text(item.data()?.title) || 'Study group', kind: space.kind });
  }
  return groups;
}

function spaceOf(data: FirebaseFirestore.DocumentData | undefined): ShareSpace {
  return {
    kind: text(data?.kind) || 'subject',
    institutionId: text(data?.institutionId),
    memberIds: list(data?.memberIds),
    staffIds: list(data?.staffIds),
  };
}

export async function shareNote(uid: string, noteId: string, spaceId: string): Promise<{ status: string; reason: string }> {
  const db = adminDb();
  const [user, note, space] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`users/${uid}/notes/${noteId}`).get(),
    db.doc(`spaces/${spaceId}`).get(),
  ]);
  if (!note.exists) throw new ActionError('NOT_FOUND', 'Note not found');
  if (!space.exists) throw new ActionError('NOT_FOUND', 'Study group not found');
  const decision = shareAllowed({
    uid,
    ageTier: user.data()?.ageTier,
    userInstitutionId: text(user.data()?.institutionId),
    space: spaceOf(space.data()),
  });
  if (!decision.ok) throw new ActionError('FORBIDDEN', decision.reason);
  const body = text(note.data()?.text);
  const local = moderateText(body || 'note');
  let ai = null;
  if (local.decision !== 'block') {
    try {
      const raw = await chat({
        models: MODELS.FAST,
        maxTokens: 180,
        json: true,
        temperature: 0,
        messages: [{
          role: 'user',
          content: 'You moderate a school study note. Reply with JSON {"decision":"allow"|"hold"|"block","reasons":["..."]}. '
            + 'Block sexual content involving minors, self-harm encouragement, and threats. Hold harassment and contact details. '
            + `Text:\n${body.slice(0, 2000)}`,
        }],
      });
      ai = parseAiModeration(raw);
    } catch (error) {
      console.error('note moderation skipped', error);
    }
  }
  const result = mergeModeration(local, ai);
  const status = result.decision === 'allow' ? 'live' : result.decision === 'hold' ? 'held' : 'blocked';
  const share = { spaceId, status, at: Date.now() };
  await note.ref.set({ share, updatedAt: Date.now() }, { merge: true });
  const shareRef = db.doc(`note_shares/${uid}_${noteId}`);
  if (status === 'live') {
    const name = text(user.data()?.name).split(/\s+/)[0] || 'Student';
    await shareRef.set({
      ownerId: uid,
      noteId,
      spaceId,
      status,
      text: body.slice(0, 2000),
      colour: text(note.data()?.colour) || 'white',
      authorFirstName: name,
      at: Date.now(),
    });
  } else {
    await shareRef.delete().catch(() => undefined);
    await db.collection('moderation_queue').add({
      surface: 'note',
      authorId: uid,
      ageTier: asAgeTier(user.data()?.ageTier),
      text: body.slice(0, 2000),
      decision: result.decision,
      reasons: result.reasons,
      status: 'open',
      subjectPath: `users/${uid}/notes/${noteId}`,
      createdAtMs: Date.now(),
    });
  }
  return { status, reason: result.reasons[0] ?? '' };
}

export async function unshareNote(uid: string, noteId: string): Promise<void> {
  const db = adminDb();
  const ref = db.doc(`users/${uid}/notes/${noteId}`);
  const note = await ref.get();
  if (!note.exists) throw new ActionError('NOT_FOUND', 'Note not found');
  await ref.set({ share: FieldValue.delete(), updatedAt: Date.now() }, { merge: true });
  await db.doc(`note_shares/${uid}_${noteId}`).delete().catch(() => undefined);
}

export async function runNoteAction(uid: string, action: NoteAction, noteIds: readonly string[]): Promise<{ text: string; cards: { front: string; back: string }[] }> {
  const ids = noteIds.filter((id) => typeof id === 'string' && id.trim()).slice(0, 20);
  if (ids.length === 0) throw new ActionError('VALIDATION', 'Choose at least one note.');
  const db = adminDb();
  const snaps = await Promise.all(ids.map((id) => db.doc(`users/${uid}/notes/${id}`).get()));
  const notes = snaps.filter((item) => item.exists).map((item) => ({
    text: text(item.data()?.text),
    checklist: cleanChecklist(item.data()?.checklist),
  })).filter((item) => item.text || (item.checklist as unknown[]).length > 0);
  if (notes.length === 0) throw new ActionError('NOT_FOUND', 'Those notes are not on your board.');
  const raw = await chat({
    models: MODELS.FAST,
    maxTokens: action === 'flashcards' ? 900 : 500,
    json: action === 'flashcards',
    messages: [
      { role: 'system', content: 'You are ET AI for Poket School. Help the student study from their own notes. Do not invent a different curriculum.' },
      { role: 'user', content: noteActionPrompt(action, notes) },
    ],
  });
  if (action !== 'flashcards') return { text: raw.trim(), cards: [] };
  try {
    const parsed = JSON.parse(raw) as { cards?: { front?: unknown; back?: unknown }[] };
    const cards = (parsed.cards ?? []).slice(0, 12).flatMap((card) => {
      const front = text(card.front);
      const back = text(card.back);
      return front && back ? [{ front, back }] : [];
    });
    return { text: '', cards };
  } catch {
    return { text: raw.trim(), cards: [] };
  }
}

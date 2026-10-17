/**
 * Widen a case or emergency to every staff member, take check-ins,
 * and send the all-clear. The audit is append-only. The staff payload
 * is the stripped view from lib/alerts/all-staff.ts.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  ALL_STAFF_LABELS,
  ALL_STAFF_TYPES,
  checkInProblem,
  cleanInstruction,
  defaultInstruction,
  instructionText,
  isAllStaffType,
  languageOf,
  rollCallCounts,
  staffAlertView,
  widenProblem,
  type AllStaffType,
  type InstructionLang,
  INSTRUCTION_LANGS,
} from '../alerts/all-staff';
import { resolveRecipients } from '../alerts/recipients';
import { GENESIS, emptyLegalHold, type ChainDevice } from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { peopleAtInstitution, tierOf } from './alert-directory';
import { ActionError } from './actions';
import { appendChain } from './ledger';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

interface Actor {
  id: string;
  role: string;
  name: string;
  institutionId: string;
  staffPost: string;
  verificationTier: number;
  language: string;
}

function deviceOf(input: Record<string, unknown> | undefined): ChainDevice {
  const raw = input?.device;
  if (!raw || typeof raw !== 'object') return SERVER_DEVICE;
  const device = raw as Partial<ChainDevice>;
  if (typeof device.platform !== 'string' || typeof device.appVersion !== 'string' || typeof device.ipHash !== 'string') {
    return SERVER_DEVICE;
  }
  return { platform: device.platform.slice(0, 40), appVersion: device.appVersion.slice(0, 40), ipHash: device.ipHash };
}

async function loadActor(uid: string): Promise<Actor> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = snap.data() ?? {};
  return {
    id: uid,
    role: str(data.role),
    name: str(data.name),
    institutionId: str(data.institutionId),
    staffPost: str(data.staffPost),
    verificationTier: tierOf(data),
    language: str(data.language) || str(data.locale),
  };
}

function isStaff(actor: Actor): boolean {
  if (actor.role === 'student' || actor.role === 'parent') return false;
  return actor.role === 'teacher'
    || actor.role === 'institution_admin'
    || actor.role === 'admin'
    || actor.staffPost === 'teacher'
    || actor.staffPost === 'academic_lead'
    || actor.staffPost === 'principal'
    || actor.staffPost === 'safeguarding_lead';
}

async function pushEmergency(uid: string, title: string, body: string, link: string) {
  if (!uid) return;
  await sendPush({
    recipientUid: uid,
    category: 'emergency',
    title,
    body: body.slice(0, 140),
    link,
    force: true,
    sound: 'emergency',
  }, { store: adminPushStore(), send: sendToDevice });
}

type InstructionMap = Partial<Record<AllStaffType, Partial<Record<InstructionLang, string>>>>;

async function instructionMap(institutionId: string): Promise<InstructionMap> {
  if (!institutionId) return {};
  const snap = await db().doc(`all_staff_instructions/${institutionId}`).get();
  const types = snap.data()?.types;
  if (!types || typeof types !== 'object') return {};
  const map: InstructionMap = {};
  for (const type of ALL_STAFF_TYPES) {
    const row = (types as Record<string, unknown>)[type];
    if (!row || typeof row !== 'object') continue;
    const texts: Partial<Record<InstructionLang, string>> = {};
    for (const lang of INSTRUCTION_LANGS) {
      const text = cleanInstruction((row as Record<string, unknown>)[lang]);
      if (text) texts[lang] = text;
    }
    map[type] = texts;
  }
  return map;
}

function sourceParent(source: string, sourceId: string): { path: string; collection: 'events' | 'audit' } | null {
  if (source === 'case') return { path: `hotline_tickets/${sourceId}`, collection: 'events' };
  if (source === 'emergency') return { path: `emergency_alerts/${sourceId}`, collection: 'audit' };
  return null;
}

async function logAlert(
  alertId: string,
  actor: { id: string; role: string },
  action: string,
  diff: { before: Record<string, unknown>; after: Record<string, unknown> },
  device: ChainDevice,
) {
  await appendChain({
    parentPath: `all_staff_alerts/${alertId}`,
    collection: 'audit',
    actorUid: actor.id,
    actorRole: actor.role,
    action,
    diff,
    device,
  });
}

export async function widenAllStaff(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const type = str(input.type);
  const location = str(input.location).slice(0, 160);
  const reason = str(input.reason).slice(0, 500);
  if (actor.verificationTier < 3 || (actor.staffPost !== 'principal' && actor.staffPost !== 'safeguarding_lead')) {
    throw new ActionError('FORBIDDEN', 'A tier 3 principal or safeguarding lead can widen this to all staff.');
  }
  const problem = widenProblem({
    staffPost: actor.staffPost,
    verificationTier: actor.verificationTier,
    type,
    location,
    reason,
  });
  if (problem) throw new ActionError('BAD_REQUEST', problem);
  if (!isAllStaffType(type)) throw new ActionError('BAD_REQUEST', 'Choose an all-staff alert type.');
  const source = str(input.source) === 'emergency' ? 'emergency' : 'case';
  const sourceId = str(input.sourceId);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sourceId)) throw new ActionError('BAD_REQUEST', 'Choose a case or an emergency.');
  const parent = sourceParent(source, sourceId);
  if (!parent) throw new ActionError('BAD_REQUEST', 'Choose a case or an emergency.');
  const sourceSnap = await db().doc(parent.path).get();
  if (!sourceSnap.exists) throw new ActionError('NOT_FOUND', 'Case not found.');
  const sourceData = sourceSnap.data() ?? {};
  if (str(sourceData.institutionId) !== actor.institutionId) {
    throw new ActionError('FORBIDDEN', 'You can widen a case at your own school.');
  }
  const sourceStatus = str(sourceData.status);
  if (source === 'emergency' && (sourceStatus === 'retracted' || sourceStatus === 'closed' || sourceStatus === 'resolved')) {
    throw new ActionError('BAD_REQUEST', 'This alert is already closed.');
  }
  if (source === 'case' && (sourceStatus === 'closed' || sourceStatus === 'solved')) {
    throw new ActionError('BAD_REQUEST', 'This case is already closed.');
  }
  const pointerRef = db().doc(`all_staff_open/${actor.institutionId}`);
  const open = await pointerRef.get();
  if (str(open.data()?.status) === 'open') {
    throw new ActionError('BAD_REQUEST', 'An all-staff alert is already open. Send the all-clear first.');
  }
  const directory = await peopleAtInstitution(actor.institutionId);
  const resolved = resolveRecipients({
    kind: 'all_staff',
    institutionId: actor.institutionId,
    people: directory,
  });
  const presets = await instructionMap(actor.institutionId);
  const snapshot: Record<InstructionLang, string> = {
    en: instructionText(type, presets[type], 'en'),
    ms: instructionText(type, presets[type], 'ms'),
    zh: instructionText(type, presets[type], 'zh'),
    ta: instructionText(type, presets[type], 'ta'),
  };
  const publicDescription = type === 'missing_child_on_site' ? str(input.publicDescription).slice(0, 240) : '';
  const now = Date.now();
  const alertRef = db().collection('all_staff_alerts').doc();
  const device = deviceOf(input);
  await db().runTransaction(async (tx) => {
    const current = await tx.get(pointerRef);
    if (str(current.data()?.status) === 'open') {
      throw new ActionError('BAD_REQUEST', 'An all-staff alert is already open. Send the all-clear first.');
    }
    tx.create(alertRef, {
      institutionId: actor.institutionId,
      source,
      sourceId,
      type,
      location,
      publicDescription,
      reason,
      instructions: snapshot,
      status: 'open',
      widenedBy: actor.id,
      widenedAt: now,
      clearedBy: '',
      clearedAt: 0,
      staffUids: resolved.staffUids,
      chainSeq: 0,
      chainHead: GENESIS,
      legalHold: emptyLegalHold(),
    });
    tx.set(pointerRef, {
      alertId: alertRef.id,
      institutionId: actor.institutionId,
      status: 'open',
      at: now,
    });
  });
  const after = { type, location, reason, alertId: alertRef.id, publicDescription };
  await appendChain({
    parentPath: parent.path,
    collection: parent.collection,
    actorUid: actor.id,
    actorRole: actor.role,
    action: 'widened_all_staff',
    diff: { before: {}, after },
    device,
  });
  await logAlert(alertRef.id, actor, 'widened_all_staff', { before: {}, after }, device);
  const title = ALL_STAFF_LABELS[type];
  for (const member of directory) {
    if (!resolved.staffUids.includes(member.uid)) continue;
    const instruction = snapshot[languageOf(member.language)];
    const body = `${location}. ${instruction} Open the app to check in.`;
    await pushEmergency(member.uid, title, body, '/dashboard/staff/roll-call');
  }
  return { id: alertRef.id, recipients: resolved.staffUids.length };
}

async function loadOpenAlert(institutionId: string) {
  const pointer = await db().doc(`all_staff_open/${institutionId}`).get();
  if (str(pointer.data()?.status) !== 'open') return null;
  const alertId = str(pointer.data()?.alertId);
  if (!alertId) return null;
  const snap = await db().doc(`all_staff_alerts/${alertId}`).get();
  if (!snap.exists) return null;
  return { id: snap.id, data: snap.data() ?? {} };
}

function viewFor(id: string, data: FirebaseFirestore.DocumentData, language: string, checkIn: 'safe' | 'need_help' | 'no_response') {
  const type = str(data.type);
  const safeType: AllStaffType = isAllStaffType(type) ? type : 'lockdown';
  const instructions = data.instructions && typeof data.instructions === 'object'
    ? data.instructions as Partial<Record<InstructionLang, string>>
    : undefined;
  return staffAlertView({
    id,
    type: safeType,
    location: str(data.location),
    instruction: instructionText(safeType, instructions, language),
    status: str(data.status) === 'cleared' ? 'cleared' : 'open',
    publicDescription: str(data.publicDescription),
    checkIn,
    childName: str(data.childName) || str(data.subjectName),
    body: str(data.body) || str(data.description) || str(data.reason),
    studentId: str(data.studentId),
  });
}

export async function allStaffBanner(uid: string) {
  const actor = await loadActor(uid);
  if (!isStaff(actor) || !actor.institutionId) return { alert: null };
  const open = await loadOpenAlert(actor.institutionId);
  if (!open || str(open.data.status) !== 'open') return { alert: null };
  const checkin = await db().doc(`all_staff_alerts/${open.id}/checkins/${actor.id}`).get();
  const status = str(checkin.data()?.status);
  const checkIn = status === 'safe' || status === 'need_help' ? status : 'no_response';
  return {
    alert: viewFor(open.id, open.data, actor.language, checkIn),
    canWiden: false,
  };
}

export async function checkInAllStaff(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!isStaff(actor)) throw new ActionError('FORBIDDEN', 'Staff check in on an all-staff alert.');
  const id = str(input.id);
  const choice = str(input.status);
  const snap = await db().doc(`all_staff_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const data = snap.data() ?? {};
  if (str(data.institutionId) !== actor.institutionId) throw new ActionError('FORBIDDEN', 'This alert is for another school.');
  const problem = checkInProblem(str(data.status), choice);
  if (problem) throw new ActionError('BAD_REQUEST', problem);
  const staffUids = Array.isArray(data.staffUids) ? data.staffUids.filter((item): item is string => typeof item === 'string') : [];
  if (!staffUids.includes(actor.id)) throw new ActionError('FORBIDDEN', 'This alert is for staff at the school.');
  const previous = await db().doc(`all_staff_alerts/${id}/checkins/${actor.id}`).get();
  const wasHelp = str(previous.data()?.status) === 'need_help';
  await previous.ref.set({ uid: actor.id, status: choice, at: Date.now() });
  if (choice === 'need_help' && !wasHelp) {
    const directory = await peopleAtInstitution(actor.institutionId);
    const principals = directory.filter(person => person.staffPost === 'principal');
    const type = str(data.type);
    const label = isAllStaffType(type) ? ALL_STAFF_LABELS[type] : 'All-staff alert';
    for (const principal of principals) {
      await pushEmergency(
        principal.uid,
        'Staff needs help',
        `${label} at ${str(data.location)}. Open the roll-call.`,
        '/dashboard/staff/roll-call',
      );
    }
  }
  return { ok: true, status: choice };
}

export async function clearAllStaff(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (actor.verificationTier < 3 || (actor.staffPost !== 'principal' && actor.staffPost !== 'safeguarding_lead')) {
    throw new ActionError('FORBIDDEN', 'A tier 3 principal or safeguarding lead sends the all-clear.');
  }
  const id = str(input.id);
  const snap = await db().doc(`all_staff_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const data = snap.data() ?? {};
  if (str(data.institutionId) !== actor.institutionId) throw new ActionError('FORBIDDEN', 'This alert is for another school.');
  if (str(data.status) !== 'open') throw new ActionError('BAD_REQUEST', 'Roll-call is closed.');
  const now = Date.now();
  const device = deviceOf(input);
  await snap.ref.set({ status: 'cleared', clearedBy: actor.id, clearedAt: now }, { merge: true });
  await db().doc(`all_staff_open/${actor.institutionId}`).set({
    alertId: id,
    institutionId: actor.institutionId,
    status: 'cleared',
    at: now,
  }, { merge: true });
  const parent = sourceParent(str(data.source), str(data.sourceId));
  if (parent) {
    const sourceSnap = await db().doc(parent.path).get();
    if (sourceSnap.exists) {
      await appendChain({
        parentPath: parent.path,
        collection: parent.collection,
        actorUid: actor.id,
        actorRole: actor.role,
        action: 'all_clear',
        diff: { before: { status: 'open' }, after: { status: 'cleared', alertId: id } },
        device,
      });
    }
  }
  await logAlert(id, actor, 'all_clear', {
    before: { status: 'open' },
    after: { status: 'cleared' },
  }, device);
  const staffUids = Array.isArray(data.staffUids) ? data.staffUids.filter((item): item is string => typeof item === 'string') : [];
  for (const staffUid of staffUids) {
    await pushEmergency(staffUid, 'All clear', 'The all-staff alert is over. Roll-call is closed.', '/dashboard/staff/roll-call');
  }
  return { id, status: 'cleared' };
}

export async function allStaffRollCall(uid: string, alertId: string) {
  const actor = await loadActor(uid);
  if (!isStaff(actor)) throw new ActionError('FORBIDDEN', 'Staff can open the roll-call.');
  const id = alertId || str((await db().doc(`all_staff_open/${actor.institutionId}`).get()).data()?.alertId);
  if (!id) return { alert: null, counts: { safe: 0, needHelp: 0, noResponse: 0 }, needHelp: [] };
  const snap = await db().doc(`all_staff_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const data = snap.data() ?? {};
  if (str(data.institutionId) !== actor.institutionId && actor.role !== 'admin') {
    throw new ActionError('FORBIDDEN', 'This roll-call is for another school.');
  }
  const staffUids = Array.isArray(data.staffUids) ? data.staffUids.filter((item): item is string => typeof item === 'string') : [];
  const checkins = await db().collection(`all_staff_alerts/${id}/checkins`).limit(200).get();
  const rows: { uid: string; status: 'safe' | 'need_help' }[] = [];
  for (const doc of checkins.docs) {
    const status = str(doc.data().status);
    if (status === 'safe' || status === 'need_help') rows.push({ uid: doc.id, status });
  }
  const counts = rollCallCounts(staffUids, rows);
  const mine = rows.find(row => row.uid === actor.id);
  const lead = actor.staffPost === 'principal' || actor.staffPost === 'safeguarding_lead' || actor.role === 'admin';
  let needHelp: { uid: string; name: string }[] = [];
  if (lead) {
    const directory = await peopleAtInstitution(str(data.institutionId));
    const names = new Map(directory.map(person => [person.uid, person.name || 'Staff']));
    needHelp = rows.filter(row => row.status === 'need_help').map(row => ({ uid: row.uid, name: names.get(row.uid) || 'Staff' }));
  }
  return {
    alert: viewFor(id, data, actor.language, mine?.status ?? 'no_response'),
    counts,
    needHelp,
    canClear: actor.verificationTier >= 3 && (actor.staffPost === 'principal' || actor.staffPost === 'safeguarding_lead'),
  };
}

export async function saveAllStaffInstructions(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (actor.verificationTier < 3 || (actor.staffPost !== 'principal' && actor.staffPost !== 'safeguarding_lead')) {
    throw new ActionError('FORBIDDEN', 'A tier 3 principal or safeguarding lead edits these instructions.');
  }
  const type = str(input.type);
  if (!isAllStaffType(type)) throw new ActionError('BAD_REQUEST', 'Choose an all-staff alert type.');
  const texts: Record<InstructionLang, string> = {
    en: cleanInstruction(input.en),
    ms: cleanInstruction(input.ms),
    zh: cleanInstruction(input.zh),
    ta: cleanInstruction(input.ta),
  };
  await db().doc(`all_staff_instructions/${actor.institutionId}`).set({
    types: { [type]: texts },
    updatedBy: actor.id,
    updatedAt: Date.now(),
  }, { merge: true });
  return { type, instructions: texts };
}

export async function readAllStaffInstructions(uid: string) {
  const actor = await loadActor(uid);
  if (!isStaff(actor)) throw new ActionError('FORBIDDEN', 'Staff can read the all-staff instructions.');
  const custom = await instructionMap(actor.institutionId);
  const types = ALL_STAFF_TYPES.map(type => ({
    type,
    label: ALL_STAFF_LABELS[type],
    en: instructionText(type, custom[type], 'en'),
    ms: instructionText(type, custom[type], 'ms'),
    zh: instructionText(type, custom[type], 'zh'),
    ta: instructionText(type, custom[type], 'ta'),
    preset: {
      en: defaultInstruction(type, 'en'),
      ms: defaultInstruction(type, 'ms'),
      zh: defaultInstruction(type, 'zh'),
      ta: defaultInstruction(type, 'ta'),
    },
  }));
  return { types };
}

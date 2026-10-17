import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { seedInstitutionCatalogue, type ProgrammeGrant } from '../institution-catalogue';
import {
  claimMessage,
  claimRosterRow,
  claimTokenFor,
  decideJoin,
  joinReport,
  linkChild,
  offboard,
  overlapCredit,
  parseJoinRoster,
  programmesForLevel,
  readJoinConfig,
  rollRoster,
  bulkMove,
  welcomeJoinMessage,
  type ClassCode,
  type JoinAttempt,
  type JoinConfig,
  type JoinDecision,
  type ParentLink,
  type RosterEntry,
  type SeatPool,
} from '../institution-join';
import { beginAlumni, releaseAlumniSeat } from './alumni-store';
import { loadAutomation, logAutomation } from './automation-store';
import { sendInstitutionMail } from './institution-mail';
import { syncWelcome } from './onboarding-store';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function rosterId(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, '_');
}

function entryFrom(data: Record<string, unknown> | undefined): RosterEntry | null {
  if (!data) return null;
  const email = text(data.email).toLowerCase();
  if (!email) return null;
  const role = data.role === 'parent' || data.role === 'teacher' ? data.role : 'student';
  const status = data.status === 'pending' || data.status === 'joined' || data.status === 'waiting' || data.status === 'leaver'
    ? data.status
    : 'unclaimed';
  return {
    email,
    name: text(data.name) || email,
    role,
    studentId: text(data.studentId),
    dob: text(data.dob),
    level: text(data.level),
    className: text(data.className),
    phone: text(data.phone),
    childStudentId: text(data.childStudentId),
    programmeId: text(data.programmeId),
    claimToken: text(data.claimToken),
    status,
    graceEndsOn: DATE.test(text(data.graceEndsOn)) ? text(data.graceEndsOn) : '',
  };
}

function grantsFrom(value: unknown): ProgrammeGrant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const grant = row as Partial<ProgrammeGrant>;
    const itemId = text(grant.itemId).trim();
    if (!itemId) return [];
    return [{
      itemId,
      studentIds: Array.isArray(grant.studentIds) ? grant.studentIds.filter((id): id is string => typeof id === 'string') : [],
      levels: Array.isArray(grant.levels) ? grant.levels.filter((level): level is string => typeof level === 'string') : [],
    }];
  });
}

export async function findInstitutionBySlug(slug: string): Promise<{ id: string; name: string; slug: string } | null> {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return null;
  const snap = await adminDb().collection('institutions').where('subdomain', '==', wanted).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return { id: doc.id, name: text(doc.get('name')) || 'Academy', slug: wanted };
}

export async function loadJoinConfig(institutionId: string): Promise<JoinConfig> {
  const snap = await adminDb().doc(`institutions/${institutionId}/settings/join`).get();
  return readJoinConfig(snap.data());
}

async function rosterHits(institutionId: string, attempt: JoinAttempt): Promise<RosterEntry[]> {
  const col = adminDb().collection(`institutions/${institutionId}/joinRoster`);
  const email = attempt.email.trim().toLowerCase();
  const snaps = await Promise.all([
    email ? col.where('email', '==', email).limit(1).get() : Promise.resolve(null),
    attempt.studentId.trim() ? col.where('studentId', '==', attempt.studentId.trim()).limit(1).get() : Promise.resolve(null),
    DATE.test(attempt.dob) ? col.where('dob', '==', attempt.dob).limit(20).get() : Promise.resolve(null),
  ]);
  const rows: RosterEntry[] = [];
  for (const snap of snaps) {
    snap?.docs.forEach((doc) => {
      const row = entryFrom(doc.data());
      if (row && !rows.some((item) => item.email === row.email)) rows.push(row);
    });
  }
  return rows;
}

async function seatPool(institutionId: string, level: string, programmeId: string, overage: SeatPool['overage'], seatsOn: boolean): Promise<SeatPool | null> {
  const bill = await adminDb().doc(`institutions/${institutionId}/billing/current`).get();
  const purchased = typeof bill.get('seats') === 'number' ? Math.floor(bill.get('seats')) : 0;
  if (purchased < 1) return null;
  const today = todayIso();
  const [joined, leaving] = await Promise.all([
    adminDb().collection(`institutions/${institutionId}/joinRoster`).where('status', '==', 'joined').limit(500).get(),
    adminDb().collection(`institutions/${institutionId}/joinRoster`).where('status', '==', 'leaver').limit(500).get(),
  ]);
  const holdsSeat = (data: Record<string, unknown> | undefined) => {
    const row = entryFrom(data);
    if (!row || row.role !== 'student') return false;
    if (row.status === 'leaver' && (!row.graceEndsOn || today >= row.graceEndsOn)) return false;
    if (programmeId && row.programmeId === programmeId) return true;
    return Boolean(level) && row.level === level;
  };
  const used = [...joined.docs, ...leaving.docs].filter((doc) => holdsSeat(doc.data())).length;
  return { programmeId, level, purchased, used, overage: seatsOn ? overage : 'prompt' };
}

async function paidProgrammeIds(institutionId: string): Promise<string[]> {
  const access = await adminDb().doc(`institutions/${institutionId}/settings/access`).get();
  return Array.isArray(access.get('programmeIds'))
    ? access.get('programmeIds').filter((id: unknown): id is string => typeof id === 'string')
    : [];
}

function visibleProgrammes(level: string, paidIds: readonly string[]): { id: string; title: string }[] {
  return programmesForLevel(level, seedInstitutionCatalogue().items, paidIds);
}

async function assignLevel(institutionId: string, programmeId: string, level: string): Promise<void> {
  if (!programmeId || !level) return;
  const ref = adminDb().doc(`institutions/${institutionId}/settings/programme_access`);
  const snap = await ref.get();
  const grants = grantsFrom(snap.get('grants'));
  const found = grants.find((grant) => grant.itemId === programmeId);
  if (found) {
    if (!found.levels.some((item) => item.toLowerCase() === level.toLowerCase())) found.levels.push(level);
  } else {
    grants.push({ itemId: programmeId, studentIds: [], levels: [level] });
  }
  await ref.set({ grants }, { merge: true });
}

async function notify(institutionId: string, title: string, body: string): Promise<void> {
  await adminDb().collection(`institutions/${institutionId}/notifications`).add({
    kind: 'join',
    title,
    body,
    audience: 'admins',
    at: new Date().toISOString(),
  });
}

async function writeRoster(institutionId: string, row: RosterEntry): Promise<void> {
  await adminDb().doc(`institutions/${institutionId}/joinRoster/${rosterId(row.email)}`).set(row, { merge: true });
}

function personalPlan(data: Record<string, unknown> | undefined): { total: number; start: string; end: string } | null {
  const plan = data?.personalPlan;
  if (!plan || typeof plan !== 'object') return null;
  const row = plan as Record<string, unknown>;
  const total = typeof row.total === 'number' ? row.total : Number(row.total);
  const start = text(row.periodStart);
  const end = text(row.periodEnd);
  if (!Number.isFinite(total)) return null;
  return { total, start, end };
}

function linksFrom(value: unknown): ParentLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const link = row as Partial<ParentLink>;
    const studentNumber = text(link.studentNumber).trim();
    const institutionId = text(link.institutionId).trim();
    if (!studentNumber || !institutionId) return [];
    return [{ studentNumber, institutionId, name: text(link.name) }];
  });
}

export async function previewJoin(slug: string, attempt: JoinAttempt): Promise<{ decision: JoinDecision; programmes: { id: string; title: string }[]; institutionName: string } | { error: string }> {
  const academy = await findInstitutionBySlug(slug);
  if (!academy) return { error: 'This academy page is not set up yet.' };
  const [config, automation, roster, paid] = await Promise.all([
    loadJoinConfig(academy.id),
    loadAutomation(),
    rosterHits(academy.id, attempt),
    paidProgrammeIds(academy.id),
  ]);
  const seats = await seatPool(academy.id, attempt.level, attempt.programmeId, config.overage, automation.rules.institution_seats);
  const decision = decideJoin({
    policy: config.policy,
    attempt,
    roster,
    codes: config.codes,
    inviteCodes: config.inviteCodes,
    seats,
    automationOn: automation.rules.institution_join,
  });
  return { decision, programmes: visibleProgrammes(decision.level, paid), institutionName: academy.name };
}

export async function attachJoin(input: {
  uid: string;
  slug: string;
  attempt: JoinAttempt;
  childStudentNumber?: string;
  takeCredit?: boolean;
}): Promise<{ decision: JoinDecision; programmes: { id: string; title: string }[]; credit: number | null; message: string } | { error: string }> {
  const preview = await previewJoin(input.slug, input.attempt);
  if ('error' in preview) return preview;
  const academy = await findInstitutionBySlug(input.slug);
  if (!academy) return { error: 'This academy page is not set up yet.' };
  const userRef = adminDb().doc(`users/${input.uid}`);
  const userSnap = await userRef.get();
  const user = userSnap.data() ?? {};
  const decision = preview.decision;
  let credit: number | null = null;
  if (decision.status === 'approved' && input.attempt.role === 'student' && input.takeCredit !== false) {
    const plan = personalPlan(user);
    if (plan) {
      const quoted = overlapCredit({ personalTotal: plan.total, periodStart: plan.start, periodEnd: plan.end, on: todayIso() });
      if (!('error' in quoted) && quoted.credit > 0) {
        credit = quoted.credit;
        await userRef.set({ academyCredit: { amount: credit, currency: 'USD', status: 'offered', on: todayIso() } }, { merge: true });
      }
    }
  }
  const rosterStatus = decision.status === 'approved' ? 'joined' : decision.status === 'waiting_for_seat' ? 'waiting' : decision.status === 'rejected' ? 'unclaimed' : 'pending';
  const existing = (await rosterHits(academy.id, input.attempt))[0];
  const row: RosterEntry = {
    email: input.attempt.email.trim().toLowerCase(),
    name: input.attempt.name || text(user.name) || input.attempt.email,
    role: input.attempt.role,
    studentId: input.attempt.studentId || existing?.studentId || '',
    dob: input.attempt.dob || existing?.dob || '',
    level: decision.level || existing?.level || input.attempt.level,
    className: decision.className || existing?.className || '',
    phone: existing?.phone || '',
    childStudentId: input.attempt.role === 'parent' ? (input.childStudentNumber || existing?.childStudentId || '') : '',
    programmeId: decision.programmeId || existing?.programmeId || input.attempt.programmeId,
    claimToken: existing?.claimToken || claimTokenFor(academy.id, input.attempt.email),
    status: rosterStatus,
  };
  await adminDb().doc(`institutions/${academy.id}/joinRoster/${rosterId(row.email)}`).set({ ...row, uid: input.uid }, { merge: true });
  if (decision.status === 'approved') {
    const patch: Record<string, unknown> = { institutionId: academy.id, institutionAccess: 'active' };
    if (input.attempt.role === 'student' && decision.level) patch.academyLevel = decision.level;
    if (!text(user.role)) patch.role = input.attempt.role;
    if (input.attempt.role === 'parent') {
      const current = linksFrom(user.parentLinks);
      const childNumber = (input.childStudentNumber || row.childStudentId).trim();
      if (childNumber) {
        const linked = linkChild(current, { studentNumber: childNumber, institutionId: academy.id, name: '' });
        if (!('error' in linked)) patch.parentLinks = linked;
        const child = await adminDb().collection('users').where('studentNumber', '==', childNumber.toUpperCase()).limit(1).get();
        const childId = child.docs[0]?.id;
        if (childId) patch.childIds = FieldValue.arrayUnion(childId);
      }
    }
    const previousAcademy = text(user.alumniOf);
    if (previousAcademy && previousAcademy !== academy.id) await releaseAlumniSeat(previousAcademy, input.uid, todayIso());
    await userRef.set(patch, { merge: true });
    if (decision.seat === 'auto_add') {
      const bill = adminDb().doc(`institutions/${academy.id}/billing/current`);
      const snap = await bill.get();
      const seats = typeof snap.get('seats') === 'number' ? Math.floor(snap.get('seats')) : 0;
      await bill.set({ seats: seats + 1 }, { merge: true });
      await notify(academy.id, 'A seat was added', decision.message);
    }
    if (input.attempt.role === 'student') await assignLevel(academy.id, row.programmeId, row.level);
    if (decision.enrolWelcome) {
      await syncWelcome(input.uid, {
        role: text(user.role) || input.attempt.role,
        roles: Array.isArray(user.roles) ? user.roles.filter((item): item is string => typeof item === 'string') : [],
        institutionId: academy.id,
        mode: '',
        studentNumber: user.studentNumber,
        childIds: user.childIds,
      });
      const mail = welcomeJoinMessage({ institutionName: academy.name, name: row.name, level: row.level });
      await sendInstitutionMail(row.email, mail);
    }
    await logAutomation({ rule: 'institution_join', outcome: 'auto', summary: decision.message, actorId: input.uid, refId: academy.id });
  } else if (decision.status === 'pending' || decision.status === 'waiting_for_seat') {
    await adminDb().doc(`institutions/${academy.id}/join_requests/${input.uid}`).set({
      userId: input.uid,
      institutionId: academy.id,
      role: input.attempt.role,
      name: row.name,
      email: row.email,
      status: 'pending',
      level: '',
      academyLevel: row.level,
      classIds: [],
      courseIds: [],
      childEmails: [],
      createdAt: new Date().toISOString(),
    }, { merge: true });
    await notify(academy.id, decision.status === 'waiting_for_seat' ? 'A student is waiting for a seat' : 'A join request is waiting', decision.message);
    await logAutomation({
      rule: 'institution_join',
      outcome: decision.status === 'pending' && decision.method === 'manual' ? 'held' : 'auto',
      summary: decision.message,
      actorId: input.uid,
      refId: academy.id,
    });
  }
  const creditLine = credit != null ? ` A credit of ${credit.toFixed(2)} is offered for the unused days on the personal plan.` : '';
  const progress = decision.status === 'approved' ? ' Progress stays with this account.' : '';
  return { ...preview, credit, message: `${decision.message}${progress}${creditLine}` };
}

export async function leaveInstitution(uid: string): Promise<{ progressKept: true; institutionAccess: 'grace'; graceEndsOn: string } | { error: string }> {
  const snap = await adminDb().doc(`users/${uid}`).get();
  const institutionId = text(snap.get('institutionId')) || text(snap.get('alumniOf'));
  if (!institutionId || text(snap.get('institutionAccess')) === 'ended') return { error: 'This account is already an individual.' };
  const person = await beginAlumni({
    institutionId,
    studentId: uid,
    schoolStudentId: '',
    name: text(snap.get('name')),
    email: text(snap.get('email')).toLowerCase(),
    studentNumber: text(snap.get('studentNumber')),
    level: text(snap.get('academyLevel')),
    reason: 'marked',
    today: todayIso(),
  });
  return { progressKept: true, institutionAccess: 'grace', graceEndsOn: person.graceEndsOn };
}

export async function linkParentChild(uid: string, studentNumber: string, institutionId: string, name: string): Promise<ParentLink[] | { error: string }> {
  const userRef = adminDb().doc(`users/${uid}`);
  const snap = await userRef.get();
  const linked = linkChild(linksFrom(snap.get('parentLinks')), { studentNumber, institutionId, name });
  if ('error' in linked) return linked;
  const child = await adminDb().collection('users').where('studentNumber', '==', studentNumber.trim().toUpperCase()).limit(1).get();
  await userRef.set({
    parentLinks: linked,
    ...(child.docs[0] ? { childIds: FieldValue.arrayUnion(child.docs[0].id) } : {}),
  }, { merge: true });
  return linked;
}

export async function saveJoinSettings(institutionId: string, config: JoinConfig, actorId: string): Promise<JoinConfig> {
  const saved = readJoinConfig(config);
  await adminDb().doc(`institutions/${institutionId}/settings/join`).set(saved);
  await logAutomation({ rule: 'institution_join', outcome: 'auto', summary: 'Join rules saved.', actorId, refId: institutionId });
  return saved;
}

export async function uploadJoinRoster(institutionId: string, csv: string, origin: string, slug: string, institutionName: string): Promise<{ rows: RosterEntry[]; errors: string[]; claims: { email: string; sms: string; emailed: boolean }[] }> {
  const parsed = parseJoinRoster(csv, institutionId);
  const claims: { email: string; sms: string; emailed: boolean }[] = [];
  for (const row of parsed.rows.slice(0, 200)) {
    await writeRoster(institutionId, row);
    const claimUrl = `${origin}/i/${slug}/join?claim=${row.claimToken}`;
    const message = claimMessage({ institutionName, name: row.name, claimUrl });
    const sent = await sendInstitutionMail(row.email, { subject: message.subject, text: message.text });
    claims.push({ email: row.email, sms: message.sms, emailed: sent.emailed });
  }
  return { rows: parsed.rows.slice(0, 200), errors: parsed.errors, claims };
}

export async function claimJoin(slug: string, token: string, origin: string): Promise<{ subject: string; text: string; sms: string; emailed: boolean } | { error: string }> {
  const academy = await findInstitutionBySlug(slug);
  if (!academy) return { error: 'This academy page is not set up yet.' };
  const snap = await adminDb().collection(`institutions/${academy.id}/joinRoster`).where('claimToken', '==', token.trim().toLowerCase()).limit(1).get();
  const row = entryFrom(snap.docs[0]?.data());
  if (!row) return { error: 'That claim link does not match this academy.' };
  const claimed = claimRosterRow([row], token);
  if ('error' in claimed) return claimed;
  await adminDb().doc(`institutions/${academy.id}/joinRoster/${rosterId(row.email)}`).set({ status: claimed.status }, { merge: true });
  const claimUrl = `${origin}/i/${slug}/join?claim=${row.claimToken}`;
  const message = claimMessage({ institutionName: academy.name, name: row.name, claimUrl });
  const sent = await sendInstitutionMail(row.email, { subject: message.subject, text: message.text });
  return { ...message, emailed: sent.emailed };
}

async function allRoster(institutionId: string): Promise<RosterEntry[]> {
  const snap = await adminDb().collection(`institutions/${institutionId}/joinRoster`).limit(500).get();
  return snap.docs.flatMap((doc) => {
    const row = entryFrom(doc.data());
    return row ? [row] : [];
  });
}

export async function joinAdminReport(institutionId: string): Promise<{ rows: RosterEntry[]; report: ReturnType<typeof joinReport>; config: JoinConfig }> {
  const [rows, config] = await Promise.all([allRoster(institutionId), loadJoinConfig(institutionId)]);
  return { rows, report: joinReport(rows), config };
}

export async function rolloverJoin(institutionId: string, actorId: string): Promise<{ report: ReturnType<typeof joinReport>; moved: number }> {
  const rows = await allRoster(institutionId);
  const rolled = rollRoster(rows);
  for (const row of rolled.rows) await writeRoster(institutionId, row);
  for (const leaver of rolled.leavers) {
    const snap = await adminDb().collection('users').where('email', '==', leaver.email).limit(1).get();
    const uid = snap.docs[0]?.id ?? '';
    if (uid && snap.docs[0]?.get('institutionId') && snap.docs[0]?.get('institutionId') !== institutionId) continue;
    await beginAlumni({
      institutionId,
      studentId: uid,
      schoolStudentId: leaver.studentId,
      name: leaver.name,
      email: leaver.email,
      studentNumber: text(snap.docs[0]?.get('studentNumber')),
      level: 'Graduated',
      reason: 'final_level',
      today: todayIso(),
    });
  }
  await logAutomation({ rule: 'institution_join', outcome: 'auto', summary: `Moved ${rolled.rows.length} roster rows to the next level name.`, actorId, refId: institutionId });
  return { report: joinReport(rolled.rows), moved: rolled.rows.length };
}

export async function bulkMoveJoin(institutionId: string, studentIds: readonly string[], level: string, className: string): Promise<RosterEntry[]> {
  const rows = bulkMove(await allRoster(institutionId), studentIds, level, className);
  for (const row of rows) {
    if (!studentIds.some((id) => id.trim().toLowerCase() === row.studentId.toLowerCase() || id.trim().toLowerCase() === row.email)) continue;
    await writeRoster(institutionId, row);
    const snap = await adminDb().collection('users').where('email', '==', row.email).limit(1).get();
    const uid = snap.docs[0]?.id;
    if (uid) await adminDb().doc(`users/${uid}`).set({ academyLevel: level }, { merge: true });
    if (row.programmeId) await assignLevel(institutionId, row.programmeId, level);
  }
  return rows;
}

export async function offboardJoin(institutionId: string, studentIds: readonly string[]): Promise<RosterEntry[]> {
  const rows = offboard(await allRoster(institutionId), studentIds);
  for (const row of rows) {
    if (row.status !== 'leaver') continue;
    if (!studentIds.some((id) => id.trim().toLowerCase() === row.studentId.toLowerCase() || id.trim().toLowerCase() === row.email)) continue;
    await writeRoster(institutionId, row);
    const snap = await adminDb().collection('users').where('email', '==', row.email).limit(1).get();
    const uid = snap.docs[0]?.id ?? '';
    if (uid && snap.docs[0]?.get('institutionId') && snap.docs[0]?.get('institutionId') !== institutionId) continue;
    await beginAlumni({
      institutionId,
      studentId: uid,
      schoolStudentId: row.studentId,
      name: row.name,
      email: row.email,
      studentNumber: text(snap.docs[0]?.get('studentNumber')),
      level: row.level,
      reason: 'marked',
      today: todayIso(),
    });
  }
  return rows;
}

export type { ClassCode };

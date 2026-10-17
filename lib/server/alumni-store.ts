import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import {
  defaultAlumniPolicy,
  dueToLeave,
  holderDeletion,
  graduationOutcome,
  openAlumni,
  publicAlumniView,
  readAlumniPolicy,
  type AlumniPerson,
  type AlumniPolicy,
  type LeaveReason,
  type PublicAlumniView,
} from '../alumni';
import { certificateStudentNumber } from '../certificates';
import {
  achievementLines,
  alumniUpgradeUrl,
  canUndoGraduation,
  graduationLetter,
  graduationSuggestions,
  previewGraduationBill,
  undoUntil,
  type GraduationBillPreview,
  type GraduationCandidate,
  type ReadyGraduate,
} from '../graduation';
import { adminDb } from '../firebase-admin';
import { blankSubscription, periodStartFor, readSubscription } from '../institution-membership';
import { loadAutomation, logAutomation } from './automation-store';
import { countInstitutionStudents, loadInstitutionCatalogue } from './institution-catalogue';
import { sendInstitutionMail } from './institution-mail';
import { reviewInstitutionTier } from './institution-tier';
import { rememberAttendance } from './alumni-network-store';
import { closeEducationSpan, unpublishLearnerRecord } from './learner-record-store';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function personFrom(id: string, data: Record<string, unknown> | undefined): AlumniPerson | null {
  if (!data) return null;
  const institutionId = text(data.institutionId);
  if (!institutionId) return null;
  return {
    id,
    studentId: text(data.studentId),
    schoolStudentId: text(data.schoolStudentId),
    name: text(data.name),
    studentNumber: text(data.studentNumber),
    email: text(data.email).toLowerCase(),
    institutionId,
    institutionName: text(data.institutionName),
    level: text(data.level),
    leftOn: text(data.leftOn),
    graceEndsOn: text(data.graceEndsOn),
    reason: data.reason === 'final_level' || data.reason === 'end_date' ? data.reason : 'marked',
    certificates: typeof data.certificates === 'number' ? data.certificates : 0,
    seatFreed: data.seatFreed === true,
    claimedIndividual: data.claimedIndividual === true,
    publicProfile: data.publicProfile === true,
    undoUntil: text(data.undoUntil),
    undoneOn: text(data.undoneOn),
  };
}

export async function loadAlumniPolicy(institutionId: string): Promise<AlumniPolicy> {
  const snap = await adminDb().doc(`institutions/${institutionId}/settings/alumni`).get();
  return readAlumniPolicy(snap.data());
}

export async function saveAlumniPolicy(institutionId: string, policy: AlumniPolicy, actorId: string): Promise<AlumniPolicy> {
  const saved = readAlumniPolicy({ ...policy, placeholder: false });
  await adminDb().doc(`institutions/${institutionId}/settings/alumni`).set(saved);
  await logAutomation({ rule: 'alumni_rollover', outcome: 'auto', summary: 'Alumni settings saved.', actorId, refId: institutionId });
  return saved;
}

async function certificateCount(studentId: string): Promise<{ count: number; titles: string[] }> {
  if (!studentId) return { count: 0, titles: [] };
  const snap = await adminDb().collection('certificates').where('studentId', '==', studentId).limit(100).get();
  const titles = snap.docs
    .filter((doc) => doc.get('status') !== 'revoked')
    .map((doc) => text(doc.get('courseTitle')) || text(doc.get('moduleTitle')))
    .filter(Boolean);
  return { count: titles.length, titles };
}

async function badgeCount(studentId: string): Promise<number> {
  if (!studentId) return 0;
  const snap = await adminDb().collection('badges').where('userId', '==', studentId).limit(100).get();
  return snap.size;
}

export async function listAlumni(institutionId: string): Promise<AlumniPerson[]> {
  const snap = await adminDb().collection(`institutions/${institutionId}/alumni`).limit(500).get();
  return snap.docs.flatMap((doc) => {
    const person = personFrom(doc.id, doc.data());
    return person ? [person] : [];
  });
}

/** Moves this academy's courses onto the Completed shelf. Progress already at 100 stays. */
async function completeInstitutionCourses(studentId: string, institutionId: string): Promise<void> {
  if (!studentId) return;
  const courses = await adminDb().collection('courses').where('institutionId', '==', institutionId).limit(200).get();
  for (const course of courses.docs) {
    const enrollment = await course.ref.collection('enrollments').doc(studentId).get();
    if (!enrollment.exists) continue;
    const progress = typeof enrollment.get('progress') === 'number' ? enrollment.get('progress') : 0;
    if (progress >= 100) continue;
    const before = enrollment.get('progressBeforeShelf');
    await enrollment.ref.set({
      progress: 100,
      shelf: 'completed',
      studentId,
      ...(typeof before === 'number' ? {} : { progressBeforeShelf: progress }),
    }, { merge: true });
  }
}

async function dropUsedLicence(institutionId: string): Promise<void> {
  const profileRef = adminDb().doc(`institutions/${institutionId}/settings/profile`);
  const profile = await profileRef.get();
  const used = profile.get('seatsUsed');
  if (typeof used === 'number' && used >= 1) {
    await profileRef.set({ seatsUsed: Math.floor(used) - 1 }, { merge: true });
  }
}

async function raiseUsedLicence(institutionId: string): Promise<void> {
  const profileRef = adminDb().doc(`institutions/${institutionId}/settings/profile`);
  const profile = await profileRef.get();
  const used = profile.get('seatsUsed');
  if (typeof used === 'number' && used >= 0) {
    await profileRef.set({ seatsUsed: Math.floor(used) + 1 }, { merge: true });
  }
}

function rosterKey(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, '_');
}

/** Frees the occupied seat, keeps the record, and makes the account individual. */
async function settleGraduate(input: {
  institutionId: string;
  studentId: string;
  email: string;
  person: AlumniPerson;
  today: string;
  discount: number;
}): Promise<boolean> {
  const { institutionId, person } = input;
  const reviewOpen = person.graceEndsOn > input.today;
  await adminDb().doc(`institutions/${institutionId}/alumni/${person.id}`).set({
    seatFreed: true,
    freedOn: input.today,
    undoUntil: undoUntil(person.leftOn || input.today),
    undoneOn: FieldValue.delete(),
  }, { merge: true });
  let className = '';
  if (input.email) {
    const rosterRef = adminDb().doc(`institutions/${institutionId}/joinRoster/${rosterKey(input.email)}`);
    const roster = await rosterRef.get();
    const liveClass = text(roster.get('className'));
    const savedClass = text(roster.get('classNameBefore'));
    className = savedClass || liveClass;
    await rosterRef.set({
      status: 'leaver',
      className: '',
      graceEndsOn: FieldValue.delete(),
      ...(savedClass || !liveClass ? {} : { classNameBefore: liveClass }),
    }, { merge: true });
  }
  if (!input.studentId) return false;
  await completeInstitutionCourses(input.studentId, institutionId);
  await closeEducationSpan(input.studentId, institutionId, input.today, {
    institutionName: person.institutionName,
    level: person.level,
    studentNumber: person.studentNumber,
  });
  await adminDb().doc(`badges/${input.studentId}_graduate`).set({
    userId: input.studentId,
    type: 'graduate',
    name: 'Graduate',
    institutionId,
    awardedAt: input.today,
  }, { merge: true });
  const userRef = adminDb().doc(`users/${input.studentId}`);
  const user = await userRef.get();
  await rememberAttendance({
    institutionId,
    studentId: input.studentId,
    institutionName: person.institutionName,
    level: person.level,
    className,
    programme: text(user.get('programme')),
    country: text(user.get('country')),
    leftOn: person.leftOn || input.today,
  });
  const currentInstitution = text(user.get('institutionId'));
  if (currentInstitution && currentInstitution !== institutionId) return false;
  const counted = currentInstitution === institutionId;
  await userRef.set({
    alumniOf: institutionId,
    alumniName: person.institutionName,
    alumniGraceEnds: person.graceEndsOn,
    alumniLeftOn: person.leftOn,
    alumniDiscount: input.discount,
    institutionAccess: reviewOpen ? 'grace' : 'ended',
    ...(counted || !currentInstitution ? { institutionId: FieldValue.delete() } : {}),
  }, { merge: true });
  if (!counted) return false;
  await dropUsedLicence(institutionId);
  await reviewInstitutionTier(institutionId, input.today);
  await adminDb().doc(`institutions/${institutionId}/alumni/${person.id}`).set({ seatCounted: true }, { merge: true });
  return true;
}

export async function beginAlumni(input: {
  institutionId: string;
  studentId: string;
  schoolStudentId: string;
  name: string;
  email: string;
  studentNumber: string;
  level: string;
  reason: LeaveReason;
  today: string;
}): Promise<AlumniPerson> {
  const institutionId = input.institutionId;
  const [policy, academy, existing] = await Promise.all([
    loadAlumniPolicy(institutionId),
    adminDb().doc(`institutions/${institutionId}`).get(),
    input.studentId ? adminDb().doc(`institutions/${institutionId}/alumni/${input.studentId}`).get() : Promise.resolve(null),
  ]);
  const prior = existing?.exists ? personFrom(existing.id, existing.data()) : null;
  if (prior?.claimedIndividual) {
    const current = input.studentId
      ? text((await adminDb().doc(`users/${input.studentId}`).get()).get('institutionId'))
      : '';
    if (current !== institutionId) return prior;
  }
  if (prior && !prior.undoneOn) {
    await settleGraduate({
      institutionId,
      studentId: input.studentId,
      email: input.email || prior.email,
      person: { ...prior, seatFreed: true },
      today: input.today,
      discount: policy.discount,
    });
    return { ...prior, seatFreed: true };
  }
  const certificates = await certificateCount(input.studentId);
  const person = openAlumni({
    policy,
    today: input.today,
    studentId: input.studentId,
    schoolStudentId: input.schoolStudentId,
    name: input.name,
    studentNumber: input.studentNumber,
    email: input.email,
    institutionId,
    institutionName: text(academy.get('name')) || 'Academy',
    level: input.level,
    reason: input.reason,
    certificates: certificates.count,
  });
  const docId = input.studentId || input.email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_').slice(0, 80);
  person.id = docId;
  await adminDb().doc(`institutions/${institutionId}/alumni/${docId}`).set({ ...person, freedOn: input.today });
  const outcome = graduationOutcome({
    today: input.today,
    graceDays: policy.graceDays,
    institutionId,
    courses: [],
  });
  const reviewed = await settleGraduate({
    institutionId,
    studentId: input.studentId,
    email: input.email,
    person,
    today: input.today,
    discount: policy.discount,
  });
  const upgradeUrl = alumniUpgradeUrl(person.level);
  const reviewOpen = outcome.institutionAccess === 'grace';
  if (input.studentId && input.email) {
    await sendInstitutionMail(input.email, graduationLetter({
      audience: 'student',
      institutionName: person.institutionName,
      studentName: person.name,
      discount: policy.discount,
      reviewOpen,
      graceEndsOn: person.graceEndsOn,
      upgradeUrl,
    }));
  }
  if (input.studentId) {
    const parents = await adminDb().collection('users').where('childIds', 'array-contains', input.studentId).limit(20).get();
    const parentLetter = graduationLetter({
      audience: 'parent',
      institutionName: person.institutionName,
      studentName: person.name,
      discount: policy.discount,
      reviewOpen,
      graceEndsOn: person.graceEndsOn,
      upgradeUrl,
    });
    for (const parent of parents.docs) {
      const email = text(parent.get('email')).toLowerCase();
      if (!email || email === input.email.toLowerCase()) continue;
      await sendInstitutionMail(email, parentLetter);
    }
  }
  const reviewLine = outcome.institutionAccess === 'grace'
    ? ` Course review stays until ${person.graceEndsOn}.`
    : ' Completed academy courses stay on their shelf.';
  await adminDb().collection(`institutions/${institutionId}/notifications`).add({
    kind: 'alumni',
    title: `${person.name} is now an alumnus`,
    body: `${person.name} is on an individual account. The seat is free.${reviewed ? ' Billing and the tier were reviewed.' : ''}${reviewLine}`,
    audience: 'admins',
    at: new Date().toISOString(),
  });
  await logAutomation({
    rule: 'alumni_rollover',
    outcome: 'auto',
    summary: `${person.name} is an alumnus of ${person.institutionName}. The seat is free and the account is individual. Letters explain what stays free and the alumni discount.`,
    actorId: input.studentId || 'system',
    refId: institutionId,
  });
  return person;
}

/** Stops counting the occupied seat. Tier review decides the paid seat count. */
export async function releaseAlumniSeat(institutionId: string, studentId: string, today: string): Promise<void> {
  const ref = adminDb().doc(`institutions/${institutionId}/alumni/${studentId}`);
  const snap = await ref.get();
  if (snap.get('claimedIndividual') === true) return;
  const person = personFrom(snap.id, snap.data());
  if (!person || person.seatFreed) return;
  await ref.set({ seatFreed: true, freedOn: today }, { merge: true });
  if (person.email) {
    await adminDb().doc(`institutions/${institutionId}/joinRoster/${rosterKey(person.email)}`).set({
      status: 'leaver',
      graceEndsOn: FieldValue.delete(),
    }, { merge: true });
  }
}

export async function closeAlumniAccess(uid: string, today: string): Promise<void> {
  const userRef = adminDb().doc(`users/${uid}`);
  const user = await userRef.get();
  const institutionId = text(user.get('alumniOf')) || text(user.get('institutionId'));
  const counted = Boolean(institutionId) && text(user.get('institutionId')) === institutionId;
  if (institutionId) await releaseAlumniSeat(institutionId, uid, today);
  await userRef.set({
    institutionId: FieldValue.delete(),
    institutionAccess: 'ended',
  }, { merge: true });
  if (counted && institutionId) {
    await dropUsedLicence(institutionId);
    await reviewInstitutionTier(institutionId, today);
  }
}

export async function releaseDueAlumni(today: string): Promise<number> {
  const academies = await adminDb().collection('institutions').limit(80).get();
  let freed = 0;
  for (const academy of academies.docs) {
    const policy = await loadAlumniPolicy(academy.id);
    const snap = await academy.ref.collection('alumni').where('seatFreed', '==', false).limit(100).get();
    for (const doc of snap.docs) {
      if (doc.get('claimedIndividual') === true) continue;
      const person = personFrom(doc.id, doc.data());
      if (!person || person.undoneOn) continue;
      await settleGraduate({
        institutionId: academy.id,
        studentId: person.studentId,
        email: person.email,
        person,
        today,
        discount: policy.discount,
      });
      freed += 1;
    }
  }
  return freed;
}

export async function sweepEndDates(today: string): Promise<number> {
  const automation = await loadAutomation();
  if (!automation.rules.alumni_rollover) return 0;
  const academies = await adminDb().collection('institutions').limit(80).get();
  let marked = 0;
  for (const academy of academies.docs) {
    const policy = readAlumniPolicy((await academy.ref.collection('settings').doc('alumni').get()).data());
    if (!policy.endDate || today < policy.endDate) continue;
    const roster = await academy.ref.collection('joinRoster').where('status', '==', 'joined').limit(200).get();
    for (const row of roster.docs) {
      const role = text(row.get('role')) || 'student';
      const decision = dueToLeave({
        role,
        status: 'joined',
        level: text(row.get('level')),
        endDate: policy.endDate,
        today,
        yearEnd: false,
      });
      if (!decision.leave) continue;
      const email = text(row.get('email')).toLowerCase();
      const user = email ? await adminDb().collection('users').where('email', '==', email).limit(1).get() : null;
      const uid = user?.docs[0]?.id ?? '';
      if (uid && user?.docs[0]?.get('institutionId') && user.docs[0]?.get('institutionId') !== academy.id) continue;
      await beginAlumni({
        institutionId: academy.id,
        studentId: uid,
        schoolStudentId: text(row.get('studentId')),
        name: text(row.get('name')) || text(user?.docs[0]?.get('name')),
        email,
        studentNumber: text(user?.docs[0]?.get('studentNumber')),
        level: text(row.get('level')),
        reason: 'end_date',
        today,
      });
      marked += 1;
    }
  }
  return marked;
}

export async function findCountBySlug(slug: string): Promise<{ alumni: number; name: string }> {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return { alumni: 0, name: '' };
  const snap = await adminDb().collection('institutions').where('subdomain', '==', wanted).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return { alumni: 0, name: '' };
  return { alumni: await alumniCount(doc.id), name: text(doc.get('name')) || 'Academy' };
}

export async function alumniCount(institutionId: string): Promise<number> {
  const snap = await adminDb().collection(`institutions/${institutionId}/alumni`).limit(500).get();
  return snap.size;
}

export async function setAlumniPublic(uid: string, optIn: boolean): Promise<PublicAlumniView | null> {
  const userRef = adminDb().doc(`users/${uid}`);
  const user = await userRef.get();
  const studentNumber = certificateStudentNumber(user.get('studentNumber'));
  if (!studentNumber) return null;
  const institutionId = text(user.get('alumniOf'));
  const certificates = await certificateCount(uid);
  const badges = await badgeCount(uid);
  const view = publicAlumniView({
    optIn,
    name: text(user.get('name')),
    studentNumber,
    institutionName: text(user.get('alumniName')) || 'Poket School',
    level: text(user.get('academyLevel')) || text(user.get('level')),
    certificates: certificates.titles,
    badges,
  });
  await userRef.set({ alumniPublic: optIn }, { merge: true });
  if (institutionId) {
    await adminDb().doc(`institutions/${institutionId}/alumni/${uid}`).set({ publicProfile: optIn }, { merge: true });
  }
  const ref = adminDb().doc(`alumni_public/${studentNumber}`);
  if (!view) {
    await ref.delete().catch(() => undefined);
    return null;
  }
  await ref.set(view);
  return view;
}

export async function readPublicAlumni(studentNumber: string): Promise<PublicAlumniView | null> {
  const number = certificateStudentNumber(studentNumber);
  if (!number) return null;
  const snap = await adminDb().doc(`alumni_public/${number}`).get();
  if (!snap.exists) return null;
  return publicAlumniView({
    optIn: true,
    name: text(snap.get('name')),
    studentNumber: number,
    institutionName: text(snap.get('institutionName')),
    level: text(snap.get('level')),
    certificates: Array.isArray(snap.get('certificates')) ? snap.get('certificates').filter((item: unknown): item is string => typeof item === 'string') : [],
    badges: typeof snap.get('badges') === 'number' ? snap.get('badges') : 0,
  });
}

export async function askSchool(uid: string, title: string): Promise<{ sent: boolean }> {
  const user = await adminDb().doc(`users/${uid}`).get();
  const institutionId = text(user.get('institutionId')) || text(user.get('alumniOf'));
  if (!institutionId) return { sent: false };
  const course = title.replace(/\s+/g, ' ').trim().slice(0, 120) || 'the next course';
  await adminDb().collection(`institutions/${institutionId}/notifications`).add({
    kind: 'alumni',
    title: 'A student asked for the next course',
    body: `${text(user.get('name')) || 'A student'} asked to enrol on ${course}.`,
    audience: 'admins',
    at: new Date().toISOString(),
  });
  return { sent: true };
}

export async function sendAlumniLetters(institutionId: string, note: string, actorId: string): Promise<number> {
  const policy = await loadAlumniPolicy(institutionId);
  if (!policy.newsletter) return 0;
  const { alumniNewsletter } = await import('../alumni');
  const people = await listAlumni(institutionId);
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  const message = alumniNewsletter({ institutionName: text(academy.get('name')) || 'Academy', note });
  let sent = 0;
  for (const person of people.slice(0, 100)) {
    if (!person.email) continue;
    const result = await sendInstitutionMail(person.email, message);
    if (result.emailed) sent += 1;
  }
  await logAutomation({ rule: 'alumni_rollover', outcome: 'auto', summary: `Alumni note prepared for ${people.length} people.`, actorId, refId: institutionId });
  return sent;
}

/** Frees the seat at the academy the learner is leaving for another one. Records stay. */
export async function transferFromAcademy(fromId: string, uid: string, email: string, today: string): Promise<void> {
  if (!fromId || !uid) return;
  const userRef = adminDb().doc(`users/${uid}`);
  const user = await userRef.get();
  if (text(user.get('institutionId')) !== fromId) return;
  const academy = await adminDb().doc(`institutions/${fromId}`).get();
  const academyName = text(academy.get('name')) || 'the academy';
  let className = '';
  if (email) {
    const rosterRef = adminDb().doc(`institutions/${fromId}/joinRoster/${rosterKey(email)}`);
    const roster = await rosterRef.get();
    const liveClass = text(roster.get('className'));
    const savedClass = text(roster.get('classNameBefore'));
    className = savedClass || liveClass;
    await rosterRef.set({
      status: 'leaver',
      className: '',
      graceEndsOn: FieldValue.delete(),
      ...(savedClass || !liveClass ? {} : { classNameBefore: liveClass }),
    }, { merge: true });
  }
  await userRef.set({
    institutionId: FieldValue.delete(),
    institutionAccess: 'ended',
  }, { merge: true });
  await dropUsedLicence(fromId);
  await reviewInstitutionTier(fromId, today);
  await closeEducationSpan(uid, fromId, today, {
    institutionName: academyName,
    level: text(user.get('academyLevel')),
    studentNumber: text(user.get('studentNumber')),
  });
  await rememberAttendance({
    institutionId: fromId,
    studentId: uid,
    institutionName: academyName,
    level: text(user.get('academyLevel')),
    className,
    programme: text(user.get('programme')),
    country: text(user.get('country')),
    leftOn: today,
  });
  await logAutomation({
    rule: 'learner_record',
    outcome: 'auto',
    summary: `The learner moved on from ${academyName}. The student number and earlier history stay on the account.`,
    actorId: uid,
    refId: fromId,
  });
}

/** Keeps the verify page. The status line says the holder asked for deletion. */
export async function honourHolderDeletion(uid: string): Promise<number> {
  await unpublishLearnerRecord(uid);
  const decision = holderDeletion();
  const snap = await adminDb().collection('certificates').where('studentId', '==', uid).limit(100).get();
  let updated = 0;
  for (const doc of snap.docs) {
    if (doc.get('revocationReason') === decision.reason) continue;
    await doc.ref.set({
      status: decision.status,
      revocationReason: decision.reason,
    }, { merge: true });
    updated += 1;
  }
  return updated;
}

async function rosterCandidates(institutionId: string): Promise<GraduationCandidate[]> {
  const roster = await adminDb().collection(`institutions/${institutionId}/joinRoster`).where('status', '==', 'joined').limit(200).get();
  const rows: GraduationCandidate[] = [];
  for (const row of roster.docs) {
    rows.push({
      role: text(row.get('role')) || 'student',
      status: 'joined',
      level: text(row.get('level')),
      studentId: '',
      schoolStudentId: text(row.get('studentId')),
      name: text(row.get('name')),
      email: text(row.get('email')).toLowerCase(),
      studentNumber: '',
    });
  }
  const ready = graduationSuggestions(rows);
  const people: GraduationCandidate[] = [];
  for (const row of ready) {
    const user = row.email
      ? await adminDb().collection('users').where('email', '==', row.email).limit(1).get()
      : null;
    const doc = user?.docs[0];
    people.push({
      ...row,
      studentId: doc?.id ?? '',
      name: row.name || text(doc?.get('name')),
      studentNumber: text(doc?.get('studentNumber')),
    });
  }
  return people;
}

function asReady(row: GraduationCandidate): ReadyGraduate {
  return {
    studentId: row.studentId,
    schoolStudentId: row.schoolStudentId,
    name: row.name,
    email: row.email,
    studentNumber: row.studentNumber,
    level: row.level,
  };
}

/** Once a day, note final-level students. Confirming still waits for an admin. */
export async function recordGraduationSuggestions(institutionId: string, today: string): Promise<{ count: number; people: ReadyGraduate[]; logged: boolean }> {
  const people = (await rosterCandidates(institutionId)).map(asReady);
  if (people.length === 0) return { count: 0, people, logged: false };
  const automation = await loadAutomation();
  if (!automation.rules.alumni_rollover) return { count: people.length, people, logged: false };
  const noticeRef = adminDb().doc(`institutions/${institutionId}/settings/graduation_notice`);
  const logged = await adminDb().runTransaction(async (tx) => {
    const notice = await tx.get(noticeRef);
    if (notice.get('on') === today) return false;
    tx.set(noticeRef, { on: today, count: people.length });
    return true;
  });
  if (!logged) return { count: people.length, people, logged: false };
  await logAutomation({
    rule: 'alumni_rollover',
    outcome: 'held',
    summary: `${people.length} students are at the final level. Confirm graduation to free ${people.length} seats.`,
    actorId: 'system',
    refId: institutionId,
  });
  return { count: people.length, people, logged: true };
}

export async function noteGraduationSuggestions(today: string): Promise<number> {
  const automation = await loadAutomation();
  if (!automation.rules.alumni_rollover) return 0;
  const academies = await adminDb().collection('institutions').limit(80).get();
  let noted = 0;
  for (const academy of academies.docs) {
    const result = await recordGraduationSuggestions(academy.id, today);
    if (result.logged) noted += result.count;
  }
  return noted;
}

export async function previewBulkGraduation(institutionId: string, today: string, people?: readonly ReadyGraduate[]): Promise<GraduationBillPreview & { people: ReadyGraduate[] }> {
  const ready = people && people.length > 0 ? [...people] : (await rosterCandidates(institutionId)).map(asReady);
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  const billing = await academy.ref.collection('billing').doc('current').get();
  const raw = (billing.data() ?? {}) as Record<string, unknown>;
  const state = readSubscription(raw, blankSubscription('institution', today));
  const programmeIds = Array.isArray(raw.programmeIds)
    ? raw.programmeIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  const students = await countInstitutionStudents(institutionId);
  const preview = previewGraduationBill({
    graduating: ready.length,
    currentStudents: students,
    currentSeats: state.seats,
    currentTotal: state.total,
    currentTierId: typeof raw.tierId === 'string' ? raw.tierId : '',
    itemIds: programmeIds,
    interval: state.interval === 'annual' ? 'annual' : 'monthly',
    country: text(academy.get('country')) || 'US',
    periodStart: periodStartFor(state.periodEnd, state.interval),
    periodEnd: state.periodEnd,
    today,
    billingActive: billing.exists && state.phase === 'active' && programmeIds.length > 0,
    catalogue: await loadInstitutionCatalogue(),
  });
  return { ...preview, people: ready };
}

export async function confirmGraduations(institutionId: string, people: readonly ReadyGraduate[], today: string, actorId: string): Promise<number> {
  let marked = 0;
  for (const person of people.slice(0, 100)) {
    if (!person.email && !person.studentId) continue;
    await beginAlumni({
      institutionId,
      studentId: person.studentId,
      schoolStudentId: person.schoolStudentId,
      name: person.name,
      email: person.email,
      studentNumber: person.studentNumber,
      level: person.level,
      reason: 'final_level',
      today,
    });
    marked += 1;
  }
  if (marked > 0) {
    await logAutomation({
      rule: 'alumni_rollover',
      outcome: 'auto',
      summary: `Confirmed graduation for ${marked}. Seats are free and the bill was reviewed.`,
      actorId,
      refId: institutionId,
    });
  }
  return marked;
}

async function restoreShelvedCourses(studentId: string, institutionId: string): Promise<void> {
  const courses = await adminDb().collection('courses').where('institutionId', '==', institutionId).limit(200).get();
  for (const course of courses.docs) {
    const enrollment = await course.ref.collection('enrollments').doc(studentId).get();
    if (!enrollment.exists) continue;
    const before = enrollment.get('progressBeforeShelf');
    if (typeof before !== 'number') continue;
    await enrollment.ref.set({
      progress: before,
      shelf: before >= 100 ? 'completed' : FieldValue.delete(),
      progressBeforeShelf: FieldValue.delete(),
    }, { merge: true });
  }
}

/** Restores the seat and academy access. Certificates, the student number, and other records stay. */
export async function undoGraduation(institutionId: string, alumniId: string, today: string, actorId: string): Promise<{ restored: true } | { error: string }> {
  const ref = adminDb().doc(`institutions/${institutionId}/alumni/${alumniId}`);
  const snap = await ref.get();
  const person = personFrom(snap.id, snap.data());
  if (!person) return { error: 'That alumni record was not found.' };
  if (!canUndoGraduation({ leftOn: person.leftOn, today, undoneOn: person.undoneOn, seatFreed: person.seatFreed })) {
    return { error: person.undoneOn ? 'This graduation is already undone.' : 'Undo is open for 7 days after graduation.' };
  }
  const studentId = person.studentId;
  if (studentId) {
    const userRef = adminDb().doc(`users/${studentId}`);
    const user = await userRef.get();
    const current = text(user.get('institutionId'));
    if (current && current !== institutionId) return { error: 'This student is with another academy.' };
    await userRef.set({
      institutionId,
      institutionAccess: 'active',
    }, { merge: true });
    await restoreShelvedCourses(studentId, institutionId);
    await adminDb().doc(`badges/${studentId}_graduate`).delete().catch(() => undefined);
  }
  if (person.email) {
    const rosterRef = adminDb().doc(`institutions/${institutionId}/joinRoster/${rosterKey(person.email)}`);
    const roster = await rosterRef.get();
    const className = text(roster.get('classNameBefore'));
    await rosterRef.set({
      status: 'joined',
      ...(className ? { className } : {}),
      classNameBefore: FieldValue.delete(),
    }, { merge: true });
  }
  const counted = snap.get('seatCounted') === true;
  await ref.set({ seatFreed: false, undoneOn: today, seatCounted: false }, { merge: true });
  if (counted) await raiseUsedLicence(institutionId);
  await reviewInstitutionTier(institutionId, today);
  await logAutomation({
    rule: 'alumni_rollover',
    outcome: 'override',
    summary: `${person.name} returned to ${person.institutionName || 'the academy'}. The seat and academy access are restored.`,
    actorId,
    refId: institutionId,
  });
  return { restored: true };
}

export async function achievementFor(uid: string): Promise<string[]> {
  const user = await adminDb().doc(`users/${uid}`).get();
  const institutionId = text(user.get('alumniOf'));
  const certificates = await certificateCount(uid);
  const courses: string[] = [];
  if (institutionId) {
    const snap = await adminDb().collection('courses').where('institutionId', '==', institutionId).limit(40).get();
    for (const course of snap.docs) {
      const enrollment = await course.ref.collection('enrollments').doc(uid).get();
      if (!enrollment.exists) continue;
      const progress = enrollment.get('progress');
      if (typeof progress === 'number' && progress >= 100) {
        courses.push(text(course.get('title')) || 'Completed course');
      }
    }
  }
  const badge = await adminDb().doc(`badges/${uid}_graduate`).get();
  const studentNumber = text(user.get('studentNumber'));
  const discount = user.get('alumniDiscount');
  return achievementLines({
    name: text(user.get('name')),
    studentNumber,
    institutionName: text(user.get('alumniName')) || 'Poket School',
    level: text(user.get('academyLevel')),
    graduatedOn: text(user.get('alumniLeftOn')),
    badge: badge.exists ? 'Graduate' : '',
    courses,
    certificates: certificates.titles,
    discount: typeof discount === 'number' ? discount : 0,
    verifyUrl: studentNumber ? `https://poketschool.ai/p/${encodeURIComponent(studentNumber)}` : '',
  });
}

export { defaultAlumniPolicy };

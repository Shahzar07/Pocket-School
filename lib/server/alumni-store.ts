import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import {
  alumniWelcome,
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
import { adminDb } from '../firebase-admin';
import { loadAutomation, logAutomation } from './automation-store';
import { sendInstitutionMail } from './institution-mail';
import { reviewInstitutionTier } from './institution-tier';

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
    publicProfile: data.publicProfile === true,
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
    await enrollment.ref.set({ progress: 100, shelf: 'completed', studentId }, { merge: true });
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
  }, { merge: true });
  if (input.email) {
    await adminDb().doc(`institutions/${institutionId}/joinRoster/${rosterKey(input.email)}`).set({
      status: 'leaver',
      className: '',
      graceEndsOn: FieldValue.delete(),
    }, { merge: true });
  }
  if (!input.studentId) return false;
  await completeInstitutionCourses(input.studentId, institutionId);
  const userRef = adminDb().doc(`users/${input.studentId}`);
  const user = await userRef.get();
  const currentInstitution = text(user.get('institutionId'));
  if (currentInstitution && currentInstitution !== institutionId) return false;
  const counted = currentInstitution === institutionId;
  await userRef.set({
    alumniOf: institutionId,
    alumniName: person.institutionName,
    alumniGraceEnds: person.graceEndsOn,
    alumniDiscount: input.discount,
    institutionAccess: reviewOpen ? 'grace' : 'ended',
    ...(counted || !currentInstitution ? { institutionId: FieldValue.delete() } : {}),
  }, { merge: true });
  if (!counted) return false;
  await dropUsedLicence(institutionId);
  await reviewInstitutionTier(institutionId, input.today);
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
  if (prior) {
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
  if (input.studentId && input.email) {
    await sendInstitutionMail(input.email, alumniWelcome({
      institutionName: person.institutionName,
      name: person.name,
      graceEndsOn: person.graceEndsOn,
      discount: policy.discount,
      reviewOpen: outcome.institutionAccess === 'grace',
    }));
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
    summary: `${person.name} is an alumnus of ${person.institutionName}. The seat is free and the account is individual.`,
    actorId: input.studentId || 'system',
    refId: institutionId,
  });
  return person;
}

/** Stops counting the occupied seat. Tier review decides the paid seat count. */
export async function releaseAlumniSeat(institutionId: string, studentId: string, today: string): Promise<void> {
  const ref = adminDb().doc(`institutions/${institutionId}/alumni/${studentId}`);
  const snap = await ref.get();
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
      const person = personFrom(doc.id, doc.data());
      if (!person) continue;
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

/** Keeps the verify page. The status line says the holder asked for deletion. */
export async function honourHolderDeletion(uid: string): Promise<number> {
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

export { defaultAlumniPolicy };

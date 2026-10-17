import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { hasAccountRole } from '../account-modes';
import { VOLUME_PLANS, type VolumePlanId } from '../institution-pricing';
import { parentLinkId, pendingLink } from '../parent-controls';
import { certificateStudentName, certificateStudentNumber, certificateStatus } from '../certificates';
import { ActionError } from './actions';
import {
  isStudentNumber,
  learnerLevelLabel,
  linkConfirmer,
  normaliseStudentNumber,
  randomStudentNumber,
  safePhotoUrl,
} from '../student-number';

function db(): Firestore {
  return adminDb();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export interface StudentCard {
  studentNumber: string;
  name: string;
  level: string;
  photoUrl: string;
  membership: 'member' | 'pending' | 'open' | 'elsewhere';
  userId: string;
}

function asVolume(value: unknown): VolumePlanId {
  const id = text(value);
  return VOLUME_PLANS.some((plan) => plan.id === id) ? id as VolumePlanId : 'igcse_alevel';
}

async function userById(uid: string): Promise<FirebaseFirestore.DocumentData | null> {
  const snap = await db().doc(`users/${uid}`).get();
  return snap.exists ? snap.data() ?? {} : null;
}

export async function ensureStudentNumber(uid: string): Promise<string> {
  const existing = await userById(uid);
  if (!existing || !hasAccountRole({ role: existing.role, roles: existing.roles }, 'student')) {
    throw new ActionError('FORBIDDEN', 'Student numbers are issued to student accounts.');
  }
  const current = normaliseStudentNumber(text(existing.studentNumber));
  if (isStudentNumber(current)) return current;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomStudentNumber(() => {
      const bytes = new Uint8Array(1);
      crypto.getRandomValues(bytes);
      return (bytes[0] ?? 0) / 256;
    });
    const claimed = await db().runTransaction(async (tx) => {
      const userRef = db().doc(`users/${uid}`);
      const userSnap = await tx.get(userRef);
      const already = normaliseStudentNumber(text(userSnap.data()?.studentNumber));
      if (isStudentNumber(already)) return already;
      const lockRef = db().doc(`student_numbers/${code}`);
      const lock = await tx.get(lockRef);
      if (lock.exists) return '';
      tx.set(lockRef, { userId: uid, createdAt: FieldValue.serverTimestamp() });
      tx.set(userRef, { studentNumber: code, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return code;
    });
    if (claimed) return claimed;
  }
  throw new ActionError('VALIDATION', 'Could not assign a student number. Try again.');
}

async function findStudent(code: string): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  const normalised = normaliseStudentNumber(code);
  if (!isStudentNumber(normalised)) return null;
  const lock = await db().doc(`student_numbers/${normalised}`).get();
  const lockedId = text(lock.data()?.userId);
  if (lockedId) {
    const data = await userById(lockedId);
    if (data?.role === 'student') return { id: lockedId, data };
  }
  const snap = await db().collection('users').where('studentNumber', '==', normalised).limit(1).get();
  const doc = snap.docs[0];
  if (!doc || doc.data().role !== 'student') return null;
  return { id: doc.id, data: doc.data() };
}

async function membershipFor(studentId: string, institutionId: string): Promise<StudentCard['membership']> {
  if (!institutionId) return 'open';
  const student = await userById(studentId);
  const current = text(student?.institutionId);
  if (current === institutionId) return 'member';
  if (current) return 'elsewhere';
  const request = await db().doc(`institutions/${institutionId}/join_requests/${studentId}`).get();
  if (request.exists && request.data()?.status === 'pending') return 'pending';
  return 'open';
}

export async function lookupStudent(code: string, institutionId = ''): Promise<StudentCard> {
  const found = await findStudent(code);
  if (!found) throw new ActionError('NOT_FOUND', 'That student number was not found.');
  return {
    studentNumber: normaliseStudentNumber(text(found.data.studentNumber)),
    name: text(found.data.name) || 'Student',
    level: learnerLevelLabel(found.data),
    photoUrl: safePhotoUrl(found.data.avatarUrl),
    membership: await membershipFor(found.id, institutionId),
    userId: found.id,
  };
}

export async function requestParentLink(parentId: string, code: string): Promise<{ message: string; confirmBy: 'student' | 'institution_admin' }> {
  const parent = await userById(parentId);
  if (!parent || !hasAccountRole({ role: parent.role, roles: parent.roles }, 'parent')) {
    throw new ActionError('FORBIDDEN', 'Only a parent account can request this link.');
  }
  const found = await findStudent(code);
  if (!found) throw new ActionError('NOT_FOUND', 'That student number was not found.');
  if (found.id === parentId) throw new ActionError('VALIDATION', 'Use the student number from the learner’s profile.');
  const parentIds = Array.isArray(parent.childIds) ? parent.childIds : [];
  if (parentIds.includes(found.id)) {
    return { message: 'This learner is already linked. Their progress is on your dashboard.', confirmBy: 'student' };
  }
  const confirmBy = linkConfirmer(found.data.ageTier);
  const linkId = parentLinkId(parentId, found.id);
  if (confirmBy === 'institution_admin') {
    const institutionId = text(found.data.institutionId);
    if (!institutionId) {
      throw new ActionError('VALIDATION', 'A learner under 13 is confirmed by their institution admin. Ask the school to register on Poket School first.');
    }
    await db().doc(`institution_parent_requests/${linkId}`).set({
      parentId,
      parentName: text(parent.name) || 'Parent',
      parentEmail: text(parent.email).toLowerCase(),
      studentId: found.id,
      studentName: text(found.data.name) || 'Student',
      studentNumber: normaliseStudentNumber(text(found.data.studentNumber)),
      institutionId,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
      message: 'Request sent. The institution admin confirms this link for a learner under 13.',
      confirmBy,
    };
  }
  const existing = await db().doc(`parent_links/${linkId}`).get();
  if (existing.exists && existing.data()?.status === 'approved') {
    return { message: 'This learner is already linked. Their progress is on your dashboard.', confirmBy };
  }
  if (!existing.exists || existing.data()?.status !== 'pending') {
    await db().doc(`parent_links/${linkId}`).set({
      ...pendingLink({
        parentId,
        parentName: text(parent.name) || 'Parent',
        parentEmail: text(parent.email),
        studentId: found.id,
        studentEmail: text(found.data.email),
      }),
      createdAt: FieldValue.serverTimestamp(),
    });
    await db().collection('notifications').add({
      userId: found.id,
      title: 'A parent wants to link to your account',
      message: `${text(parent.name) || 'A parent'} asked to follow your learning. Approve this on your profile if you know them.`,
      type: 'general',
      link: '/dashboard/profile',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  return {
    message: 'Request sent. The student confirms before you can see their progress and Parent Explainer.',
    confirmBy,
  };
}

export interface ParentLinkRequestRow {
  id: string;
  parentName: string;
  studentName: string;
  studentNumber: string;
  status: string;
}

export async function listInstitutionParentRequests(actorId: string): Promise<ParentLinkRequestRow[]> {
  const actor = await userById(actorId);
  const institutionId = text(actor?.institutionId);
  if (!actor || !hasAccountRole({ role: actor.role, roles: actor.roles }, 'institution_admin') || !institutionId) {
    throw new ActionError('FORBIDDEN', 'Institution admin access is required.');
  }
  const snap = await db().collection('institution_parent_requests').where('institutionId', '==', institutionId).limit(40).get();
  return snap.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        parentName: text(data.parentName) || 'Parent',
        studentName: text(data.studentName) || 'Student',
        studentNumber: text(data.studentNumber),
        status: text(data.status) || 'pending',
      };
    })
    .filter((row) => row.status === 'pending');
}

export async function confirmInstitutionParentRequest(actorId: string, requestId: string): Promise<void> {
  const actor = await userById(actorId);
  const institutionId = text(actor?.institutionId);
  if (!actor || !hasAccountRole({ role: actor.role, roles: actor.roles }, 'institution_admin') || !institutionId) {
    throw new ActionError('FORBIDDEN', 'Institution admin access is required.');
  }
  const ref = db().doc(`institution_parent_requests/${requestId}`);
  const snap = await ref.get();
  if (!snap.exists || text(snap.data()?.institutionId) !== institutionId || snap.data()?.status !== 'pending') {
    throw new ActionError('NOT_FOUND', 'That link request is no longer open.');
  }
  const data = snap.data() ?? {};
  const parentId = text(data.parentId);
  const studentId = text(data.studentId);
  await db().doc(`parent_links/${parentLinkId(parentId, studentId)}`).set({
    parentId,
    parentName: text(data.parentName) || 'Parent',
    parentEmail: text(data.parentEmail).toLowerCase(),
    studentId,
    studentEmail: '',
    status: 'approved',
    confirmBy: 'institution_admin',
    approvedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db().doc(`users/${parentId}`).set({
    childIds: FieldValue.arrayUnion(studentId),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await ref.set({ status: 'approved', decidedBy: actorId, decidedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function approveMembershipByCode(actorId: string, code: string, level: unknown): Promise<StudentCard> {
  const actor = await userById(actorId);
  const institutionId = text(actor?.institutionId);
  if (!actor || !hasAccountRole({ role: actor.role, roles: actor.roles }, 'institution_admin') || !institutionId) {
    throw new ActionError('FORBIDDEN', 'Institution admin access is required.');
  }
  const found = await findStudent(code);
  if (!found) throw new ActionError('NOT_FOUND', 'That student number was not found.');
  const current = text(found.data.institutionId);
  if (current && current !== institutionId) {
    throw new ActionError('VALIDATION', 'This student already belongs to another institution.');
  }
  const plan = asVolume(level);
  if (!current) {
    await db().doc(`institutions/${institutionId}/join_requests/${found.id}`).set({
      userId: found.id,
      role: 'student',
      email: text(found.data.email).toLowerCase(),
      name: text(found.data.name) || 'Student',
      status: 'approved',
      level: plan,
      classIds: [],
      courseIds: [],
      childEmails: [],
      decidedBy: actorId,
      decidedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }, { merge: true });
    await db().doc(`users/${found.id}`).set({
      institutionId,
      level: plan,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  return lookupStudent(normaliseStudentNumber(text(found.data.studentNumber)) || normaliseStudentNumber(code), institutionId);
}

export interface PublicCertificate {
  studentNumber: string;
  studentName: string;
  courseTitle: string;
  moduleTitle: string;
  issuedAt: string;
  status: 'valid' | 'revoked';
}

function issuedIso(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return '';
}

/** Public fields for /verify. Older certificates pick up the student number here. */
export async function publicCertificate(id: string): Promise<PublicCertificate | null> {
  const certificateId = id.trim();
  if (!certificateId || certificateId.length > 80) return null;
  const ref = db().doc(`certificates/${certificateId}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  let studentNumber = certificateStudentNumber(data.studentNumber);
  const studentId = text(data.studentId);
  if (!studentNumber && studentId) {
    try {
      studentNumber = certificateStudentNumber(await ensureStudentNumber(studentId));
      if (studentNumber) await ref.set({ studentNumber }, { merge: true });
    } catch {
      studentNumber = '';
    }
  }
  return {
    studentNumber,
    studentName: certificateStudentName(data.studentName),
    courseTitle: text(data.courseTitle) || 'Course',
    moduleTitle: text(data.moduleTitle),
    issuedAt: issuedIso(data.issuedAt),
    status: certificateStatus(data.status),
  };
}

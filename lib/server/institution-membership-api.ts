import { FieldValue } from 'firebase-admin/firestore';
import { isAdminConfigured, adminDb } from '../firebase-admin';
import { isPublicDirectorySchool, membershipOutcome, toPublicInstitution, type DirectorySource } from '../institutions/public-directory';
import { sendNotification } from './actions';
import { lookupInviteCode } from './public-directory';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sourceFrom(id: string, data: FirebaseFirestore.DocumentData): DirectorySource {
  const branding = data.branding && typeof data.branding === 'object' ? data.branding as DirectorySource['branding'] : undefined;
  const address = data.address && typeof data.address === 'object' ? data.address as DirectorySource['address'] : undefined;
  return {
    id,
    name: text(data.name),
    displayName: text(data.displayName),
    status: text(data.status),
    country: text(data.country),
    state: text(data.state),
    city: text(data.city),
    plan: text(data.plan),
    package: text(data.package),
    packageId: text(data.packageId),
    tier: text(data.tier),
    listedForSelfJoin: data.listedForSelfJoin === true,
    publicListing: data.publicListing === true,
    billingPhase: text(data.billingPhase),
    branding,
    address,
    inviteAutoApprove: data.inviteAutoApprove === true,
    logoUrl: text(data.logoUrl),
  };
}

async function notifyAdmins(institutionId: string, adminId: string, title: string, message: string) {
  const targets = new Set<string>();
  if (adminId) targets.add(adminId);
  try {
    const staff = await adminDb().collection('users').where('institutionId', '==', institutionId).where('role', '==', 'institution_admin').limit(8).get();
    staff.docs.forEach((doc) => targets.add(doc.id));
  } catch {
    // A missing index must not block the membership itself.
  }
  await Promise.all([...targets].map((uid) => sendNotification(uid, title, message, '/dashboard/institution/approvals').catch(() => undefined)));
}

async function enrolClasses(institutionId: string, uid: string, name: string) {
  const classes = await adminDb().collection('school_classes').where('institutionId', '==', institutionId).limit(30).get();
  await Promise.all(classes.docs.map(async (cls) => {
    const enrolId = `${cls.id}_${uid}`;
    await adminDb().doc(`school_enrolments/${enrolId}`).set({
      id: enrolId,
      classId: cls.id,
      studentId: uid,
      studentName: name || 'Student',
      institutionId,
      status: 'active',
      joinMethod: 'invite',
      institutionMember: true,
      ownerTeacherId: text(cls.get('ownerTeacherId')),
    }, { merge: true });
  }));
  return classes.docs.map((cls) => cls.id);
}

export async function requestInstitutionMembership(input: {
  uid: string;
  role: 'student' | 'teacher' | 'parent';
  name: string;
  email: string;
  institutionId: string;
  inviteCode?: string;
}): Promise<{ status: 'pending' | 'approved' | 'independent'; institutionName: string; message: string }> {
  if (!isAdminConfigured()) {
    return { status: 'independent', institutionName: '', message: 'Membership requests need the server account. This account stays independent.' };
  }
  const academy = await adminDb().doc(`institutions/${input.institutionId}`).get();
  if (!academy.exists) {
    return { status: 'independent', institutionName: '', message: 'That school is not listed. This account stays independent.' };
  }
  const source = sourceFrom(academy.id, academy.data() ?? {});
  const eligible = isPublicDirectorySchool(source);
  const shown = toPublicInstitution(source);
  const code = await lookupInviteCode(input.inviteCode || '');
  const codeValid = code.valid && code.institution?.id === input.institutionId;
  const outcome = membershipOutcome({ eligible, codeValid, autoApprove: code.autoApprove });
  if (outcome === 'independent') {
    return { status: 'independent', institutionName: shown.displayName, message: 'That school is not open for public join. This account stays independent.' };
  }
  const now = new Date().toISOString();
  await adminDb().doc(`institutions/${input.institutionId}/join_requests/${input.uid}`).set({
    userId: input.uid,
    institutionId: input.institutionId,
    role: input.role,
    name: input.name,
    email: input.email.trim().toLowerCase(),
    status: outcome === 'approved' ? 'approved' : 'pending',
    childEmails: [],
    createdAt: now,
    decidedAt: outcome === 'approved' ? now : '',
    decidedBy: outcome === 'approved' ? 'invite-code' : '',
  }, { merge: true });
  if (outcome === 'approved') {
    const classIds = input.role === 'student' ? await enrolClasses(input.institutionId, input.uid, input.name) : [];
    await adminDb().doc(`users/${input.uid}`).set({
      institutionId: input.institutionId,
      institutionAccess: 'active',
      membershipStatus: 'approved',
      pendingInstitutionId: FieldValue.delete(),
      pendingInstitutionName: shown.displayName,
      cohortIds: classIds,
      updatedAt: now,
    }, { merge: true });
    await sendNotification(input.uid, 'School membership approved', `${shown.displayName} accepted the invite code.`, '/dashboard').catch(() => undefined);
    await notifyAdmins(input.institutionId, text(academy.get('adminId')), 'A member joined with an invite code', `${input.name} joined ${shown.displayName}.`);
    return { status: 'approved', institutionName: shown.displayName, message: 'The invite code joined you to the school.' };
  }
  await adminDb().doc(`users/${input.uid}`).set({
    membershipStatus: 'pending',
    pendingInstitutionId: input.institutionId,
    pendingInstitutionName: shown.displayName,
    updatedAt: now,
  }, { merge: true });
  await sendNotification(input.uid, 'School request sent', `${shown.displayName} still has to approve this request. You can learn independently until then.`, '/dashboard').catch(() => undefined);
  const staffWord = input.role === 'teacher' ? 'staff' : input.role;
  await notifyAdmins(input.institutionId, text(academy.get('adminId')), 'A join request is waiting', `${input.name} asked to join as ${staffWord}.`);
  return { status: 'pending', institutionName: shown.displayName, message: 'Request sent. You can learn independently until the school approves it.' };
}

export async function decideInstitutionMembership(input: {
  actorId: string;
  institutionId: string;
  userId: string;
  decision: 'approved' | 'rejected';
}): Promise<{ status: 'approved' | 'rejected' }> {
  const requestRef = adminDb().doc(`institutions/${input.institutionId}/join_requests/${input.userId}`);
  const request = await requestRef.get();
  if (!request.exists) throw new Error('That request was not found.');
  if (request.get('status') !== 'pending') throw new Error('This request has already been decided.');
  const name = text(request.get('name')) || 'Member';
  const role = text(request.get('role'));
  const now = new Date().toISOString();
  const academy = await adminDb().doc(`institutions/${input.institutionId}`).get();
  const schoolName = text(academy.get('branding') && typeof academy.get('branding') === 'object' ? (academy.get('branding') as { displayName?: string }).displayName : '') || text(academy.get('name')) || 'the school';
  await requestRef.set({
    status: input.decision,
    decidedBy: input.actorId,
    decidedAt: now,
  }, { merge: true });
  if (input.decision === 'approved') {
    const classIds = role === 'student' ? await enrolClasses(input.institutionId, input.userId, name) : [];
    await adminDb().doc(`users/${input.userId}`).set({
      institutionId: input.institutionId,
      institutionAccess: 'active',
      membershipStatus: 'approved',
      pendingInstitutionId: FieldValue.delete(),
      pendingInstitutionName: schoolName,
      ...(classIds.length ? { cohortIds: classIds } : {}),
      updatedAt: now,
    }, { merge: true });
    await sendNotification(input.userId, 'School membership approved', `${schoolName} approved your request. The school branding and classes now apply.`, '/dashboard').catch(() => undefined);
  } else {
    await adminDb().doc(`users/${input.userId}`).set({
      membershipStatus: 'rejected',
      pendingInstitutionId: FieldValue.delete(),
      updatedAt: now,
    }, { merge: true });
    await sendNotification(input.userId, 'School request declined', `${schoolName} declined the request. This account stays independent.`, '/dashboard').catch(() => undefined);
  }
  await notifyAdmins(input.institutionId, text(academy.get('adminId')), input.decision === 'approved' ? 'Join request approved' : 'Join request declined', `${name} is ${input.decision}.`);
  return { status: input.decision };
}

export async function recordSchoolInvite(input: {
  schoolName: string;
  email: string;
  country: string;
  state: string;
  role: string;
}): Promise<{ recorded: true; sent: boolean }> {
  const name = input.schoolName.replace(/\s+/g, ' ').trim().slice(0, 80);
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new Error('Enter the school name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a school email.');
  if (!isAdminConfigured()) return { recorded: true, sent: false };
  const id = `${input.country.trim().toUpperCase().slice(0, 2)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${email.replace(/[^a-z0-9]+/g, '').slice(0, 24)}`;
  await adminDb().doc(`school_invites/${id}`).set({
    schoolName: name,
    email,
    country: input.country.trim().toUpperCase().slice(0, 2),
    state: input.state.trim().slice(0, 80),
    role: input.role,
    createdAt: new Date().toISOString(),
  }, { merge: true });
  const smtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return { recorded: true, sent: smtp };
}

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { asAgeTier, isMinorTier } from '../age-tier';
import { publicName } from '../alumni';
import {
  decideAlumniClaim,
  emailDomainMatches,
  readAlumniClaim,
  rosterCountsForAlumni,
  type AlumniClaimStatus,
} from '../alumni-claim';
import { screenPost } from '../alumni-network';
import { adminDb } from '../firebase-admin';
import { loadJoinConfig } from './institution-join-store';
import { schoolDisplayName, schoolKey } from '../self-reported-school';
import { notifyUser } from './device-push';
import { rememberAttendance } from './alumni-network-store';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeId(value: string): string {
  const id = value.trim();
  if (!id || id.includes('/')) return '';
  return id.slice(0, 160);
}

function yearLeftOn(year: string): string {
  return /^\d{4}$/.test(year) ? `${year}-01-01` : '';
}

async function placeVerified(input: {
  uid: string;
  institutionId: string;
  institutionName: string;
  className: string;
  graduationYear: string;
  country: string;
}) {
  await rememberAttendance({
    institutionId: input.institutionId,
    studentId: input.uid,
    institutionName: input.institutionName,
    level: '',
    className: input.className,
    programme: '',
    country: input.country,
    leftOn: yearLeftOn(input.graduationYear),
    claimedIndividual: true,
  });
}

async function noteLead(uid: string, key: string, name: string, country: string, state: string) {
  const leadRef = adminDb().doc(`unregistered_schools/${key}`);
  const personRef = leadRef.collection('alumni_leads').doc(uid);
  const [lead, person, user] = await Promise.all([
    leadRef.get(),
    personRef.get(),
    adminDb().doc(`users/${uid}`).get(),
  ]);
  if (person.exists) return;
  const school = user.get('selfReportedSchool');
  const already = school && typeof school === 'object' && text((school as { key?: string }).key) === key;
  await personRef.set({ at: new Date().toISOString() });
  await leadRef.set({
    name,
    country,
    state,
    alumniCount: FieldValue.increment(1),
    ...(!already ? { count: FieldValue.increment(1) } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function searchAlumniSchools(query: string): Promise<{ id: string; name: string; country: string; state: string }[]> {
  const wanted = query.trim().toLowerCase();
  if (wanted.length < 2) return [];
  const snap = await adminDb().collection('institutions').limit(80).get();
  return snap.docs.flatMap((doc) => {
    if (doc.get('status') === 'suspended') return [];
    const name = text(doc.get('name'));
    if (!name.toLowerCase().includes(wanted)) return [];
    return [{ id: doc.id, name, country: text(doc.get('country')), state: text(doc.get('state')) }];
  }).slice(0, 8);
}

export async function alumniClaimHome(uid: string) {
  const user = await adminDb().doc(`users/${uid}`).get();
  const mineSnap = await adminDb().collection(`users/${uid}/alumni_claims`).limit(20).get();
  const mine = mineSnap.docs.map((doc) => ({
    id: doc.id,
    institutionId: text(doc.get('institutionId')),
    schoolKey: text(doc.get('schoolKey')),
    schoolName: text(doc.get('schoolName')),
    className: text(doc.get('className')),
    graduationYear: text(doc.get('graduationYear')),
    status: text(doc.get('status')),
    method: text(doc.get('method')),
  }));
  const groups = await Promise.all(mine.filter((row) => row.status === 'unverified' && row.schoolKey).map(async (row) => {
    const posts = await adminDb().collection(`unregistered_alumni/${row.schoolKey}/posts`).limit(20).get();
    return {
      key: row.schoolKey,
      name: row.schoolName,
      posts: posts.docs.map((doc) => ({
        id: doc.id,
        body: text(doc.get('body')),
        authorName: text(doc.get('authorName')),
        authorId: text(doc.get('authorId')),
        visible: doc.get('visible') === true,
        queued: doc.get('queued') === true,
      })),
    };
  }));
  const rawChildren: unknown = user.get('childIds');
  const childIds = Array.isArray(rawChildren)
    ? rawChildren.filter((id): id is string => typeof id === 'string').slice(0, 20)
    : [];
  const children = (await Promise.all(childIds.map(async (childId) => {
    const [child, claims] = await Promise.all([
      adminDb().doc(`users/${childId}`).get(),
      adminDb().collection(`users/${childId}/alumni_claims`).limit(20).get(),
    ]);
    return claims.docs.flatMap((doc) => {
      if (doc.get('status') !== 'needs_parent') return [];
      return [{
        childId,
        childName: text(child.get('name')) || 'Your child',
        claimId: doc.id,
        schoolName: text(doc.get('schoolName')),
        className: text(doc.get('className')),
        graduationYear: text(doc.get('graduationYear')),
      }];
    });
  }))).flat();
  return {
    country: text(user.get('country')).toUpperCase().slice(0, 2),
    state: text(user.get('region')),
    minor: isMinorTier(asAgeTier(user.get('ageTier'))),
    mine,
    groups,
    children,
  };
}

async function writeUserClaim(uid: string, id: string, fields: Record<string, unknown>) {
  await adminDb().doc(`users/${uid}/alumni_claims/${id}`).set(fields, { merge: true });
}

export async function requestAlumniSchool(uid: string, raw: Record<string, unknown>): Promise<{ status: AlumniClaimStatus; message: string } | { error: string }> {
  const todayYear = new Date().getUTCFullYear();
  const fields = readAlumniClaim({ ...raw, todayYear });
  if ('error' in fields) return fields;
  const user = await adminDb().doc(`users/${uid}`).get();
  if (!user.exists) return { error: 'Account not found.' };
  if (text(user.get('role')) === 'institution_admin') return { error: 'Use a learner account to join an alumni network.' };
  const email = text(user.get('email')).toLowerCase();
  const ageTier = asAgeTier(user.get('ageTier'));
  const parentApproved = !isMinorTier(ageTier);

  if (fields.institutionId) {
    const academy = await adminDb().doc(`institutions/${safeId(fields.institutionId)}`).get();
    if (!academy.exists || academy.get('status') === 'suspended') return { error: 'That academy is not on Poket School.' };
    if (text(user.get('institutionId')) === academy.id) {
      return { error: 'You are still at this academy. Alumni opens when you leave or graduate.' };
    }
    const attended = await adminDb().doc(`users/${uid}/attended/${academy.id}`).get();
    if (attended.exists) return { status: 'verified', message: 'You are already in this alumni network.' };
    const config = await loadJoinConfig(academy.id);
    const roster = email
      ? await adminDb().collection(`institutions/${academy.id}/joinRoster`).where('email', '==', email).limit(1).get()
      : null;
    const rosterRow = roster?.docs[0]?.data() as { role?: string; status?: string } | undefined;
    const decision = decideAlumniClaim({
      registered: true,
      rosterMatch: config.policy.rosterMatch && rosterCountsForAlumni(rosterRow),
      domainMatch: emailDomainMatches(email, config.policy.emailDomains),
      ageTier,
      parentApproved,
    });
    const name = text(academy.get('name')) || fields.schoolName || 'Academy';
    const claim = {
      institutionId: academy.id,
      schoolKey: '',
      schoolName: name,
      className: fields.className,
      graduationYear: fields.graduationYear,
      status: decision.status,
      method: decision.method,
      email,
      createdAt: new Date().toISOString(),
    };
    await writeUserClaim(uid, academy.id, claim);
    await adminDb().doc(`institutions/${academy.id}/alumni_claims/${uid}`).set({ ...claim, studentId: uid, name: text(user.get('name')) }, { merge: true });
    if (decision.status === 'verified') {
      await placeVerified({
        uid,
        institutionId: academy.id,
        institutionName: name,
        className: fields.className,
        graduationYear: fields.graduationYear,
        country: text(academy.get('country')),
      });
      await notifyUser({
        userId: uid,
        title: `You are in ${name}'s alumni network`,
        message: 'Class groups, the yearbook, and the directory are open. Nothing here uses a seat.',
        type: 'announcement',
        link: '/dashboard/student/network',
        pref: 'institution',
      });
      return { status: 'verified', message: `You are in ${name}'s alumni network. No seat was used.` };
    }
    if (decision.status === 'needs_parent') {
      const parents = await adminDb().collection('users').where('childIds', 'array-contains', uid).limit(5).get();
      await Promise.all(parents.docs.map((parent) => notifyUser({
        userId: parent.id,
        title: `${text(user.get('name')) || 'Your child'} wants to join an alumni network`,
        message: `${name}, class ${fields.className}. Confirm this on your family page.`,
        type: 'general',
        link: '/dashboard/parent',
        pref: 'institution',
        skipPush: true,
      })));
      return { status: 'needs_parent', message: 'A parent confirms this before the alumni network opens.' };
    }
    const adminId = text(academy.get('adminId'));
    if (adminId) {
      await notifyUser({
        userId: adminId,
        title: 'An alumnus is waiting',
        message: `${publicName(text(user.get('name')))} asked to join ${name}.`,
        type: 'announcement',
        link: '/dashboard/institution/alumni',
        pref: 'institution',
      });
    }
    return { status: 'pending', message: `${name} will confirm this request. No seat is used.` };
  }

  const country = fields.country;
  const state = fields.state;
  const key = schoolKey(country, state, fields.schoolName);
  if (!key) return { error: 'Enter the school name.' };
  const existingGroup = await adminDb().doc(`unregistered_alumni/${key}`).get();
  const mergedInto = safeId(text(existingGroup.get('mergedInto')));
  if (mergedInto) return requestAlumniSchool(uid, { ...raw, institutionId: mergedInto });
  const decision = decideAlumniClaim({
    registered: false,
    rosterMatch: false,
    domainMatch: false,
    ageTier,
    parentApproved,
  });
  const name = schoolDisplayName(fields.schoolName);
  const claim = {
    institutionId: '',
    schoolKey: key,
    schoolName: name,
    className: fields.className,
    graduationYear: fields.graduationYear,
    status: decision.status,
    method: decision.method,
    email,
    createdAt: new Date().toISOString(),
  };
  await writeUserClaim(uid, key, claim);
  if (decision.status === 'needs_parent') {
    const parents = await adminDb().collection('users').where('childIds', 'array-contains', uid).limit(5).get();
    await Promise.all(parents.docs.map((parent) => notifyUser({
      userId: parent.id,
      title: `${text(user.get('name')) || 'Your child'} wants to join an alumni group`,
      message: `${name}, class ${fields.className}. Confirm this on your family page.`,
      type: 'general',
      link: '/dashboard/parent',
      pref: 'institution',
      skipPush: true,
    })));
    return { status: 'needs_parent', message: 'A parent confirms this before the unverified alumni group opens.' };
  }
  await adminDb().doc(`unregistered_alumni/${key}`).set({
    name,
    country,
    state,
    verified: false,
    mergedInto: '',
  }, { merge: true });
  const memberRef = adminDb().doc(`unregistered_alumni/${key}/members/${uid}`);
  const member = await memberRef.get();
  if (!member.exists) {
    await memberRef.set({
      studentId: uid,
      name: publicName(text(user.get('name'))),
      className: fields.className,
      graduationYear: fields.graduationYear,
      parentApproved: true,
      joinedOn: new Date().toISOString(),
    });
    await adminDb().doc(`unregistered_alumni/${key}`).set({ memberCount: FieldValue.increment(1) }, { merge: true });
  }
  await noteLead(uid, key, name, country, state);
  return { status: 'unverified', message: `${name} is an unverified alumni group. It joins the official network if the school registers later.` };
}

async function finishChildClaim(childId: string, claimId: string): Promise<{ status: AlumniClaimStatus; message: string } | { error: string }> {
  const ref = adminDb().doc(`users/${childId}/alumni_claims/${claimId}`);
  const claim = await ref.get();
  if (!claim.exists) return { error: 'That request was not found.' };
  if (claim.get('status') !== 'needs_parent') return { status: text(claim.get('status')) as AlumniClaimStatus, message: 'This request is already moving.' };
  const user = await adminDb().doc(`users/${childId}`).get();
  const institutionId = text(claim.get('institutionId'));
  if (!institutionId) {
    const key = text(claim.get('schoolKey'));
    const group = await adminDb().doc(`unregistered_alumni/${key}`).get();
    const mergedInto = safeId(text(group.get('mergedInto')));
    if (mergedInto) {
      const academy = await adminDb().doc(`institutions/${mergedInto}`).get();
      await ref.set({ status: 'verified', method: 'admin', institutionId: mergedInto }, { merge: true });
      await adminDb().doc(`institutions/${mergedInto}/alumni_claims/${childId}`).set({
        institutionId: mergedInto,
        schoolName: text(academy.get('name')) || text(claim.get('schoolName')),
        className: text(claim.get('className')),
        graduationYear: text(claim.get('graduationYear')),
        status: 'verified',
        method: 'admin',
        studentId: childId,
        name: text(user.get('name')),
      }, { merge: true });
      await placeVerified({
        uid: childId,
        institutionId: mergedInto,
        institutionName: text(academy.get('name')) || text(claim.get('schoolName')),
        className: text(claim.get('className')),
        graduationYear: text(claim.get('graduationYear')),
        country: text(academy.get('country')),
      });
      return { status: 'verified', message: 'This school is now on Poket School. They are in its alumni network. No seat was used.' };
    }
    await ref.set({ status: 'unverified', method: 'peer' }, { merge: true });
    await adminDb().doc(`unregistered_alumni/${key}`).set({
      name: text(claim.get('schoolName')),
      verified: false,
      mergedInto: '',
    }, { merge: true });
    const memberRef = adminDb().doc(`unregistered_alumni/${key}/members/${childId}`);
    const existing = await memberRef.get();
    await memberRef.set({
      studentId: childId,
      name: publicName(text(user.get('name'))),
      className: text(claim.get('className')),
      graduationYear: text(claim.get('graduationYear')),
      parentApproved: true,
      joinedOn: new Date().toISOString(),
    }, { merge: true });
    if (!existing.exists) {
      await adminDb().doc(`unregistered_alumni/${key}`).set({ memberCount: FieldValue.increment(1) }, { merge: true });
    }
    const country = key.split('|')[0] ?? '';
    const state = key.split('|')[1] ?? '';
    await noteLead(childId, key, text(claim.get('schoolName')), country, state);
    return { status: 'unverified', message: 'The unverified alumni group is open. The same minor rules apply.' };
  }
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  const config = await loadJoinConfig(institutionId);
  const email = text(user.get('email')).toLowerCase();
  const roster = email
    ? await adminDb().collection(`institutions/${institutionId}/joinRoster`).where('email', '==', email).limit(1).get()
    : null;
  const decision = decideAlumniClaim({
    registered: true,
    rosterMatch: config.policy.rosterMatch && rosterCountsForAlumni(roster?.docs[0]?.data() as { role?: string; status?: string } | undefined),
    domainMatch: emailDomainMatches(email, config.policy.emailDomains),
    ageTier: asAgeTier(user.get('ageTier')),
    parentApproved: true,
  });
  await ref.set({ status: decision.status, method: decision.method }, { merge: true });
  await adminDb().doc(`institutions/${institutionId}/alumni_claims/${childId}`).set({ status: decision.status, method: decision.method }, { merge: true });
  if (decision.status === 'verified') {
    await placeVerified({
      uid: childId,
      institutionId,
      institutionName: text(academy.get('name')) || text(claim.get('schoolName')),
      className: text(claim.get('className')),
      graduationYear: text(claim.get('graduationYear')),
      country: text(academy.get('country')),
    });
    return { status: 'verified', message: 'They are in the alumni network. No seat was used.' };
  }
  return { status: 'pending', message: 'The academy will confirm this. No seat is used.' };
}

export async function approveChildAlumniClaim(parentId: string, childId: string, claimId: string) {
  const parent = await adminDb().doc(`users/${parentId}`).get();
  const childIds = Array.isArray(parent.get('childIds')) ? parent.get('childIds') : [];
  if (!childIds.includes(childId)) return { error: 'Link this child before you confirm an alumni request.' };
  return finishChildClaim(safeId(childId), safeId(claimId));
}

export async function listInstitutionAlumniClaims(institutionId: string) {
  const snap = await adminDb().collection(`institutions/${institutionId}/alumni_claims`).limit(40).get();
  return snap.docs.flatMap((doc) => {
    const status = text(doc.get('status'));
    if (status !== 'pending' && status !== 'needs_parent') return [];
    return [{
      studentId: doc.id,
      name: publicName(text(doc.get('name'))),
      className: text(doc.get('className')),
      graduationYear: text(doc.get('graduationYear')),
      status,
    }];
  });
}

export async function reviewAlumniClaim(institutionId: string, studentId: string, approve: boolean) {
  const id = safeId(studentId);
  const ref = adminDb().doc(`institutions/${institutionId}/alumni_claims/${id}`);
  const claim = await ref.get();
  if (!claim.exists) return { error: 'That request was not found.' };
  if (claim.get('status') === 'needs_parent') return { error: 'A parent confirms this learner first.' };
  if (claim.get('status') !== 'pending') return { error: 'That request is already decided.' };
  const status: AlumniClaimStatus = approve ? 'verified' : 'rejected';
  await ref.set({ status, method: approve ? 'admin' : '' }, { merge: true });
  await adminDb().doc(`users/${id}/alumni_claims/${institutionId}`).set({ status, method: approve ? 'admin' : '' }, { merge: true });
  if (!approve) return { status };
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  await placeVerified({
    uid: id,
    institutionId,
    institutionName: text(academy.get('name')) || text(claim.get('schoolName')),
    className: text(claim.get('className')),
    graduationYear: text(claim.get('graduationYear')),
    country: text(academy.get('country')),
  });
  await notifyUser({
    userId: id,
    title: `You are in ${text(academy.get('name')) || 'the academy'}'s alumni network`,
    message: 'Class groups, the yearbook, and the directory are open. Nothing here uses a seat.',
    type: 'announcement',
    link: '/dashboard/student/network',
    pref: 'institution',
  });
  return { status };
}

export async function postUnverifiedAlumni(input: { uid: string; schoolKey: string; body: unknown }) {
  const key = safeId(input.schoolKey);
  const group = await adminDb().doc(`unregistered_alumni/${key}`).get();
  if (text(group.get('mergedInto'))) return { error: 'This school is now on Poket School. Use its alumni network.' };
  const member = await adminDb().doc(`unregistered_alumni/${key}/members/${input.uid}`).get();
  if (!member.exists) return { error: 'Join this alumni group first.' };
  const body = text(input.body).slice(0, 500);
  if (!body) return { error: 'Write a note first.' };
  const user = await adminDb().doc(`users/${input.uid}`).get();
  const tier = asAgeTier(user.get('ageTier'));
  const screened = screenPost(body, tier);
  if (!screened.visible && !screened.queued) return { error: 'Rewrite that note before it is sent.' };
  const id = `p${Date.now().toString(36)}`;
  await adminDb().doc(`unregistered_alumni/${key}/posts/${id}`).set({
    authorId: input.uid,
    authorName: publicName(text(user.get('name'))),
    body,
    visible: screened.visible,
    queued: screened.queued,
    at: new Date().toISOString(),
  });
  return { id, visible: screened.visible, queued: screened.queued };
}

export async function releaseUnverifiedPost(input: { uid: string; schoolKey: string; postId: string }) {
  const key = safeId(input.schoolKey);
  const postId = safeId(input.postId);
  const [member, user, post] = await Promise.all([
    adminDb().doc(`unregistered_alumni/${key}/members/${input.uid}`).get(),
    adminDb().doc(`users/${input.uid}`).get(),
    adminDb().doc(`unregistered_alumni/${key}/posts/${postId}`).get(),
  ]);
  if (!member.exists || !post.exists) return { error: 'That note was not found.' };
  if (isMinorTier(asAgeTier(user.get('ageTier')))) return { error: 'An adult in this group releases a held note.' };
  if (text(post.get('authorId')) === input.uid) return { error: 'Someone else in the group releases your note.' };
  if (post.get('queued') !== true) return { error: 'That note is not waiting.' };
  await post.ref.set({ visible: true, queued: false }, { merge: true });
  return { ok: true };
}

/** When a school registers, its unverified alumni become the official network. No seat is used. */
export async function mergeUnregisteredAlumni(input: { institutionId: string; name: string; country: string; state: string }) {
  const key = schoolKey(input.country, input.state, input.name);
  if (!key || !safeId(input.institutionId)) return { merged: 0 };
  const groupRef = adminDb().doc(`unregistered_alumni/${key}`);
  const group = await groupRef.get();
  if (!group.exists || text(group.get('mergedInto'))) return { merged: 0 };
  const members = await groupRef.collection('members').limit(200).get();
  let merged = 0;
  for (const member of members.docs) {
    if (member.get('parentApproved') === false) continue;
    await placeVerified({
      uid: member.id,
      institutionId: input.institutionId,
      institutionName: input.name,
      className: text(member.get('className')),
      graduationYear: text(member.get('graduationYear')),
      country: input.country,
    });
    await adminDb().doc(`users/${member.id}/alumni_claims/${key}`).set({
      status: 'verified',
      method: 'admin',
      institutionId: input.institutionId,
    }, { merge: true });
    merged += 1;
  }
  await groupRef.set({ mergedInto: input.institutionId }, { merge: true });
  await adminDb().doc(`unregistered_schools/${key}`).set({
    registeredInstitutionId: input.institutionId,
  }, { merge: true });
  return { merged };
}

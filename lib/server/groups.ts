/**
 * Groups and associations. Student groups stay inside the school.
 * TODO(institutions): confirmed leadership should also land on cv_items when the CV PR exists.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { asAgeTier, isMinorTier } from '../age-tier';
import { ActionError } from './actions';
import { reviewText } from './et-moderation';
import { automation } from './network';
import {
  canGroupChat, canJoinGroup, canSeeGroup, groupBadges, groupXp, leadershipRecord, reviewGroupDraft, suggestGroups,
  type GroupKind, type GroupRole, type GroupVisibility,
} from '../groups/policy';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const KINDS = new Set(['interest', 'club', 'study', 'association', 'alumni', 'professional']);

async function actor(uid: string): Promise<{
  id: string;
  name: string;
  role: string;
  ageTier: ReturnType<typeof asAgeTier>;
  institutionId: string;
  classIds: string[];
}> {
  const user = await db().doc(`users/${uid}`).get();
  if (!user.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const rawClasses = user.data()?.classIds;
  const classIds: string[] = Array.isArray(rawClasses)
    ? rawClasses.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  return {
    id: uid,
    name: str(user.data()?.name) || 'Member',
    role: str(user.data()?.role) || 'student',
    ageTier: asAgeTier(user.data()?.ageTier),
    institutionId: str(user.data()?.institutionId),
    classIds,
  };
}

export async function createGroup(uid: string, input: Record<string, unknown>) {
  const settings = await automation();
  if (!settings.networkOn) throw new ActionError('FORBIDDEN', 'The network is turned off.');
  const person = await actor(uid);
  const kind = (KINDS.has(str(input.kind)) ? str(input.kind) : 'interest') as GroupKind;
  const visibility = (str(input.visibility) === 'public' || str(input.visibility) === 'secret' ? str(input.visibility) : 'private') as GroupVisibility;
  const gate = reviewGroupDraft({
    kind,
    visibility,
    institutionId: isMinorTier(person.ageTier) ? person.institutionId : str(input.institutionId),
    advisorId: str(input.advisorId),
    creatorAgeTier: person.ageTier,
    creatorInstitutionId: person.institutionId,
  }, settings.groupApprovalMode, settings.studentGroupsOn);
  if (!gate.ok) throw new ActionError('FORBIDDEN', gate.reason);
  const text = `${str(input.name)}\n${str(input.description)}\n${str(input.rules)}`;
  const ref = db().collection('groups').doc();
  const mod = await reviewText({
    surface: 'group_profile',
    authorId: uid,
    authorName: person.name,
    ageTier: person.ageTier,
    text,
    subjectPath: `groups/${ref.id}`,
    institutionId: person.institutionId,
    teacherIds: str(input.advisorId) ? [str(input.advisorId)] : [],
  });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await ref.set({
    name: str(input.name).slice(0, 120),
    kind,
    visibility: gate.schoolOnly && visibility === 'public' ? 'private' : visibility,
    description: str(input.description).slice(0, 2000),
    rules: str(input.rules).slice(0, 2000),
    institutionId: gate.schoolOnly ? person.institutionId : str(input.institutionId),
    schoolOnly: gate.schoolOnly,
    advisorId: str(input.advisorId),
    ownerId: uid,
    status: gate.status,
    interests: Array.isArray(input.interests) ? input.interests.filter((item): item is string => typeof item === 'string').slice(0, 8) : [],
    skills: Array.isArray(input.skills) ? input.skills.filter((item): item is string => typeof item === 'string').slice(0, 8) : [],
    moderation: mod.decision,
    classIds: person.classIds,
    createdAtMs: Date.now(),
  });
  await db().doc(`group_members/${ref.id}_${uid}`).set({ groupId: ref.id, userId: uid, role: 'founder', posts: 0, createdAtMs: Date.now() });
  if (str(input.advisorId)) {
    await db().doc(`group_members/${ref.id}_${str(input.advisorId)}`).set({ groupId: ref.id, userId: str(input.advisorId), role: 'advisor', posts: 0, createdAtMs: Date.now() });
  }
  return { id: ref.id, status: gate.status, moderation: mod.decision, authorMessage: mod.authorMessage };
}

async function groupOrThrow(groupId: string) {
  const doc = await db().doc(`groups/${groupId}`).get();
  if (!doc.exists) throw new ActionError('NOT_FOUND', 'Group not found.');
  return doc;
}

export async function joinGroup(uid: string, groupId: string, inviteCode: string) {
  const person = await actor(uid);
  const doc = await groupOrThrow(groupId);
  const data = doc.data() ?? {};
  if (data.status !== 'active') throw new ActionError('FORBIDDEN', 'This group is waiting for the school to approve it.');
  const invited = inviteCode !== '' && data.inviteCode === inviteCode;
  const member = await db().doc(`group_members/${groupId}_${uid}`).get();
  const classIds = Array.isArray(data.classIds) ? data.classIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  const sameClass = person.classIds.some(id => classIds.includes(id));
  const visible = canSeeGroup({
    schoolOnly: data.schoolOnly === true,
    visibility: data.visibility === 'public' || data.visibility === 'secret' ? data.visibility : 'private',
    invited,
    member: member.exists,
    sameInstitution: person.institutionId !== '' && person.institutionId === str(data.institutionId),
  });
  if (!visible) throw new ActionError('FORBIDDEN', 'This group is invite only.');
  const allowed = canJoinGroup({
    schoolOnly: data.schoolOnly === true,
    visibility: data.visibility === 'public' || data.visibility === 'secret' ? data.visibility : 'private',
    invited,
    sameInstitution: person.institutionId === str(data.institutionId),
    sameClass,
    staff: person.role === 'teacher' || person.role === 'admin' || person.role === 'staff',
    minor: isMinorTier(person.ageTier),
  });
  if (!allowed && data.visibility === 'private') {
    await db().collection('group_requests').add({ groupId, userId: uid, status: 'pending', createdAtMs: Date.now() });
    return { status: 'requested' };
  }
  if (!allowed) throw new ActionError('FORBIDDEN', 'You cannot join this group.');
  await db().doc(`group_members/${groupId}_${uid}`).set({ groupId, userId: uid, role: 'member', posts: 0, createdAtMs: Date.now() });
  return { status: 'joined' };
}

export async function postToGroup(uid: string, groupId: string, input: Record<string, unknown>) {
  const person = await actor(uid);
  const membership = await db().doc(`group_members/${groupId}_${uid}`).get();
  if (!membership.exists) throw new ActionError('FORBIDDEN', 'Join the group first.');
  const doc = await groupOrThrow(groupId);
  const kind = str(input.kind) || 'post';
  const ref = db().collection('group_posts').doc();
  const mod = await reviewText({
    surface: kind === 'chat' ? 'group_chat' : 'group_post',
    authorId: uid,
    authorName: person.name,
    ageTier: person.ageTier,
    text: str(input.body),
    subjectPath: `group_posts/${ref.id}`,
    institutionId: str(doc.data()?.institutionId),
    teacherIds: str(doc.data()?.advisorId) ? [str(doc.data()?.advisorId)] : [],
    spaceLabel: str(doc.data()?.name),
  });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  if (kind === 'chat') {
    const advisorPresent = Boolean(str(doc.data()?.advisorId));
    const ok = canGroupChat({
      minor: isMinorTier(person.ageTier),
      schoolApproved: doc.data()?.status === 'active' && doc.data()?.schoolOnly === true,
      advisorPresent,
      adultGroup: doc.data()?.schoolOnly !== true,
    });
    if (!ok) throw new ActionError('FORBIDDEN', 'Group chat for under-18s needs a teacher advisor, and the chat is logged.');
  }
  await ref.set({
    groupId,
    authorId: uid,
    kind,
    body: str(input.body).slice(0, 4000),
    poll: input.poll && typeof input.poll === 'object' ? input.poll : null,
    fileName: str(input.fileName),
    moderation: mod.decision,
    createdAtMs: Date.now(),
  });
  const posts = (typeof membership.data()?.posts === 'number' ? membership.data()?.posts as number : 0) + 1;
  await membership.ref.set({ posts }, { merge: true });
  const role = (str(membership.data()?.role) || 'member') as GroupRole;
  const badges = groupBadges({ role, posts });
  for (const badge of badges) {
    await db().doc(`group_badges/${uid}_${badge}`).set({ userId: uid, groupId, badge, createdAtMs: Date.now() }, { merge: true });
  }
  return { id: ref.id, moderation: mod.decision, xp: groupXp({ posts, events: 0, role }), badges };
}

export async function createEvent(uid: string, groupId: string, input: Record<string, unknown>) {
  const membership = await db().doc(`group_members/${groupId}_${uid}`).get();
  const role = str(membership.data()?.role);
  if (!['founder', 'president', 'officer', 'advisor'].includes(role)) throw new ActionError('FORBIDDEN', 'Officers schedule events.');
  const ref = await db().collection('group_events').add({
    groupId, title: str(input.title).slice(0, 140), whenLabel: str(input.whenLabel).slice(0, 80), ownerId: uid, createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function rsvp(uid: string, eventId: string, going: boolean) {
  await db().doc(`group_rsvps/${eventId}_${uid}`).set({ eventId, userId: uid, going, createdAtMs: Date.now() });
  return { ok: true };
}

export async function appoint(uid: string, groupId: string, targetId: string, role: string) {
  const actor = await db().doc(`group_members/${groupId}_${uid}`).get();
  if (!['founder', 'president', 'advisor'].includes(str(actor.data()?.role))) throw new ActionError('FORBIDDEN', 'Only a president or advisor appoints officers.');
  const next = ['president', 'officer', 'moderator', 'member'].includes(role) ? role : 'member';
  await db().doc(`group_members/${groupId}_${targetId}`).set({ role: next }, { merge: true });
  const group = await groupOrThrow(groupId);
  const record = leadershipRecord({ role: next as GroupRole, confirmed: false, groupName: str(group.data()?.name) });
  if (record) {
    await db().doc(`group_leadership/${targetId}_${groupId}`).set({ ...record, groupId, userId: targetId, confirmed: false });
  }
  return { role: next };
}

export async function confirmLeadership(uid: string, groupId: string, targetId: string) {
  const person = await actor(uid);
  const group = await groupOrThrow(groupId);
  const advisor = group.data()?.advisorId === uid || person.role === 'admin' || person.role === 'institution_admin';
  if (!advisor) throw new ActionError('FORBIDDEN', 'The advisor or the school confirms club leadership.');
  const row = await db().doc(`group_leadership/${targetId}_${groupId}`).get();
  const title = str(row.data()?.title) || 'Officer';
  await db().doc(`group_leadership/${targetId}_${groupId}`).set({ confirmed: true, verified: true, title }, { merge: true });
  // TODO(institutions): copy this verified line onto cv_items/{targetId}.
  return { verified: true, title };
}

export async function discover(uid: string) {
  const person = await actor(uid);
  const snap = await db().collection('groups').where('status', '==', 'active').limit(40).get();
  const visible = snap.docs.filter(doc => canSeeGroup({
    schoolOnly: doc.data().schoolOnly === true,
    visibility: doc.data().visibility === 'public' || doc.data().visibility === 'secret' ? doc.data().visibility : 'private',
    invited: false,
    member: false,
    sameInstitution: person.institutionId !== '' && person.institutionId === str(doc.data().institutionId),
  }));
  const ranked = suggestGroups(
    { skills: [], institutionId: person.institutionId, interests: [] },
    visible.map(doc => ({
      id: doc.id,
      skills: Array.isArray(doc.data().skills) ? doc.data().skills.filter((item: unknown): item is string => typeof item === 'string') : [],
      institutionId: str(doc.data().institutionId),
      interests: Array.isArray(doc.data().interests) ? doc.data().interests.filter((item: unknown): item is string => typeof item === 'string') : [],
      name: str(doc.data().name),
    })),
  );
  return { groups: ranked };
}

export async function moderateGroup(uid: string, groupId: string, action: string, nextOwnerId: string) {
  const person = await actor(uid);
  if (person.role !== 'admin' && person.role !== 'institution_admin') throw new ActionError('FORBIDDEN', 'The school moderates groups.');
  const group = await groupOrThrow(groupId);
  if (person.role === 'institution_admin' && str(group.data()?.institutionId) !== person.institutionId) {
    throw new ActionError('FORBIDDEN', 'That group belongs to another school.');
  }
  if (action === 'approve') await group.ref.set({ status: 'active' }, { merge: true });
  if (action === 'archive') await group.ref.set({ status: 'archived' }, { merge: true });
  if (action === 'transfer' && nextOwnerId) {
    await group.ref.set({ ownerId: nextOwnerId }, { merge: true });
    await db().doc(`group_members/${groupId}_${nextOwnerId}`).set({ role: 'president' }, { merge: true });
  }
  return { ok: true };
}

export async function inviteLink(uid: string, groupId: string) {
  const membership = await db().doc(`group_members/${groupId}_${uid}`).get();
  if (!['founder', 'president', 'officer'].includes(str(membership.data()?.role))) throw new ActionError('FORBIDDEN', 'Officers create invite links.');
  const code = `g${groupId.slice(0, 6)}${uid.slice(0, 4)}`;
  await db().doc(`groups/${groupId}`).set({ inviteCode: code }, { merge: true });
  return { code, path: `/dashboard/network/groups?join=${groupId}&code=${code}` };
}

export async function recordDues(uid: string, groupId: string, amountCents: number) {
  const settings = await automation();
  if (!settings.groupDuesOn) throw new ActionError('FORBIDDEN', 'Membership dues are off.');
  await db().collection('group_dues').add({
    groupId, userId: uid, amountCents: Math.max(0, Math.round(amountCents)), mode: 'sandbox', status: 'recorded', createdAtMs: Date.now(),
  });
  return { mode: 'sandbox' };
}

/**
 * Professional network. Writes go through this module so ET AI screens them.
 * Skills passport, CV versions, and the job board are read if present.
 * TODO(institutions): those collections belong to the institutions PRs.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { asAgeTier, isMinorTier, type AgeTier } from '../age-tier';
import { ActionError } from './actions';
import { reviewText } from './et-moderation';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { readAutomation, type NetworkAutomation } from '../network/settings';
import {
  CONSENT, canConnect, canDirectMessage, canSearchProfile, forcedVisibility, hideSmallGroups,
  matchesRecruiter, publicCandidate, rankFeed, shortlistSummary, validHandle,
  type Availability, type CandidateCard, type NetworkPerson, type OpenToWork, type ProfileVisibility,
} from '../network/policy';
import type { ModerationSurface } from '../moderation/screen';
import { networkAllowed, readVerification } from '../verification/policy';
import { bullyingReceiveAllowed, commentVisible, outreachPaused } from '../bullying/policy';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function automation(): Promise<NetworkAutomation> {
  const snap = await db().doc('platform_settings/network').get();
  return readAutomation(snap.data());
}

async function requireNetwork() {
  const settings = await automation();
  if (!settings.networkOn) throw new ActionError('FORBIDDEN', 'The professional network is turned off.');
  return settings;
}

interface Actor extends NetworkPerson {
  name: string;
  email: string;
  verificationTier: number;
  staffPost: string;
}

function gate(actor: Actor) {
  if (!networkAllowed(actor.verificationTier)) {
    throw new ActionError('FORBIDDEN', 'Verify your email and phone before using the network.');
  }
}

async function loadActor(uid: string): Promise<Actor> {
  const user = await db().doc(`users/${uid}`).get();
  if (!user.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = user.data() ?? {};
  const profile = await db().doc(`network_profiles/${uid}`).get();
  const net = profile.data() ?? {};
  const blocks = await db().collection('network_blocks').where('userId', '==', uid).limit(50).get();
  return {
    id: uid,
    ageTier: asAgeTier(data.ageTier),
    role: str(data.role) || 'student',
    institutionId: str(data.institutionId),
    classIds: strList(data.classIds),
    handle: str(net.handle),
    visibility: (str(net.visibility) || 'school') as ProfileVisibility,
    openToWork: (str(net.openToWork) || 'no') as OpenToWork,
    shareContact: net.shareContact === true,
    searchable: net.searchable !== false,
    blockedIds: blocks.docs.map(doc => str(doc.data().targetId)),
    name: str(data.name) || 'Member',
    email: str(data.email),
    verificationTier: readVerification(data.verification).tier,
    staffPost: str(data.staffPost),
  };
}

async function verifiedSnapshot(uid: string) {
  // TODO(institutions): prefer skills_passport/{uid}.entries when that PR lands.
  const [passport, game] = await Promise.all([
    db().doc(`skills_passport/${uid}`).get(),
    db().doc(`gamification/${uid}`).get(),
  ]);
  const entries = Array.isArray(passport.data()?.entries) ? passport.data()?.entries as unknown[] : [];
  const skills = entries.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as { name?: unknown; verified?: unknown };
    return typeof row.name === 'string' ? [{ name: row.name, verified: row.verified === true }] : [];
  });
  const badges = Array.isArray(game.data()?.badges)
    ? (game.data()?.badges as unknown[]).flatMap(badge => {
      if (!badge || typeof badge !== 'object') return [];
      const row = badge as { id?: unknown; name?: unknown };
      return typeof row.name === 'string' ? [{ id: str(row.id), name: row.name }] : [];
    })
    : [];
  return { skills, badges };
}

async function screen(actor: Actor, surface: ModerationSurface, text: string, subjectPath: string, hasImage = false) {
  return reviewText({
    surface,
    authorId: actor.id,
    authorName: actor.name,
    ageTier: actor.ageTier,
    text,
    subjectPath,
    institutionId: actor.institutionId,
    hasImage,
    spaceLabel: surface,
    teacherIds: [],
  });
}

export async function saveProfile(uid: string, input: Record<string, unknown>) {
  await requireNetwork();
  const actor = await loadActor(uid);
  gate(actor);
  const handle = str(input.handle).toLowerCase() || actor.handle;
  if (!validHandle(handle)) throw new ActionError('VALIDATION', 'Choose a handle with letters, numbers, and hyphens.');
  const taken = await db().collection('network_profiles').where('handle', '==', handle).limit(2).get();
  if (taken.docs.some(doc => doc.id !== uid)) throw new ActionError('VALIDATION', 'That handle is taken.');
  const headline = str(input.headline).slice(0, 140);
  const about = str(input.about).slice(0, 2000);
  const selfReported = str(input.selfReported).slice(0, 2000);
  const mod = await screen(actor, 'network_profile', `${headline}\n${about}\n${selfReported}`, `network_profiles/${uid}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  const visibility = forcedVisibility(actor.ageTier, (str(input.visibility) || 'network') as ProfileVisibility);
  const verified = await verifiedSnapshot(uid);
  await db().doc(`network_profiles/${uid}`).set({
    userId: uid,
    handle,
    headline,
    about,
    selfReported,
    visibility,
    searchable: isMinorTier(actor.ageTier) ? false : input.searchable !== false,
    ageTier: actor.ageTier,
    role: actor.role,
    institutionId: actor.institutionId,
    openToWork: isMinorTier(actor.ageTier) ? 'no' : (str(input.openToWork) || 'no'),
    availability: str(input.availability) || 'closed',
    location: str(input.location).slice(0, 80),
    shareContact: input.shareContact === true && !isMinorTier(actor.ageTier),
    recruiterOptIn: input.recruiterOptIn === true && actor.ageTier === 'adult',
    verified,
    showVerified: input.showVerified !== false,
    consent: { pdpa: CONSENT.pdpa, gdpr: CONSENT.gdpr, child: CONSENT.child, atMs: Date.now() },
    moderation: mod.decision,
    updatedAtMs: Date.now(),
  }, { merge: true });
  return { handle, visibility, moderation: mod.decision, authorMessage: mod.authorMessage };
}

export async function readProfile(viewerId: string, handle: string) {
  await requireNetwork();
  const viewer = await loadActor(viewerId);
  gate(viewer);
  const snap = await db().collection('network_profiles').where('handle', '==', handle.toLowerCase()).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new ActionError('NOT_FOUND', 'Profile not found.');
  const data = doc.data();
  const owner = await loadActor(doc.id);
  if (!canSearchProfile(viewer, { ...owner, visibility: (str(data.visibility) || 'school') as ProfileVisibility, searchable: data.searchable !== false })) {
    throw new ActionError('FORBIDDEN', 'That profile is not visible to you.');
  }
  const hiddenContact = owner.shareContact ? {} : { email: '', phone: '' };
  return {
    id: doc.id,
    handle: data.handle,
    headline: data.headline,
    about: data.about,
    selfReported: data.selfReported,
    visibility: data.visibility,
    verified: data.showVerified === false ? null : data.verified,
    openToWork: data.openToWork,
    ...hiddenContact,
  };
}

export async function createNetworkPost(uid: string, input: Record<string, unknown>) {
  await requireNetwork();
  const actor = await loadActor(uid);
  gate(actor);
  if (isMinorTier(actor.ageTier)) {
    const space = str(input.space);
    if (space !== 'school' && space !== 'class') {
      throw new ActionError('FORBIDDEN', 'Under-18 posts stay in the school and class spaces.');
    }
  }
  const body = str(input.body).slice(0, 4000);
  const ref = db().collection('network_posts').doc();
  const mod = await screen(actor, 'network_post', body, `network_posts/${ref.id}`, Boolean(str(input.imageUrl)));
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await ref.set({
    authorId: uid,
    authorName: actor.name,
    ageTier: actor.ageTier,
    institutionId: actor.institutionId,
    classId: str(input.classId),
    orgId: str(input.orgId),
    kind: str(input.kind) || 'text',
    body,
    imageUrl: str(input.imageUrl),
    linkUrl: str(input.linkUrl),
    hashtags: strList(input.hashtags).slice(0, 8),
    mentions: strList(input.mentions).slice(0, 8),
    skillIds: strList(input.skillIds).slice(0, 8),
    achievement: input.achievement && typeof input.achievement === 'object' ? input.achievement : null,
    space: isMinorTier(actor.ageTier) ? str(input.space) : 'network',
    moderation: mod.decision,
    createdAtMs: Date.now(),
  });
  return { id: ref.id, moderation: mod.decision, authorMessage: mod.authorMessage };
}

export async function commentOnPost(uid: string, postId: string, body: string) {
  await requireNetwork();
  const actor = await loadActor(uid);
  gate(actor);
  const post = await db().doc(`network_posts/${postId}`).get();
  if (!post.exists || post.data()?.moderation !== 'allow') throw new ActionError('NOT_FOUND', 'Post not found.');
  const ref = db().collection('network_comments').doc();
  const mod = await screen(actor, 'network_comment', body, `network_comments/${ref.id}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  const postAuthorId = str(post.data()?.authorId);
  const limits = await accountLimits(uid);
  const pair = postAuthorId ? await db().doc(`network_restricts/${postAuthorId}_${uid}`).get() : null;
  const restricted = limits.commentRestricted || pair?.exists === true;
  await ref.set({
    postId, authorId: uid, authorName: actor.name, ageTier: actor.ageTier, body: body.slice(0, 2000),
    moderation: mod.decision, restricted, postAuthorId, createdAtMs: Date.now(),
  });
  return { id: ref.id, moderation: mod.decision, authorMessage: mod.authorMessage, restricted };
}

export async function listPostComments(uid: string, postId: string) {
  await requireNetwork();
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const post = await db().doc(`network_posts/${postId}`).get();
  if (!post.exists) throw new ActionError('NOT_FOUND', 'Post not found.');
  const postAuthorId = str(post.data()?.authorId);
  const snap = await db().collection('network_comments').where('postId', '==', postId).limit(50).get();
  const mutes = await db().collection('network_mutes').where('userId', '==', uid).limit(50).get();
  const muted = new Set(mutes.docs.map(doc => str(doc.data().targetId)));
  const deskLead = actor.role === 'admin' || actor.staffPost === 'safety_desk';
  const comments = snap.docs.flatMap(doc => {
    const data = doc.data();
    const authorId = str(data.authorId);
    if ((muted.has(authorId) || actor.blockedIds.includes(authorId)) && authorId !== uid && !deskLead) return [];
    const visible = commentVisible({
      viewerId: uid,
      authorId: str(data.authorId),
      postAuthorId,
      restrictedByPostAuthor: data.restricted === true,
      deskLead,
    });
    if (!visible) return [];
    return [{ id: doc.id, authorId: str(data.authorId), body: str(data.body), restricted: data.restricted === true }];
  });
  return { comments };
}

export async function reactToPost(uid: string, postId: string, emoji: string) {
  await requireNetwork();
  gate(await loadActor(uid));
  const safe = ['clap', 'thanks', 'idea', 'support'].includes(emoji) ? emoji : 'clap';
  await db().doc(`network_reactions/${postId}_${uid}`).set({ postId, userId: uid, emoji: safe, createdAtMs: Date.now() });
  return { ok: true };
}

export async function repost(uid: string, postId: string) {
  await requireNetwork();
  gate(await loadActor(uid));
  await db().doc(`network_reposts/${postId}_${uid}`).set({ postId, userId: uid, createdAtMs: Date.now() });
  return { ok: true };
}

export async function feedFor(uid: string) {
  await requireNetwork();
  const actor = await loadActor(uid);
  gate(actor);
  const mutes = await db().collection('network_mutes').where('userId', '==', uid).limit(50).get();
  const muted = new Set(mutes.docs.map(doc => str(doc.data().targetId)));
  const posts = await db().collection('network_posts').where('moderation', '==', 'allow').limit(40).get();
  const connections = await db().collection('network_connections').where('userIds', 'array-contains', uid).where('status', '==', 'accepted').limit(50).get();
  const follows = await db().collection('network_follows').where('followerId', '==', uid).limit(50).get();
  const visible = posts.docs.filter(doc => {
    const data = doc.data();
    const authorId = str(data.authorId);
    if (muted.has(authorId) || actor.blockedIds.includes(authorId)) return false;
    if (isMinorTier(actor.ageTier)) return data.institutionId === actor.institutionId && (data.space === 'school' || data.space === 'class');
    if (isMinorTier(asAgeTier(data.ageTier))) return false;
    return true;
  });
  const ranked = rankFeed(visible.map(doc => ({
    id: doc.id,
    authorId: str(doc.data().authorId),
    orgId: str(doc.data().orgId),
    institutionId: str(doc.data().institutionId),
    classId: str(doc.data().classId),
    skillIds: strList(doc.data().skillIds),
    createdAtMs: typeof doc.data().createdAtMs === 'number' ? doc.data().createdAtMs : 0,
  })), {
    viewerId: uid,
    connectionIds: connections.docs.flatMap(doc => strList(doc.data().userIds)).filter(id => id !== uid),
    followedOrgIds: follows.docs.map(doc => str(doc.data().orgId)).filter(Boolean),
    institutionId: actor.institutionId,
    classIds: actor.classIds,
    skillIds: [],
  });
  const byId = new Map(visible.map(doc => [doc.id, doc.data()]));
  return { posts: ranked.map(item => ({ id: item.id, ...byId.get(item.id) })) };
}

async function accountLimits(uid: string): Promise<{ dmLimited: boolean; connectionLimited: boolean; commentRestricted: boolean }> {
  const snap = await db().doc(`account_limits/${uid}`).get();
  const data = snap.data() ?? {};
  return {
    dmLimited: data.dmLimited === true,
    connectionLimited: data.connectionLimited === true,
    commentRestricted: data.commentRestricted === true,
  };
}

export async function requestConnection(uid: string, targetId: string) {
  await requireNetwork();
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  gate(actor);
  const target = await loadActor(targetId);
  const paused = outreachPaused(await accountLimits(uid), 'connection');
  if (!paused.ok) throw new ActionError('FORBIDDEN', paused.reason);
  const decision = canConnect(actor, target);
  if (!decision.ok) throw new ActionError('FORBIDDEN', decision.reason);
  const day = new Date().toISOString().slice(0, 10);
  const bucket = await db().doc(`network_rate/${uid}_${day}`).get();
  const count = typeof bucket.data()?.connections === 'number' ? bucket.data()?.connections as number : 0;
  if (count >= 30) throw new ActionError('FORBIDDEN', 'Connection requests are paused until tomorrow.');
  await db().doc(`network_rate/${uid}_${day}`).set({ connections: count + 1 }, { merge: true });
  const id = [uid, targetId].sort().join('_');
  await db().doc(`network_connections/${id}`).set({
    userIds: [uid, targetId].sort(),
    fromId: uid,
    toId: targetId,
    status: 'pending',
    createdAtMs: Date.now(),
  });
  await ping(targetId, 'Connection request', `${actor.name} would like to connect.`, '/dashboard/network');
  return { id, status: 'pending' };
}

export async function respondConnection(uid: string, connectionId: string, accept: boolean) {
  await requireNetwork();
  gate(await loadActor(uid));
  const doc = await db().doc(`network_connections/${connectionId}`).get();
  if (!doc.exists || !strList(doc.data()?.userIds).includes(uid)) throw new ActionError('NOT_FOUND', 'Request not found.');
  await doc.ref.set({ status: accept ? 'accepted' : 'declined' }, { merge: true });
  return { status: accept ? 'accepted' : 'declined' };
}

export async function followTarget(uid: string, targetId: string, orgId: string) {
  await requireNetwork();
  const actor = await loadActor(uid);
  gate(actor);
  if (targetId) {
    const target = await loadActor(targetId);
    if (isMinorTier(actor.ageTier) && targetId) {
      throw new ActionError('FORBIDDEN', 'Under-18 members follow organisations, not people outside class.');
    }
    if (isMinorTier(actor.ageTier) !== isMinorTier(target.ageTier)) {
      throw new ActionError('FORBIDDEN', 'Follow stays inside the same age group.');
    }
  }
  if (isMinorTier(actor.ageTier) && !orgId) throw new ActionError('FORBIDDEN', 'Under-18 members can follow organisations.');
  const id = `${uid}_${targetId || orgId}`;
  await db().doc(`network_follows/${id}`).set({ followerId: uid, targetId, orgId, createdAtMs: Date.now() });
  return { ok: true };
}

export async function sendDirectMessage(uid: string, targetId: string, body: string) {
  await requireNetwork();
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  gate(actor);
  const target = await loadActor(targetId);
  const paused = outreachPaused(await accountLimits(uid), 'dm');
  if (!paused.ok) throw new ActionError('FORBIDDEN', paused.reason);
  const id = [uid, targetId].sort().join('_');
  const connection = await db().doc(`network_connections/${id}`).get();
  const connected = connection.data()?.status === 'accepted';
  const decision = canDirectMessage(actor, target, connected);
  if (!decision.ok) throw new ActionError('FORBIDDEN', decision.reason);
  const ref = db().collection('network_messages').doc();
  const mod = await screen(actor, 'network_dm', body, `network_messages/${ref.id}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await ref.set({
    fromId: uid, toId: targetId, body: body.slice(0, 2000), moderation: mod.decision, createdAtMs: Date.now(),
  });
  if (mod.decision === 'allow') await ping(targetId, 'New message', `${actor.name} sent a message.`, '/dashboard/network');
  return { id: ref.id, moderation: mod.decision, authorMessage: mod.authorMessage };
}

export async function reportOrBlock(uid: string, input: Record<string, unknown>, block: boolean) {
  bullyingReceiveAllowed();
  await requireNetwork();
  gate(await loadActor(uid));
  const targetId = str(input.targetId);
  if (block && targetId) {
    await db().doc(`network_blocks/${uid}_${targetId}`).set({ userId: uid, targetId, createdAtMs: Date.now() });
  }
  await db().collection('network_reports').add({
    reporterId: uid,
    targetType: str(input.targetType) || 'post',
    targetId: str(input.targetId),
    reason: str(input.reason).slice(0, 500),
    status: 'open',
    createdAtMs: Date.now(),
  });
  await db().collection('moderation_queue').add({
    surface: 'network_report',
    authorId: uid,
    text: str(input.reason).slice(0, 500),
    decision: 'hold',
    reasons: ['report'],
    status: 'open',
    createdAtMs: Date.now(),
  });
  return { ok: true };
}

async function ping(userId: string, title: string, body: string, link: string) {
  await db().collection('notifications').add({
    userId, title, message: body, link, type: 'general', pushCategory: 'network', read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  try {
    await sendPush({ recipientUid: userId, category: 'network', title, body, link }, { store: adminPushStore(), send: sendToDevice });
  } catch (error) {
    console.error('network push skipped', error);
  }
}

export async function saveOrg(uid: string, input: Record<string, unknown>) {
  const settings = await requireNetwork();
  const actor = await loadActor(uid);
  gate(actor);
  if (actor.role !== 'admin' && actor.role !== 'institution_admin' && actor.role !== 'teacher' && actor.ageTier !== 'adult') {
    throw new ActionError('FORBIDDEN', 'Adults and school staff create organisation pages.');
  }
  const kind = ['institution', 'employer', 'university', 'training'].includes(str(input.kind)) ? str(input.kind) : 'employer';
  const ref = str(input.id) ? db().doc(`network_orgs/${str(input.id)}`) : db().collection('network_orgs').doc();
  const domain = str(input.domain).toLowerCase();
  const domainOk = domain.includes('.') && actor.email.endsWith(`@${domain}`);
  const verified = settings.orgVerificationMode === 'admin_only'
    ? false
    : domainOk;
  await ref.set({
    name: str(input.name).slice(0, 120),
    kind,
    about: str(input.about).slice(0, 2000),
    domain,
    domainChecked: domainOk,
    verified: actor.role === 'admin' ? input.verified === true || verified : verified,
    verification: verified ? 'domain' : 'pending',
    ownerId: uid,
    createdAtMs: Date.now(),
  }, { merge: true });
  await db().doc(`network_org_members/${ref.id}_${uid}`).set({ orgId: ref.id, userId: uid, role: 'admin', createdAtMs: Date.now() });
  return { id: ref.id, verified };
}

export async function approveOrg(actorId: string, orgId: string) {
  const actor = await loadActor(actorId);
  if (actor.role !== 'admin') throw new ActionError('FORBIDDEN', 'A super admin approves organisation verification.');
  await db().doc(`network_orgs/${orgId}`).set({ verified: true, verification: 'approved' }, { merge: true });
  return { ok: true };
}

export async function searchCandidates(uid: string, query: Record<string, unknown>) {
  const settings = await requireNetwork();
  gate(await loadActor(uid));
  if (!settings.recruiterTierOn) throw new ActionError('FORBIDDEN', 'Recruiter search is off until a super admin enables it.');
  const seat = await db().doc(`recruiter_seats/${uid}`).get();
  if (seat.data()?.verified !== true) throw new ActionError('FORBIDDEN', 'Recruiter access is verified through an employer organisation.');
  const profiles = await db().collection('network_profiles').where('recruiterOptIn', '==', true).limit(40).get();
  const cards: CandidateCard[] = [];
  for (const doc of profiles.docs) {
    const data = doc.data();
    const user = await db().doc(`users/${doc.id}`).get();
    const verified = await verifiedSnapshot(doc.id);
    cards.push({
      id: doc.id,
      ageTier: asAgeTier(data.ageTier),
      optedIn: true,
      openToWork: (str(data.openToWork) || 'no') as OpenToWork,
      availability: (str(data.availability) || 'closed') as Availability,
      level: str(user.data()?.level),
      skills: verified.skills,
      certificates: strList(data.certificates),
      location: str(data.location),
      institutionId: str(data.institutionId),
      email: str(user.data()?.email),
      phone: str(user.data()?.phone),
      shareContact: data.shareContact === true,
    });
  }
  const matched = cards.filter(card => matchesRecruiter(card, {
    skills: strList(query.skills),
    level: str(query.level),
    certificates: strList(query.certificates),
    location: str(query.location),
    availability: str(query.availability) as Availability | '',
    institutionId: str(query.institutionId),
  })).map(publicCandidate);
  return {
    candidates: matched,
    summary: shortlistSummary(matched.map(card => ({
      name: card.id,
      level: card.level,
      skills: card.skills.filter(skill => skill.verified).map(skill => skill.name),
      certificates: card.certificates,
    }))),
  };
}

export async function saveSearch(uid: string, input: Record<string, unknown>) {
  await searchCandidates(uid, input);
  const ref = await db().collection('recruiter_searches').add({
    userId: uid, query: input, alert: input.alert === true, createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function talentList(uid: string, input: Record<string, unknown>) {
  const settings = await requireNetwork();
  gate(await loadActor(uid));
  if (!settings.recruiterTierOn) throw new ActionError('FORBIDDEN', 'Recruiter tools are off.');
  const ref = str(input.id) ? db().doc(`talent_lists/${str(input.id)}`) : db().collection('talent_lists').doc();
  await ref.set({
    userId: uid, name: str(input.name).slice(0, 80), memberIds: strList(input.memberIds).slice(0, 100), updatedAtMs: Date.now(),
  }, { merge: true });
  return { id: ref.id };
}

export async function inmail(uid: string, targetId: string, body: string) {
  const settings = await requireNetwork();
  if (!settings.recruiterTierOn) throw new ActionError('FORBIDDEN', 'Recruiter messages are off.');
  const seat = await db().doc(`recruiter_seats/${uid}`).get();
  const tier = seat.data()?.tier === 'pro' ? 'pro' : 'free';
  const allowance = tier === 'pro' ? settings.inmailCreditsPro : settings.inmailCreditsFree;
  const used = typeof seat.data()?.inmailUsed === 'number' ? seat.data()?.inmailUsed as number : 0;
  if (used >= allowance) throw new ActionError('FORBIDDEN', 'InMail credits are used up.');
  const target = await db().doc(`network_profiles/${targetId}`).get();
  if (target.data()?.recruiterOptIn !== true || asAgeTier(target.data()?.ageTier) !== 'adult') {
    throw new ActionError('FORBIDDEN', 'That person is not open to recruiter messages.');
  }
  const actor = await loadActor(uid);
  gate(actor);
  const ref = db().collection('network_messages').doc();
  const mod = await screen(actor, 'network_dm', body, `network_messages/${ref.id}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await ref.set({
    fromId: uid, toId: targetId, body: body.slice(0, 2000), kind: 'inmail', moderation: mod.decision, createdAtMs: Date.now(),
  });
  await db().doc(`recruiter_seats/${uid}`).set({ inmailUsed: used + 1 }, { merge: true });
  await ping(targetId, 'Recruiter message', 'A recruiter sent a message. Your contact details stay private.', '/dashboard/network');
  return { id: ref.id, moderation: mod.decision };
}

export async function sandboxUpgrade(uid: string, tier: string) {
  const settings = await requireNetwork();
  if (!settings.recruiterTierOn && tier !== 'founders') throw new ActionError('FORBIDDEN', 'Paid tiers are off.');
  if (tier === 'founders' && !settings.foundersProOn) throw new ActionError('FORBIDDEN', 'Founders Pro is off.');
  const amount = tier === 'pro' ? settings.recruiterProCents : tier === 'founders' ? settings.foundersProCents : settings.recruiterFreeCents;
  await db().collection('recruiter_charges').add({
    userId: uid, tier, amountCents: amount, currency: 'USD', mode: 'sandbox', status: 'recorded', createdAtMs: Date.now(),
  });
  if (tier === 'pro' || tier === 'free') {
    await db().doc(`recruiter_seats/${uid}`).set({ tier: tier === 'pro' ? 'pro' : 'free', verified: true }, { merge: true });
  }
  return { mode: 'sandbox', amountCents: amount };
}

export async function applyToOpening(uid: string, input: Record<string, unknown>) {
  await requireNetwork();
  gate(await loadActor(uid));
  // TODO(institutions): cv_versions/{uid} is the CV the job board will own.
  const cvVersionId = str(input.cvVersionId);
  const ref = await db().collection('job_applications').add({
    userId: uid,
    openingId: str(input.openingId),
    cvVersionId,
    source: 'network',
    status: 'submitted',
    createdAtMs: Date.now(),
  });
  return { id: ref.id, cvVersionId };
}

export async function postOpening(uid: string, input: Record<string, unknown>) {
  await requireNetwork();
  gate(await loadActor(uid));
  // TODO(institutions): the job board UI should list job_openings.
  const ref = await db().collection('job_openings').add({
    orgId: str(input.orgId),
    startupId: str(input.startupId),
    title: str(input.title).slice(0, 140),
    level: str(input.level),
    location: str(input.location),
    kind: str(input.kind) || 'job',
    status: 'open',
    postedBy: uid,
    createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function exportNetwork(uid: string) {
  await requireNetwork();
  gate(await loadActor(uid));
  const [profile, posts, messages] = await Promise.all([
    db().doc(`network_profiles/${uid}`).get(),
    db().collection('network_posts').where('authorId', '==', uid).limit(100).get(),
    db().collection('network_messages').where('fromId', '==', uid).limit(100).get(),
  ]);
  return {
    consent: CONSENT,
    profile: profile.data() ?? null,
    posts: posts.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    messages: messages.docs.map(doc => ({ id: doc.id, ...doc.data() })),
  };
}

export async function deleteNetwork(uid: string) {
  const posts = await db().collection('network_posts').where('authorId', '==', uid).limit(100).get();
  for (const doc of posts.docs) await doc.ref.delete();
  const comments = await db().collection('network_comments').where('authorId', '==', uid).limit(100).get();
  for (const doc of comments.docs) await doc.ref.delete();
  await db().doc(`network_profiles/${uid}`).delete().catch(() => undefined);
  return { deletedPosts: posts.size };
}

export async function networkInsights(actorId: string) {
  const actor = await loadActor(actorId);
  if (actor.role !== 'admin' && actor.role !== 'institution_admin') throw new ActionError('FORBIDDEN', 'Insights are for admins.');
  const [profiles, posts, connections] = await Promise.all([
    db().collection('network_profiles').limit(200).get(),
    db().collection('network_posts').where('moderation', '==', 'allow').limit(200).get(),
    db().collection('network_connections').where('status', '==', 'accepted').limit(200).get(),
  ]);
  const bySchool = new Map<string, number>();
  for (const doc of profiles.docs) {
    const school = str(doc.data().institutionId) || 'independent';
    bySchool.set(school, (bySchool.get(school) ?? 0) + 1);
  }
  return {
    profiles: profiles.size,
    posts: posts.size,
    connections: connections.size,
    schools: hideSmallGroups([...bySchool.entries()].map(([id, n]) => ({ id, n }))),
  };
}

export async function saveAutomation(actorId: string, input: Record<string, unknown>) {
  const actor = await loadActor(actorId);
  if (actor.role !== 'admin') throw new ActionError('FORBIDDEN', 'Only a super admin changes these switches.');
  const next = readAutomation({ ...(await automation()), ...input });
  await db().doc('platform_settings/network').set(next, { merge: true });
  return next;
}

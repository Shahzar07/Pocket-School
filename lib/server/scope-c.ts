import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { ActionError } from './actions';
import { ageTierFromDob, asAgeTier, isMinorTier, type AgeTier } from '../age-tier';
import { isFeatureEnabled, resolveFlags, type FeatureFlag } from '../feature-flags';
import {
  canDirectMessage, canExplore, canFollow, canReadChannel, canSeeSpace, isStaffRole,
  matchesQuery, visibleToViewer, type CommunityChannel, type CommunityPerson, type CommunitySpace,
} from '../community/policy';
import { mergeModeration, moderateText, parseAiModeration, type ModerationResult } from '../community/moderation';
import { isWithinQuietHours, nextVisibleAt, parseClock } from '../community/quiet-hours';
import { mockStillOpen, predictedGrade, scoreAttempt, type PaperQuestion } from '../community/grades';
import { guidanceFor } from '../community/guidance';
import { explainQuestion, snapGate } from '../community/snap';
import { suggestReply } from '../community/reply';
import { DEFAULT_COMMISSION_BPS, getWallet, quoteSession } from '../wallet';
import { allocResource } from '../entitlements';
import { callOpenRouter, FAST_MODEL } from '../openrouter';
import { isSupportedLanguage, LANGUAGE_NAMES } from '../languages';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pack(id: string, data: FirebaseFirestore.DocumentData | undefined): FirebaseFirestore.DocumentData & { id: string } {
  return { ...(data ?? {}), id };
}

export interface Member extends CommunityPerson {
  name: string;
  childIds: string[];
}

export async function requireFlag(flag: FeatureFlag): Promise<void> {
  const snap = await db().doc('platform_settings/feature_flags').get();
  const flags = resolveFlags(snap.exists ? snap.data() : {});
  if (!isFeatureEnabled(flags, flag)) throw new ActionError('FORBIDDEN', 'This feature is turned off.');
}

export async function loadMember(uid: string): Promise<Member> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = snap.data() ?? {};
  const profile = await db().doc(`community_profiles/${uid}`).get();
  return {
    id: uid,
    role: str(data.role) || 'student',
    ageTier: asAgeTier(data.ageTier),
    adultDmOptIn: profile.data()?.adultDmOptIn === true,
    yearGroup: str(data.yearGroup),
    subjects: strList(data.subjects),
    name: str(data.name) || 'Member',
    childIds: strList(data.childIds),
  };
}

function asSpace(id: string, data: FirebaseFirestore.DocumentData): CommunitySpace {
  const kind = data.kind === 'class' || data.kind === 'school' || data.kind === 'adult'
    || data.kind === 'subject' || data.kind === 'year'
    ? data.kind : 'subject';
  return {
    id,
    kind,
    ageTier: asAgeTier(data.ageTier),
    visibility: data.visibility === 'tier' ? 'tier' : 'members',
    memberIds: strList(data.memberIds),
    staffIds: strList(data.staffIds),
    year: str(data.year),
    subject: str(data.subject),
  };
}

function asChannel(data: FirebaseFirestore.DocumentData): CommunityChannel {
  const kind = data.kind === 'class' || data.kind === 'parent' || data.kind === 'announcement' || data.kind === 'dm'
    ? data.kind : 'class';
  return {
    kind,
    ageTier: asAgeTier(data.ageTier),
    memberIds: strList(data.memberIds),
    staffIds: strList(data.staffIds),
  };
}

async function parentControls(studentId: string) {
  const snap = await db().doc(`parent_controls/${studentId}`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    communityEnabled: data.communityEnabled !== false,
    messagingEnabled: data.messagingEnabled !== false,
    snapEnabled: data.snapEnabled !== false,
    quietStart: str(data.quietStart) || '21:00',
    quietEnd: str(data.quietEnd) || '07:00',
    timeZone: str(data.timeZone) || 'Asia/Kuala_Lumpur',
  };
}

async function notifyUser(userId: string, title: string, message: string, link: string) {
  const tokens = await db().collection(`users/${userId}/deviceTokens`).limit(20).get();
  await db().collection('notifications').add({
    userId,
    title,
    message,
    link,
    type: 'general',
    read: false,
    push: !tokens.empty,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function moderate(surface: string, author: Member, text: string, subjectPath: string): Promise<ModerationResult & { queueId?: string }> {
  const local = moderateText(text);
  let ai: ModerationResult | null = null;
  if (local.decision !== 'block' && process.env.OPENROUTER_API_KEY) {
    try {
      const raw = await callOpenRouter(
        [{
          role: 'user',
          content: 'You moderate a school community. Reply with JSON {"decision":"allow"|"hold"|"block","reasons":["..."]}. '
            + 'Block sexual content involving minors, self-harm encouragement, and threats. Hold harassment and contact details. '
            + `Surface: ${surface}. Text:\n${text.slice(0, 2000)}`,
        }],
        { model: FAST_MODEL, temperature: 0, maxTokens: 200, jsonMode: true },
      );
      ai = parseAiModeration(raw);
    } catch (error) {
      console.error('moderation model skipped', error);
    }
  }
  const result = mergeModeration(local, ai);
  if (result.decision === 'allow') return result;
  const ref = await db().collection('moderation_queue').add({
    surface,
    authorId: author.id,
    ageTier: author.ageTier,
    text: text.slice(0, 2000),
    decision: result.decision,
    reasons: result.reasons,
    status: 'open',
    subjectPath,
    createdAtMs: Date.now(),
  });
  return { ...result, queueId: ref.id };
}

/** Shared moderation entry for both clients. Write routes call the same helper. */
export async function screenText(uid: string, text: string) {
  await requireFlag('community');
  const person = await loadMember(uid);
  return moderate('preview', person, text, '');
}

export async function setDateOfBirth(actorId: string, studentId: string, dob: string) {
  await requireFlag('community');
  const actor = await loadMember(actorId);
  const targetId = studentId || actorId;
  if (targetId !== actorId && !actor.childIds.includes(targetId)) {
    throw new ActionError('FORBIDDEN', 'Only a linked parent can set this date of birth.');
  }
  const ageTier = ageTierFromDob(dob, new Date());
  if (!ageTier) throw new ActionError('VALIDATION', 'Enter a real date of birth as YYYY-MM-DD.');
  await db().doc(`users/${targetId}`).set({
    dateOfBirth: dob, ageTier, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db().doc(`public_profiles/${targetId}`).set({ ageTier }, { merge: true });
  await db().doc(`community_profiles/${targetId}`).set({
    userId: targetId, ageTier, updatedAtMs: Date.now(),
  }, { merge: true });
  return { ageTier };
}

export async function listSpaces(uid: string) {
  await requireFlag('community');
  const person = await loadMember(uid);
  const [sameTier, staffed] = await Promise.all([
    db().collection('spaces').where('ageTier', '==', person.ageTier).limit(40).get(),
    isStaffRole(person.role)
      ? db().collection('spaces').where('staffIds', 'array-contains', uid).limit(20).get()
      : Promise.resolve(null),
  ]);
  const seen = new Set<string>();
  const spaces = [];
  for (const doc of [...sameTier.docs, ...(staffed?.docs ?? [])]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const space = asSpace(doc.id, doc.data());
    if (!canSeeSpace(person, space).ok) continue;
    spaces.push({ ...space, title: str(doc.data()?.title) });
  }
  return { ageTier: person.ageTier, explore: canExplore(person).ok, spaces };
}

export async function createSpace(uid: string, input: {
  title: string; kind: string; ageTier?: string; subject?: string; year?: string; classId?: string; memberIds?: string[];
}) {
  await requireFlag('community');
  const person = await loadMember(uid);
  if (!isStaffRole(person.role)) throw new ActionError('FORBIDDEN', 'Only staff can open a space.');
  const kind = input.kind === 'class' || input.kind === 'school' || input.kind === 'adult'
    || input.kind === 'subject' || input.kind === 'year'
    ? input.kind : 'class';
  let ageTier: AgeTier = asAgeTier(input.ageTier);
  if (kind === 'adult') ageTier = 'adult';
  if (ageTier === 'under13' && kind !== 'class' && kind !== 'school') {
    throw new ActionError('FORBIDDEN', 'Under-13 spaces are class and school only.');
  }
  if (ageTier === 'adult' && person.ageTier !== 'adult') {
    throw new ActionError('FORBIDDEN', 'Adult spaces are for adults.');
  }
  if (ageTier !== person.ageTier && kind !== 'class' && kind !== 'school' && kind !== 'year' && kind !== 'subject') {
    throw new ActionError('FORBIDDEN', 'You can only open a space for your own age tier, or a class you teach.');
  }
  const memberIds = strList(input.memberIds).slice(0, 200);
  for (const memberId of memberIds) {
    const member = await loadMember(memberId);
    if (isStaffRole(member.role)) continue;
    if (member.role === 'parent') throw new ActionError('FORBIDDEN', 'Parents are not on the wall.');
    if (member.ageTier !== ageTier) throw new ActionError('FORBIDDEN', 'A member is outside this age tier.');
  }
  const ref = db().collection('spaces').doc();
  await ref.set({
    title: input.title.slice(0, 120),
    kind,
    ageTier,
    visibility: kind === 'class' || kind === 'school' ? 'members' : 'tier',
    memberIds,
    staffIds: [uid],
    subject: str(input.subject).slice(0, 80),
    year: str(input.year).slice(0, 40),
    classId: str(input.classId),
    createdBy: uid,
    createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function feed(uid: string, spaceId: string) {
  await requireFlag('community');
  const person = await loadMember(uid);
  const spaceSnap = await db().doc(`spaces/${spaceId}`).get();
  if (!spaceSnap.exists) throw new ActionError('NOT_FOUND', 'Space not found.');
  const space = asSpace(spaceSnap.id, spaceSnap.data() ?? {});
  if (!canSeeSpace(person, space).ok) throw new ActionError('FORBIDDEN', 'You cannot open this space.');
  const posts = await db().collection('posts').where('spaceId', '==', spaceId).limit(40).get();
  const comments = await db().collection('comments').where('spaceId', '==', spaceId).limit(80).get();
  const visiblePost = (data: FirebaseFirestore.DocumentData) =>
    (data.moderation === 'allow' || data.authorId === uid) && asAgeTier(data.ageTier) === space.ageTier;
  return {
    space: { ...space, title: str(spaceSnap.data()?.title) },
    posts: posts.docs
      .filter((doc) => visiblePost(doc.data() ?? {}))
      .map((doc) => pack(doc.id, doc.data()))
      .sort((a, b) => num(b.createdAtMs) - num(a.createdAtMs)),
    comments: comments.docs
      .filter((doc) => visiblePost(doc.data() ?? {}))
      .map((doc) => pack(doc.id, doc.data())),
  };
}

async function assertCommunityOpen(person: Member) {
  if (!isMinorTier(person.ageTier)) return;
  const controls = await parentControls(person.id);
  if (controls && !controls.communityEnabled) {
    throw new ActionError('FORBIDDEN', 'Community is turned off by a parent.');
  }
}

export async function createPost(uid: string, input: { spaceId: string; kind: string; body: string }) {
  await requireFlag('community');
  const person = await loadMember(uid);
  await assertCommunityOpen(person);
  const spaceSnap = await db().doc(`spaces/${input.spaceId}`).get();
  if (!spaceSnap.exists) throw new ActionError('NOT_FOUND', 'Space not found.');
  const space = asSpace(spaceSnap.id, spaceSnap.data() ?? {});
  if (!canSeeSpace(person, space).ok) throw new ActionError('FORBIDDEN', 'You cannot post in this space.');
  const kind = input.kind === 'question' ? 'question' : 'win';
  const ref = db().collection('posts').doc();
  const mod = await moderate('post', person, input.body, `posts/${ref.id}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', 'That post cannot be published.');
  await ref.set({
    spaceId: space.id,
    authorId: uid,
    authorName: person.name,
    ageTier: space.ageTier,
    kind,
    body: input.body.slice(0, 4000),
    moderation: mod.decision,
    bestAnswerId: '',
    createdAtMs: Date.now(),
  });
  return { id: ref.id, moderation: mod.decision, queueId: mod.queueId ?? null };
}

export async function createComment(uid: string, input: { postId: string; body: string }) {
  await requireFlag('community');
  const person = await loadMember(uid);
  await assertCommunityOpen(person);
  const post = await db().doc(`posts/${input.postId}`).get();
  if (!post.exists) throw new ActionError('NOT_FOUND', 'Post not found.');
  const spaceSnap = await db().doc(`spaces/${str(post.data()?.spaceId)}`).get();
  if (!spaceSnap.exists) throw new ActionError('NOT_FOUND', 'Space not found.');
  const space = asSpace(spaceSnap.id, spaceSnap.data() ?? {});
  if (!canSeeSpace(person, space).ok) throw new ActionError('FORBIDDEN', 'You cannot comment here.');
  const ref = db().collection('comments').doc();
  const mod = await moderate('comment', person, input.body, `comments/${ref.id}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', 'That comment cannot be published.');
  await ref.set({
    postId: post.id,
    spaceId: space.id,
    authorId: uid,
    authorName: person.name,
    ageTier: space.ageTier,
    body: input.body.slice(0, 2000),
    moderation: mod.decision,
    createdAtMs: Date.now(),
  });
  return { id: ref.id, moderation: mod.decision };
}

export async function react(uid: string, postId: string, emoji: string) {
  await requireFlag('community');
  const person = await loadMember(uid);
  const post = await db().doc(`posts/${postId}`).get();
  if (!post.exists || post.data()?.moderation !== 'allow') throw new ActionError('NOT_FOUND', 'Post not found.');
  const spaceSnap = await db().doc(`spaces/${str(post.data()?.spaceId)}`).get();
  if (!spaceSnap.exists || !canSeeSpace(person, asSpace(spaceSnap.id, spaceSnap.data() ?? {})).ok) {
    throw new ActionError('FORBIDDEN', 'You cannot react in this space.');
  }
  const safe = emoji === 'thanks' || emoji === 'idea' ? emoji : 'clap';
  await db().doc(`reactions/${postId}_${uid}`).set({
    postId, userId: uid, emoji: safe, ageTier: asAgeTier(post.data()?.ageTier), createdAtMs: Date.now(),
  });
  return { ok: true };
}

export async function follow(uid: string, targetId: string) {
  await requireFlag('community');
  const person = await loadMember(uid);
  const target = await loadMember(targetId);
  const decision = canFollow(person, target);
  if (!decision.ok) throw new ActionError('FORBIDDEN', 'You cannot follow that person.');
  await db().doc(`follows/${uid}_${targetId}`).set({
    followerId: uid,
    targetId,
    followerAgeTier: person.ageTier,
    targetAgeTier: target.ageTier,
    createdAtMs: Date.now(),
  });
  return { ok: true };
}

export async function reportContent(uid: string, input: { targetType: string; targetId: string; reason: string }) {
  await requireFlag('community');
  const person = await loadMember(uid);
  const ref = await db().collection('reports').add({
    reporterId: uid,
    reporterAgeTier: person.ageTier,
    targetType: str(input.targetType).slice(0, 40) || 'post',
    targetId: str(input.targetId).slice(0, 120),
    reason: str(input.reason).slice(0, 500),
    status: 'open',
    createdAtMs: Date.now(),
  });
  await db().collection('moderation_queue').add({
    surface: 'report',
    authorId: uid,
    ageTier: person.ageTier,
    text: str(input.reason).slice(0, 500),
    decision: 'hold',
    reasons: ['report'],
    status: 'open',
    subjectPath: '',
    targetType: str(input.targetType),
    targetId: str(input.targetId),
    createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function markBestAnswer(uid: string, postId: string, commentId: string) {
  await requireFlag('community');
  const person = await loadMember(uid);
  const post = await db().doc(`posts/${postId}`).get();
  if (!post.exists) throw new ActionError('NOT_FOUND', 'Post not found.');
  const spaceSnap = await db().doc(`spaces/${str(post.data()?.spaceId)}`).get();
  const space = spaceSnap.exists ? asSpace(spaceSnap.id, spaceSnap.data() ?? {}) : null;
  const staff = space ? space.staffIds.includes(uid) && isStaffRole(person.role) : false;
  if (post.data()?.authorId !== uid && !staff) throw new ActionError('FORBIDDEN', 'Only the asker or class staff can pick a best answer.');
  const comment = await db().doc(`comments/${commentId}`).get();
  if (!comment.exists || comment.data()?.postId !== postId) throw new ActionError('NOT_FOUND', 'Comment not found.');
  if (asAgeTier(comment.data()?.ageTier) !== asAgeTier(post.data()?.ageTier)) {
    throw new ActionError('FORBIDDEN', 'That answer is outside this space.');
  }
  await post.ref.set({ bestAnswerId: commentId }, { merge: true });
  return { ok: true };
}

export async function searchCommunity(uid: string, q: string) {
  await requireFlag('community');
  const person = await loadMember(uid);
  const [posts, profiles] = await Promise.all([
    db().collection('posts').where('ageTier', '==', person.ageTier).where('moderation', '==', 'allow').limit(50).get(),
    db().collection('community_profiles').where('ageTier', '==', person.ageTier).limit(30).get(),
  ]);
  const postHits = visibleToViewer(person, posts.docs.map((doc) => {
    const data = doc.data() ?? {};
    return { id: doc.id, ageTier: asAgeTier(data.ageTier), body: str(data.body), authorName: str(data.authorName) };
  })).filter((hit) => matchesQuery(`${hit.body} ${hit.authorName}`, q));
  const people = visibleToViewer(person, profiles.docs.map((doc) => ({
    id: doc.id,
    ageTier: asAgeTier(doc.data().ageTier),
    displayName: str(doc.data().displayName),
    isPublic: doc.data().isPublic === true,
  }))).filter((hit) => hit.isPublic && matchesQuery(hit.displayName, q));
  return { posts: postHits.slice(0, 20), people: people.slice(0, 20) };
}

export async function readParentControls(actorId: string, studentId: string) {
  await requireFlag('community');
  const actor = await loadMember(actorId);
  if (actorId !== studentId && !actor.childIds.includes(studentId) && actor.role !== 'admin') {
    throw new ActionError('FORBIDDEN', 'You cannot open these controls.');
  }
  return (await parentControls(studentId)) ?? {
    communityEnabled: true, messagingEnabled: true, snapEnabled: true,
    quietStart: '21:00', quietEnd: '07:00', timeZone: 'Asia/Kuala_Lumpur',
  };
}

export async function writeParentControls(actorId: string, studentId: string, input: Record<string, unknown>) {
  await requireFlag('community');
  const actor = await loadMember(actorId);
  if (!actor.childIds.includes(studentId) && actor.role !== 'admin') {
    throw new ActionError('FORBIDDEN', 'Only a linked parent can change these controls.');
  }
  const quietStart = str(input.quietStart) || '21:00';
  const quietEnd = str(input.quietEnd) || '07:00';
  if (parseClock(quietStart) === null || parseClock(quietEnd) === null) {
    throw new ActionError('VALIDATION', 'Quiet hours use 24-hour times like 21:00.');
  }
  const saved = {
    studentId,
    communityEnabled: input.communityEnabled !== false,
    messagingEnabled: input.messagingEnabled !== false,
    snapEnabled: input.snapEnabled !== false,
    quietStart,
    quietEnd,
    timeZone: str(input.timeZone) || 'Asia/Kuala_Lumpur',
    updatedBy: actorId,
    updatedAtMs: Date.now(),
  };
  await db().doc(`parent_controls/${studentId}`).set(saved);
  return saved;
}

export async function listChannels(uid: string) {
  await requireFlag('messagingHub');
  const person = await loadMember(uid);
  const [members, staffed] = await Promise.all([
    db().collection('channels').where('memberIds', 'array-contains', uid).limit(30).get(),
    isStaffRole(person.role)
      ? db().collection('channels').where('staffIds', 'array-contains', uid).limit(20).get()
      : Promise.resolve(null),
  ]);
  const seen = new Set<string>();
  const channels = [];
  for (const doc of [...members.docs, ...(staffed?.docs ?? [])]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const channel = asChannel(doc.data());
    if (!canReadChannel(person, channel).ok) continue;
    channels.push({ id: doc.id, title: str(doc.data().title), ...channel });
  }
  return { channels };
}

export async function createChannel(uid: string, input: {
  kind: string; title: string; ageTier?: string; memberIds?: string[]; classId?: string;
}) {
  await requireFlag('messagingHub');
  const person = await loadMember(uid);
  const kind = input.kind === 'parent' || input.kind === 'announcement' || input.kind === 'dm' || input.kind === 'class'
    ? input.kind : 'class';
  const memberIds = [...new Set(strList(input.memberIds))].slice(0, 200);
  if (kind === 'dm') {
    if (memberIds.length !== 1) throw new ActionError('VALIDATION', 'A direct message needs one other person.');
    const other = await loadMember(memberIds[0]);
    const decision = canDirectMessage(person, other);
    if (!decision.ok) throw new ActionError('FORBIDDEN', 'You cannot message that person.');
    const ref = db().collection('channels').doc();
    await ref.set({
      kind: 'dm',
      title: other.name,
      ageTier: person.ageTier,
      memberIds: [uid, other.id],
      staffIds: [],
      createdBy: uid,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    return { id: ref.id };
  }
  if (!isStaffRole(person.role)) throw new ActionError('FORBIDDEN', 'Only staff can open a channel.');
  const ageTier: AgeTier = kind === 'parent' ? 'adult' : asAgeTier(input.ageTier);
  if (ageTier === 'adult' && person.ageTier !== 'adult' && kind !== 'class') {
    throw new ActionError('FORBIDDEN', 'That channel is outside your age tier.');
  }
  for (const memberId of memberIds) {
    const member = await loadMember(memberId);
    if (kind === 'class' && member.ageTier !== ageTier && !isStaffRole(member.role)) {
      throw new ActionError('FORBIDDEN', 'A member is outside this class channel.');
    }
    if (kind !== 'class' && member.ageTier !== ageTier) {
      throw new ActionError('FORBIDDEN', 'A member is outside this channel.');
    }
  }
  const ref = db().collection('channels').doc();
  await ref.set({
    kind,
    title: input.title.slice(0, 120) || 'Channel',
    ageTier,
    memberIds,
    staffIds: [uid],
    classId: str(input.classId),
    createdBy: uid,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  });
  return { id: ref.id };
}

async function translateBody(text: string, language: string): Promise<string> {
  if (!language || language === 'en' || !isSupportedLanguage(language) || !process.env.OPENROUTER_API_KEY) return '';
  try {
    return await callOpenRouter(
      [{ role: 'user', content: `Translate into ${LANGUAGE_NAMES[language]}. Return only the translation.\n\n${text.slice(0, 2000)}` }],
      { model: FAST_MODEL, temperature: 0.2, maxTokens: 800 },
    );
  } catch (error) {
    console.error('translate skipped', error);
    return '';
  }
}

export async function channelMessages(uid: string, channelId: string) {
  await requireFlag('messagingHub');
  const person = await loadMember(uid);
  const channelSnap = await db().doc(`channels/${channelId}`).get();
  if (!channelSnap.exists) throw new ActionError('NOT_FOUND', 'Channel not found.');
  const channel = asChannel(channelSnap.data() ?? {});
  if (!canReadChannel(person, channel).ok) throw new ActionError('FORBIDDEN', 'You cannot open this channel.');
  const snap = await channelSnap.ref.collection('messages').limit(80).get();
  const now = Date.now();
  return {
    channel: { id: channelSnap.id, title: str(channelSnap.data()?.title), ...channel },
    messages: snap.docs
      .map((doc) => pack(doc.id, doc.data()))
      .filter((message) => num(message.visibleAtMs, 0) <= now || message.senderId === uid)
      .sort((a, b) => num(a.createdAtMs) - num(b.createdAtMs)),
  };
}

export async function sendChannelMessage(uid: string, input: { channelId: string; body: string; language?: string }) {
  await requireFlag('messagingHub');
  const person = await loadMember(uid);
  if (isMinorTier(person.ageTier)) {
    const controls = await parentControls(person.id);
    if (controls && !controls.messagingEnabled) throw new ActionError('FORBIDDEN', 'Messaging is turned off by a parent.');
  }
  const channelSnap = await db().doc(`channels/${input.channelId}`).get();
  if (!channelSnap.exists) throw new ActionError('NOT_FOUND', 'Channel not found.');
  const channel = asChannel(channelSnap.data() ?? {});
  if (!canReadChannel(person, channel).ok) throw new ActionError('FORBIDDEN', 'You cannot write in this channel.');
  if (channel.kind === 'dm' && channel.memberIds.length === 2) {
    const otherId = channel.memberIds.find((id) => id !== uid) ?? '';
    const other = await loadMember(otherId);
    if (!canDirectMessage(person, other).ok) throw new ActionError('FORBIDDEN', 'You cannot message that person.');
  }
  const ref = channelSnap.ref.collection('messages').doc();
  const mod = await moderate('message', person, input.body, `channels/${channelSnap.id}/messages/${ref.id}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', 'That message cannot be sent.');
  let visibleAtMs = Date.now();
  for (const memberId of channel.memberIds) {
    if (memberId === uid) continue;
    const member = await loadMember(memberId);
    if (!isMinorTier(member.ageTier)) continue;
    const controls = await parentControls(memberId);
    if (!controls) continue;
    const next = nextVisibleAt(new Date(), { start: controls.quietStart, end: controls.quietEnd, timeZone: controls.timeZone });
    if (next && next.getTime() > visibleAtMs) visibleAtMs = next.getTime();
  }
  const body = input.body.slice(0, 2000);
  const bodyTranslated = await translateBody(body, str(input.language));
  await ref.set({
    senderId: uid,
    senderName: person.name,
    body,
    bodyTranslated,
    language: str(input.language),
    moderation: mod.decision,
    createdAtMs: Date.now(),
    visibleAtMs,
  });
  await channelSnap.ref.set({ updatedAtMs: Date.now() }, { merge: true });
  return { id: ref.id, moderation: mod.decision, visibleAtMs, bodyTranslated };
}

export async function announce(uid: string, input: { channelId: string; body: string; language?: string }) {
  const person = await loadMember(uid);
  if (!isStaffRole(person.role)) throw new ActionError('FORBIDDEN', 'Only staff can post an announcement.');
  return sendChannelMessage(uid, input);
}

export async function saveTutorProfile(uid: string, input: { bio: string; subjects: string[]; hourlyCents: number }) {
  await requireFlag('tutorMarketplace');
  const person = await loadMember(uid);
  if (person.ageTier !== 'adult') throw new ActionError('FORBIDDEN', 'Tutor profiles are for adults.');
  const hourly = Math.max(0, Math.round(input.hourlyCents || 0));
  await db().doc(`tutor_profiles/${uid}`).set({
    ageTier: 'adult',
    verificationStatus: 'pending',
    bio: input.bio.slice(0, 1000),
    subjects: input.subjects.map((s) => s.slice(0, 40)).slice(0, 8),
    hourlyCents: hourly,
    currency: 'USD',
    commissionBps: DEFAULT_COMMISSION_BPS,
    name: person.name,
    updatedAtMs: Date.now(),
  }, { merge: true });
  return { verificationStatus: 'pending' };
}

export async function verifyTutor(actorId: string, tutorId: string, approve: boolean) {
  await requireFlag('tutorMarketplace');
  const actor = await loadMember(actorId);
  if (actor.role !== 'admin') throw new ActionError('FORBIDDEN', 'Only an admin can verify a tutor.');
  const profile = await db().doc(`tutor_profiles/${tutorId}`).get();
  if (!profile.exists || profile.data()?.ageTier !== 'adult') throw new ActionError('NOT_FOUND', 'Tutor profile not found.');
  const verificationStatus = approve ? 'verified' : 'rejected';
  await profile.ref.set({ verificationStatus }, { merge: true });
  await notifyUser(tutorId, 'Tutor profile', approve ? 'Your tutor profile is verified.' : 'Your tutor profile was not approved.', '/dashboard/tutors');
  return { verificationStatus };
}

export async function listTutors() {
  await requireFlag('tutorMarketplace');
  const snap = await db().collection('tutor_profiles').where('verificationStatus', '==', 'verified').limit(40).get();
  return {
    tutors: snap.docs
      .filter((doc) => doc.data().ageTier === 'adult')
      .map((doc) => ({
        id: doc.id,
        name: str(doc.data().name),
        bio: str(doc.data().bio),
        subjects: strList(doc.data().subjects),
        hourlyCents: num(doc.data().hourlyCents),
        currency: 'USD',
      })),
  };
}

export async function bookTutor(uid: string, input: {
  tutorId: string; kind: string; startAtMs: number; minutes: number; seats: number;
}) {
  await requireFlag('tutorMarketplace');
  const student = await loadMember(uid);
  const tutorSnap = await db().doc(`tutor_profiles/${input.tutorId}`).get();
  if (!tutorSnap.exists || tutorSnap.data()?.verificationStatus !== 'verified') {
    throw new ActionError('NOT_FOUND', 'That tutor is not available.');
  }
  const kind = input.kind === 'group' ? 'group' : 'one_to_one';
  const quote = quoteSession(
    num(tutorSnap.data()?.hourlyCents),
    num(input.minutes, 60),
    kind === 'group' ? num(input.seats, 2) : 1,
    num(tutorSnap.data()?.commissionBps, DEFAULT_COMMISSION_BPS),
  );
  const ref = db().collection('tutor_bookings').doc();
  const payment = await getWallet().charge({
    payerId: uid,
    amountCents: quote.totalCents,
    currency: 'USD',
    memo: `Tutor session ${ref.id}`,
    reference: ref.id,
  });
  let liveClassId = '';
  if (kind === 'group') {
    const live = db().collection('live_classes').doc();
    await live.set({
      title: `Tutor group with ${str(tutorSnap.data()?.name) || 'tutor'}`,
      teacherId: input.tutorId,
      teacherName: str(tutorSnap.data()?.name),
      courseId: 'tutor-marketplace',
      scheduledAt: new Date(num(input.startAtMs, Date.now())),
      status: 'scheduled',
      joinUrl: '',
    });
    liveClassId = live.id;
  }
  await ref.set({
    tutorId: input.tutorId,
    studentId: uid,
    studentLabel: isMinorTier(student.ageTier) ? 'Student' : student.name,
    kind,
    seats: quote.seats,
    startAtMs: num(input.startAtMs, Date.now()),
    minutes: Math.max(15, Math.round(input.minutes || 60)),
    status: 'booked',
    paymentStatus: payment.status,
    paymentId: payment.paymentId,
    liveClassId,
    amountCents: quote.totalCents,
    commissionCents: quote.commissionCents,
    tutorCents: quote.tutorCents,
    createdAtMs: Date.now(),
  });
  await getWallet().tutorPayout({
    tutorId: input.tutorId,
    amountCents: quote.tutorCents,
    currency: 'USD',
    reference: ref.id,
  });
  return { id: ref.id, ...quote, paymentId: payment.paymentId, paymentStatus: payment.status, liveClassId };
}

export async function reviewTutor(uid: string, input: { bookingId: string; rating: number; body: string }) {
  await requireFlag('tutorMarketplace');
  const person = await loadMember(uid);
  const booking = await db().doc(`tutor_bookings/${input.bookingId}`).get();
  if (!booking.exists || booking.data()?.studentId !== uid) throw new ActionError('FORBIDDEN', 'That booking is not yours.');
  if (booking.data()?.status === 'cancelled') throw new ActionError('FORBIDDEN', 'This booking was cancelled.');
  const rating = Math.max(1, Math.min(5, Math.round(input.rating || 0)));
  const ref = db().collection('tutor_reviews').doc();
  await ref.set({
    bookingId: booking.id,
    tutorId: str(booking.data()?.tutorId),
    reviewerId: uid,
    reviewerLabel: isMinorTier(person.ageTier) ? 'Student' : person.name,
    rating,
    body: input.body.slice(0, 800),
    createdAtMs: Date.now(),
  });
  await booking.ref.set({ status: 'completed' }, { merge: true });
  return { id: ref.id };
}

function questionsOf(value: unknown): PaperQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 60).map((item, index) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: str(row.id) || `q${index + 1}`,
      prompt: str(row.prompt).slice(0, 500),
      marks: Math.max(1, Math.round(num(row.marks, 1))),
      answer: str(row.answer).slice(0, 200),
    };
  }).filter((q) => q.prompt);
}

export async function listPapers(board: string) {
  await requireFlag('examCentre');
  const snap = await db().collection('exam_papers').where('status', '==', 'published').limit(40).get();
  return {
    papers: snap.docs
      .map((doc) => doc.data().license === 'licensed' || doc.data().license === 'teacher_upload' ? pack(doc.id, doc.data()) : null)
      .filter((paper): paper is { id: string } & FirebaseFirestore.DocumentData => !!paper)
      .filter((paper) => !board || paper.board === board)
      .map((paper) => ({
        id: paper.id,
        board: str(paper.board),
        subject: str(paper.subject),
        year: str(paper.year),
        title: str(paper.title),
        license: str(paper.license),
        minutes: num(paper.minutes, 60),
        questions: questionsOf(paper.questions).map(({ id, prompt, marks }) => ({ id, prompt, marks })),
      })),
  };
}

export async function createPaper(uid: string, input: Record<string, unknown>) {
  await requireFlag('examCentre');
  const person = await loadMember(uid);
  if (!isStaffRole(person.role)) throw new ActionError('FORBIDDEN', 'Only a teacher can add a paper.');
  const license = input.license === 'licensed' ? 'licensed' : 'teacher_upload';
  if (license === 'licensed' && person.role !== 'admin') {
    throw new ActionError('FORBIDDEN', 'Licensed papers are added by the platform.');
  }
  const questions = questionsOf(input.questions);
  if (questions.length === 0) throw new ActionError('VALIDATION', 'Add at least one question.');
  const ref = db().collection('exam_papers').doc();
  await ref.set({
    board: str(input.board).slice(0, 40) || 'School',
    subject: str(input.subject).slice(0, 40),
    year: str(input.year).slice(0, 8),
    title: str(input.title).slice(0, 140) || 'Paper',
    license,
    uploadedBy: uid,
    minutes: Math.max(5, Math.round(num(input.minutes, 60))),
    questions,
    status: input.publish === true && (license === 'teacher_upload' || person.role === 'admin') ? 'published' : 'draft',
    createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function startMock(uid: string, paperId: string) {
  await requireFlag('examCentre');
  const paper = await db().doc(`exam_papers/${paperId}`).get();
  if (!paper.exists || paper.data()?.status !== 'published') throw new ActionError('NOT_FOUND', 'Paper not found.');
  const minutes = Math.max(5, num(paper.data()?.minutes, 60));
  const startedAtMs = Date.now();
  const ref = db().collection('mock_attempts').doc();
  await ref.set({
    studentId: uid,
    paperId,
    startedAtMs,
    endsAtMs: startedAtMs + minutes * 60_000,
    submittedAtMs: 0,
    answers: {},
    score: 0,
    maxScore: 0,
    predictedGrade: '',
  });
  return { id: ref.id, endsAtMs: startedAtMs + minutes * 60_000 };
}

export async function submitMock(uid: string, attemptId: string, answers: Record<string, string>) {
  await requireFlag('examCentre');
  const attempt = await db().doc(`mock_attempts/${attemptId}`).get();
  if (!attempt.exists || attempt.data()?.studentId !== uid) throw new ActionError('FORBIDDEN', 'That attempt is not yours.');
  if (!mockStillOpen(Date.now(), num(attempt.data()?.endsAtMs))) {
    throw new ActionError('FORBIDDEN', 'Time is up. This paper cannot be submitted.');
  }
  const paper = await db().doc(`exam_papers/${str(attempt.data()?.paperId)}`).get();
  const marked = scoreAttempt(questionsOf(paper.data()?.questions), answers);
  const grade = predictedGrade(marked.score, marked.maxScore);
  await attempt.ref.set({
    answers,
    score: marked.score,
    maxScore: marked.maxScore,
    predictedGrade: grade,
    submittedAtMs: Date.now(),
  }, { merge: true });
  return { ...marked, predictedGrade: grade };
}

export async function saveGuidance(uid: string, input: { interests: string[]; predictedGrades: Record<string, string> }) {
  await requireFlag('examCentre');
  const grades: Record<string, string> = {};
  for (const [subject, grade] of Object.entries(input.predictedGrades)) {
    if (typeof grade === 'string') grades[subject.toLowerCase()] = grade.slice(0, 3);
  }
  const suggestions = guidanceFor({ interests: input.interests, predictedGrades: grades });
  await db().doc(`guidance_profiles/${uid}`).set({
    interests: input.interests.slice(0, 8),
    predictedGrades: grades,
    suggestions,
    updatedAtMs: Date.now(),
  });
  return { suggestions };
}

export async function readGuidance(uid: string) {
  await requireFlag('examCentre');
  const snap = await db().doc(`guidance_profiles/${uid}`).get();
  return snap.exists ? snap.data() : { interests: [], predictedGrades: {}, suggestions: [] };
}

export async function listResources(uid: string) {
  await requireFlag('creatorStore');
  const person = await loadMember(uid);
  const user = await db().doc(`users/${uid}`).get();
  const permissions = strList(user.data()?.permissions);
  const snap = await db().collection('creator_resources').limit(60).get();
  const resources = snap.docs.map((doc) => pack(doc.id, doc.data())).filter((resource) => {
    if (resource.status === 'approved') return true;
    if (resource.authorId === uid || person.role === 'admin') return true;
    return permissions.includes(allocResource(resource.id));
  }).map((resource) => ({
    id: resource.id,
    kind: str(resource.kind),
    title: str(resource.title),
    body: resource.status === 'approved' || resource.authorId === uid || person.role === 'admin' ? str(resource.body) : '',
    authorId: str(resource.authorId),
    status: str(resource.status),
    priceCents: num(resource.priceCents),
    allocated: permissions.includes(allocResource(resource.id)),
  }));
  return { resources };
}

export async function createResource(uid: string, input: { kind: string; title: string; body: string; priceCents?: number }) {
  await requireFlag('creatorStore');
  const person = await loadMember(uid);
  if (!isStaffRole(person.role)) throw new ActionError('FORBIDDEN', 'Only a teacher can add a resource.');
  const kind = input.kind === 'worksheet' || input.kind === 'template' ? input.kind : 'note';
  const ref = db().collection('creator_resources').doc();
  await ref.set({
    kind,
    title: input.title.slice(0, 140),
    body: input.body.slice(0, 20000),
    authorId: uid,
    status: 'draft',
    priceCents: Math.max(0, Math.round(input.priceCents || 0)),
    createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function submitResource(uid: string, resourceId: string) {
  await requireFlag('creatorStore');
  const resource = await db().doc(`creator_resources/${resourceId}`).get();
  if (!resource.exists || resource.data()?.authorId !== uid) throw new ActionError('FORBIDDEN', 'That resource is not yours.');
  await resource.ref.set({ status: 'pending' }, { merge: true });
  return { status: 'pending' };
}

export async function moderateResource(actorId: string, resourceId: string, approve: boolean) {
  await requireFlag('creatorStore');
  const actor = await loadMember(actorId);
  if (actor.role !== 'admin') throw new ActionError('FORBIDDEN', 'Only an admin can approve a resource.');
  const resource = await db().doc(`creator_resources/${resourceId}`).get();
  if (!resource.exists) throw new ActionError('NOT_FOUND', 'Resource not found.');
  const status = approve ? 'approved' : 'rejected';
  await resource.ref.set({ status }, { merge: true });
  return { status };
}

export async function allocateResource(actorId: string, resourceId: string, studentId: string) {
  await requireFlag('creatorStore');
  const actor = await loadMember(actorId);
  if (actor.role !== 'admin' && actor.role !== 'institution_admin') {
    throw new ActionError('FORBIDDEN', 'Only an admin can allocate a resource.');
  }
  const resource = await db().doc(`creator_resources/${resourceId}`).get();
  if (!resource.exists || resource.data()?.status !== 'approved') {
    throw new ActionError('FORBIDDEN', 'Only an approved resource can be allocated.');
  }
  await db().doc(`users/${studentId}`).set({
    permissions: FieldValue.arrayUnion(allocResource(resourceId)),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { permission: allocResource(resourceId) };
}

async function ocrImage(imageBase64: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OCR is not configured');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://poketschool.ai',
      'X-Title': 'Poket School',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Read the homework question in this photo. Return only the question text.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error('OCR failed');
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export async function solveSnap(uid: string, input: { text?: string; imageBase64?: string; context?: string }) {
  await requireFlag('snapAndSolve');
  const person = await loadMember(uid);
  const controls = isMinorTier(person.ageTier) ? await parentControls(uid) : null;
  const openAttempts = await db().collection('mock_attempts').where('studentId', '==', uid).limit(10).get();
  const openMock = openAttempts.docs.some((doc) => num(doc.data().submittedAtMs) === 0 && num(doc.data().endsAtMs) > Date.now());
  const context = input.context === 'assessment' ? 'assessment' : 'study';
  const image = str(input.imageBase64).replace(/^data:image\/[a-z]+;base64,/, '');
  if (image.length > 1_500_000) throw new ActionError('VALIDATION', 'That photo is too large.');
  let text = str(input.text).slice(0, 2000);
  const gate = snapGate({
    flagOn: true,
    context,
    openMock,
    parentAllows: !controls || controls.snapEnabled,
    hasInput: Boolean(text || image),
  });
  if (gate.allowed && !text && image) {
    try {
      text = await ocrImage(image);
    } catch {
      gate.allowed = false;
      gate.reason = 'empty';
    }
  }
  const solution = gate.allowed ? explainQuestion(text) : null;
  await db().collection('snap_sessions').add({
    userId: uid,
    context,
    blocked: !gate.allowed,
    blockReason: gate.reason,
    ocrText: gate.allowed ? text : '',
    steps: solution?.steps ?? [],
    similar: solution?.similar ?? [],
    createdAtMs: Date.now(),
  });
  if (!solution) {
    const message = gate.reason === 'assessment' || gate.reason === 'open_mock'
      ? 'Snap and solve is turned off during an assessment.'
      : gate.reason === 'parent'
        ? 'Snap and solve is turned off by a parent.'
        : 'Add a photo or the question text.';
    throw new ActionError('FORBIDDEN', message);
  }
  return { ocrText: text, ...solution };
}

export async function askLesson(uid: string, input: { courseId: string; lessonId: string; lessonTitle: string; body: string }) {
  await requireFlag('lessonQa');
  const person = await loadMember(uid);
  await assertCommunityOpen(person);
  const ref = db().collection('lesson_questions').doc();
  const mod = await moderate('lesson_qa', person, input.body, `lesson_questions/${ref.id}`);
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', 'That question cannot be posted.');
  let aiSuggestedReply = suggestReply({ question: input.body, lessonTitle: input.lessonTitle });
  if (mod.decision === 'allow' && process.env.OPENROUTER_API_KEY) {
    try {
      aiSuggestedReply = await callOpenRouter(
        [{
          role: 'user',
          content: `You are a teacher drafting a reply for the lesson "${input.lessonTitle}". Be brief, kind, and do not give the full answer. Question:\n${input.body.slice(0, 1000)}`,
        }],
        { model: FAST_MODEL, temperature: 0.4, maxTokens: 400 },
      );
    } catch (error) {
      console.error('suggested reply skipped', error);
    }
  }
  await ref.set({
    courseId: input.courseId,
    lessonId: input.lessonId,
    authorId: uid,
    authorName: isMinorTier(person.ageTier) ? 'Student' : person.name,
    body: input.body.slice(0, 2000),
    aiSuggestedReply,
    publishedReply: '',
    moderation: mod.decision,
    status: 'open',
    createdAtMs: Date.now(),
  });
  return { id: ref.id, aiSuggestedReply, moderation: mod.decision };
}

export async function listLessonQuestions(uid: string, lessonId: string, courseId: string) {
  await requireFlag('lessonQa');
  const person = await loadMember(uid);
  const course = courseId ? await db().doc(`courses/${courseId}`).get() : null;
  const teaches = course?.data()?.ownerId === uid || person.role === 'admin';
  const snap = await db().collection('lesson_questions').where('lessonId', '==', lessonId).limit(40).get();
  return {
    questions: snap.docs
      .map((doc) => pack(doc.id, doc.data()))
      .filter((question) => teaches || question.authorId === uid)
      .sort((a, b) => num(b.createdAtMs) - num(a.createdAtMs)),
    canAnswer: teaches,
  };
}

export async function publishLessonReply(uid: string, questionId: string, reply: string) {
  await requireFlag('lessonQa');
  const person = await loadMember(uid);
  const question = await db().doc(`lesson_questions/${questionId}`).get();
  if (!question.exists) throw new ActionError('NOT_FOUND', 'Question not found.');
  const course = await db().doc(`courses/${str(question.data()?.courseId)}`).get();
  if (course.data()?.ownerId !== uid && person.role !== 'admin') {
    throw new ActionError('FORBIDDEN', 'Only the class teacher can publish a reply.');
  }
  await question.ref.set({ publishedReply: reply.slice(0, 2000), status: 'answered' }, { merge: true });
  await notifyUser(str(question.data()?.authorId), 'Your question was answered', 'A teacher replied on the lesson.', `/dashboard/student`);
  return { ok: true };
}

export async function listQueue(actorId: string) {
  await requireFlag('community');
  const actor = await loadMember(actorId);
  if (actor.role !== 'admin') throw new ActionError('FORBIDDEN', 'Only an admin can open the queue.');
  const snap = await db().collection('moderation_queue').where('status', '==', 'open').limit(50).get();
  return {
    items: snap.docs.map((doc) => pack(doc.id, doc.data())).sort((a, b) => num(b.createdAtMs) - num(a.createdAtMs)),
  };
}

export async function resolveQueue(actorId: string, itemId: string, approve: boolean) {
  await requireFlag('community');
  const actor = await loadMember(actorId);
  if (actor.role !== 'admin') throw new ActionError('FORBIDDEN', 'Only an admin can resolve the queue.');
  const item = await db().doc(`moderation_queue/${itemId}`).get();
  if (!item.exists) throw new ActionError('NOT_FOUND', 'Queue item not found.');
  const status = approve ? 'approved' : 'rejected';
  await item.ref.set({ status, resolvedBy: actorId }, { merge: true });
  const subjectPath = str(item.data()?.subjectPath);
  if (subjectPath) {
    await db().doc(subjectPath).set({ moderation: approve ? 'allow' : 'block' }, { merge: true });
  }
  return { status };
}

export function quietNow(start: string, end: string, timeZone: string, now = new Date()): boolean {
  return isWithinQuietHours(now, { start, end, timeZone });
}

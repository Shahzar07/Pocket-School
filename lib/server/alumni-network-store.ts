import 'server-only';

import { randomBytes } from 'node:crypto';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { asAgeTier, isMinorTier } from '../age-tier';
import { publicName } from '../alumni';
import {
  attendanceLink,
  campaignMail,
  campaignUrls,
  canDirectMessage,
  channelOpen,
  defaultConsent,
  directoryEntry,
  emptyNetworkStats,
  groupIdFor,
  matchesAudience,
  mentorDecision,
  readAudience,
  readConsent,
  readMessageKind,
  renderTemplate,
  scheduleReady,
  screenPost,
  SEAT_NOTE,
  type AlumniConsent,
  type AudienceFilter,
  type MessageKind,
  type NetworkStats,
} from '../alumni-network';
import { adminDb } from '../firebase-admin';
import { notifyUser } from './device-push';
import { sendInstitutionMail } from './institution-mail';
import { recordStatedDestination } from './learner-record-store';
import { ensureYearbookPage } from './yearbook-store';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function clip(value: unknown, max: number): string {
  return text(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeId(value: string): string {
  const id = value.trim();
  if (!id || id.includes('/') || id.length > 140) return '';
  return id;
}

function hex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function timeId(prefix: string): string {
  return `${prefix}${Date.now().toString().padStart(13, '0')}-${hex(2)}`;
}

export interface HeldPostCard {
  id: string;
  groupId: string;
  body: string;
  authorName: string;
  kind: 'post' | 'mentor';
}

export interface MentorCard {
  id: string;
  mentorName: string;
  studentName: string;
  status: 'pending' | 'approved' | 'closed';
  moderated: boolean;
}

export interface CampaignCard {
  id: string;
  kind: MessageKind;
  subject: string;
  sendOn: string;
  status: string;
  reached: number;
  opened: number;
  clicked: number;
  replies: number;
  filter: AudienceFilter;
}

export interface NetworkDesk {
  stats: NetworkStats;
  campaigns: CampaignCard[];
  groups: { id: string; name: string; members: number }[];
  held: HeldPostCard[];
  mentors: MentorCard[];
  updates: { name: string; destination: string; job: string }[];
  seatNote: string;
}

async function ensureConsent(uid: string, institutionId: string): Promise<AlumniConsent & { token: string }> {
  const ref = adminDb().doc(`users/${uid}/alumni_consent/${institutionId}`);
  const snap = await ref.get();
  const consent = snap.exists ? readConsent(snap.data()) : defaultConsent();
  let token = text(snap.get('unsubscribeToken'));
  if (!/^[a-f0-9]{32}$/.test(token)) {
    token = hex(16);
    await ref.set({ ...consent, unsubscribeToken: token }, { merge: true });
    await adminDb().doc(`alumni_unsubscribes/${token}`).set({ studentId: uid, institutionId });
  }
  return { ...consent, token };
}

/** Keeps every academy on the account. Does not free, occupy, or rewrite a graduation seat. */
export async function rememberAttendance(input: {
  institutionId: string;
  studentId: string;
  institutionName: string;
  level: string;
  className: string;
  programme: string;
  country: string;
  leftOn: string;
  destination?: string;
  /** An individual who asked to join. This never occupies or frees a seat. */
  claimedIndividual?: boolean;
}): Promise<void> {
  const institutionId = safeId(input.institutionId);
  const studentId = safeId(input.studentId);
  if (!institutionId || !studentId) return;
  const link = attendanceLink();
  const leftOn = /^\d{4}-\d{2}-\d{2}$/.test(input.leftOn) ? input.leftOn : '';
  const year = leftOn.slice(0, 4);
  const className = clip(input.className, 60);
  const level = clip(input.level, 40);
  await adminDb().doc(`users/${studentId}/attended/${institutionId}`).set({
    institutionId,
    institutionName: clip(input.institutionName, 120) || 'Academy',
    level,
    className,
    programme: clip(input.programme, 80),
    country: clip(input.country, 60),
    destination: clip(input.destination, 120),
    leftOn,
    seatCounted: link.seatCounted,
    holdsSeat: link.holdsSeat,
  }, { merge: true });
  await ensureConsent(studentId, institutionId);
  const group = groupIdFor({ className, level, year });
  const groupRef = adminDb().doc(`institutions/${institutionId}/alumni_groups/${group.id}`);
  await groupRef.set({ name: group.name, className, level, year: year || '', kind: group.kind }, { merge: true });
  const memberRef = groupRef.collection('members').doc(studentId);
  const member = await memberRef.get();
  if (!member.exists) {
    await memberRef.set({ studentId, joinedOn: leftOn, directoryName: '' });
    await groupRef.set({ memberCount: FieldValue.increment(1) }, { merge: true });
  }
  await ensureYearbookPage({
    institutionId,
    studentId,
    institutionName: clip(input.institutionName, 120) || 'Academy',
    level,
    className,
    year,
    leftOn,
  });
  const alumniRef = adminDb().doc(`institutions/${institutionId}/alumni/${studentId}`);
  const alumni = await alumniRef.get();
  const profile = {
    className,
    programme: clip(input.programme, 80),
    country: clip(input.country, 60),
    ...(input.destination ? { destination: clip(input.destination, 120) } : {}),
  };
  if (alumni.exists) {
    await alumniRef.set(profile, { merge: true });
    return;
  }
  const user = await adminDb().doc(`users/${studentId}`).get();
  await alumniRef.set({
    institutionId,
    studentId,
    name: clip(user.get('name'), 120),
    email: text(user.get('email')).toLowerCase(),
    studentNumber: clip(user.get('studentNumber'), 20),
    institutionName: clip(input.institutionName, 120) || 'Academy',
    level,
    leftOn,
    graceEndsOn: leftOn,
    reason: input.claimedIndividual ? 'claimed' : 'marked',
    certificates: 0,
    claimedIndividual: input.claimedIndividual === true,
    seatFreed: input.claimedIndividual === true ? false : true,
    seatCounted: false,
    publicProfile: false,
    ...profile,
  });
}

interface AudienceRow {
  id: string;
  name: string;
  email: string;
  leftOn: string;
  level: string;
  programme: string;
  className: string;
  country: string;
  destination: string;
}

async function audienceRows(institutionId: string): Promise<AudienceRow[]> {
  const snap = await adminDb().collection(`institutions/${institutionId}/alumni`).limit(200).get();
  return snap.docs.flatMap((doc) => {
    if (text(doc.get('undoneOn'))) return [];
    return [{
      id: doc.id,
      name: text(doc.get('name')),
      email: text(doc.get('email')).toLowerCase(),
      leftOn: text(doc.get('leftOn')),
      level: text(doc.get('level')),
      programme: text(doc.get('programme')),
      className: text(doc.get('className')),
      country: text(doc.get('country')),
      destination: text(doc.get('destination')),
    }];
  });
}

async function deliverCampaign(campaignId: string, academyName: string): Promise<number> {
  const ref = adminDb().doc(`alumni_outbox/${campaignId}`);
  const claimed = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('status') !== 'scheduled') return null;
    tx.set(ref, { status: 'sending' }, { merge: true });
    return snap.data() ?? {};
  });
  if (!claimed) return 0;
  const institutionId = text(claimed.institutionId);
  const filter = readAudience(claimed.filter);
  const subject = text(claimed.subject);
  const body = text(claimed.body);
  let reached = 0;
  try {
    const people = (await audienceRows(institutionId)).filter((person) => matchesAudience(person, filter)).slice(0, 80);
    for (const person of people) {
      const consent = await ensureConsent(person.id, institutionId);
      const emailOn = channelOpen(consent, 'email') && Boolean(person.email);
      const inboxOn = channelOpen(consent, 'inbox');
      const pushOn = channelOpen(consent, 'push');
      if (!emailOn && !inboxOn && !pushOn) continue;
      const receiptRef = adminDb().doc(`alumni_outbox/${campaignId}/receipts/${person.id}`);
      const existing = await receiptRef.get();
      if (existing.exists) continue;
      const receiptToken = hex(16);
      const links = campaignUrls(campaignId, receiptToken);
      const unsub = campaignUrls(campaignId, consent.token).unsubscribe;
      let emailed = false;
      if (emailOn) {
        const mail = campaignMail({
          academy: academyName,
          subject,
          body,
          viewUrl: links.view,
          eventUrl: links.event,
          unsubscribeUrl: unsub,
        });
        const result = await sendInstitutionMail(person.email, mail);
        emailed = result.emailed;
      }
      if (inboxOn) {
        await adminDb().doc(`users/${person.id}/inbox/${campaignId}`).set({
          institutionId,
          campaignId,
          subject,
          body,
          fromName: academyName,
          at: new Date().toISOString(),
        });
      }
      if (inboxOn || pushOn) {
        await notifyUser({
          userId: person.id,
          title: subject || academyName,
          message: body.slice(0, 180),
          type: 'announcement',
          link: '/dashboard/student/network',
          pref: text(claimed.kind) === 'reunion' ? 'alumni' : 'institution',
          skipPush: !pushOn,
        });
      }
      await receiptRef.set({ opened: false, clicked: false, emailed, token: receiptToken });
      await adminDb().doc(`alumni_receipts/${receiptToken}`).set({ campaignId, studentId: person.id });
      if (emailed || inboxOn || pushOn) reached += 1;
    }
    await ref.set({ status: 'sent', reached, sentAt: new Date().toISOString() }, { merge: true });
    return reached;
  } catch (error) {
    await ref.set({ status: 'scheduled' }, { merge: true });
    throw error;
  }
}

export async function releaseScheduledAlumni(today: string, limit = 40): Promise<number> {
  const snap = await adminDb().collection('alumni_outbox').where('status', '==', 'scheduled').limit(limit).get();
  let sent = 0;
  for (const doc of snap.docs) {
    if (!scheduleReady(text(doc.get('sendOn')), today)) continue;
    try {
      const academy = await adminDb().doc(`institutions/${text(doc.get('institutionId'))}`).get();
      sent += await deliverCampaign(doc.id, text(academy.get('name')) || 'Academy');
    } catch (error) {
      console.error('Alumni note stayed scheduled', doc.id, error instanceof Error ? error.message : 'unknown');
    }
  }
  return sent;
}

export async function saveCampaign(input: {
  institutionId: string;
  kind: unknown;
  note: unknown;
  filter: unknown;
  sendOn: unknown;
  today: string;
}): Promise<{ id: string; status: string; reached: number } | { error: string }> {
  const kind = readMessageKind(input.kind);
  if (!kind) return { error: 'Choose a template.' };
  const academy = await adminDb().doc(`institutions/${input.institutionId}`).get();
  const academyName = text(academy.get('name')) || 'Academy';
  const note = renderTemplate(kind, academyName, text(input.note));
  const screened = screenPost(note.body, 'adult');
  if (screened.decision === 'block') return { error: 'Rewrite that note before it is sent.' };
  const sendOn = /^\d{4}-\d{2}-\d{2}$/.test(text(input.sendOn)) ? text(input.sendOn) : input.today;
  const id = `camp-${hex(6)}`;
  await adminDb().doc(`alumni_outbox/${id}`).set({
    institutionId: input.institutionId,
    kind,
    subject: note.subject,
    body: note.body,
    filter: readAudience(input.filter),
    sendOn,
    status: 'scheduled',
    reached: 0,
    opened: 0,
    clicked: 0,
    replies: 0,
    createdAt: new Date().toISOString(),
  });
  if (!scheduleReady(sendOn, input.today)) return { id, status: 'scheduled', reached: 0 };
  const reached = await deliverCampaign(id, academyName);
  return { id, status: 'sent', reached };
}

export async function networkDesk(institutionId: string): Promise<NetworkDesk> {
  const [campaigns, events, mentors, held, groups, people] = await Promise.all([
    adminDb().collection('alumni_outbox').where('institutionId', '==', institutionId).limit(40).get(),
    adminDb().collection(`institutions/${institutionId}/alumni_events`).limit(40).get(),
    adminDb().collection(`institutions/${institutionId}/mentorships`).limit(40).get(),
    adminDb().collection(`institutions/${institutionId}/alumni_queue`).where('status', '==', 'held').limit(20).get(),
    adminDb().collection(`institutions/${institutionId}/alumni_groups`).limit(30).get(),
    adminDb().collection(`institutions/${institutionId}/alumni`).limit(80).get(),
  ]);
  const stats = emptyNetworkStats();
  const cards: CampaignCard[] = campaigns.docs.map((doc) => {
    const reached = typeof doc.get('reached') === 'number' ? doc.get('reached') : 0;
    const opened = typeof doc.get('opened') === 'number' ? doc.get('opened') : 0;
    const clicked = typeof doc.get('clicked') === 'number' ? doc.get('clicked') : 0;
    const replies = typeof doc.get('replies') === 'number' ? doc.get('replies') : 0;
    stats.reached += reached;
    stats.opened += opened;
    stats.clicked += clicked;
    stats.replies += replies;
    return {
      id: doc.id,
      kind: readMessageKind(doc.get('kind')) ?? 'newsletter',
      subject: text(doc.get('subject')),
      sendOn: text(doc.get('sendOn')),
      status: text(doc.get('status')) || 'draft',
      reached,
      opened,
      clicked,
      replies,
      filter: readAudience(doc.get('filter')),
    };
  });
  stats.events = events.size;
  for (const event of events.docs) {
    stats.rsvps += typeof event.get('rsvpCount') === 'number' ? event.get('rsvpCount') : 0;
  }
  const mentorCards: MentorCard[] = mentors.docs.map((doc) => {
    const rawStatus = text(doc.get('status'));
    const status = rawStatus === 'approved' || rawStatus === 'closed' ? rawStatus : 'pending';
    if (status === 'approved') stats.mentorships += 1;
    if (status === 'pending') stats.pendingMentors += 1;
    return {
      id: doc.id,
      mentorName: text(doc.get('mentorName')),
      studentName: text(doc.get('studentName')),
      status,
      moderated: doc.get('moderated') === true,
    };
  });
  return {
    stats,
    campaigns: cards,
    groups: groups.docs.map((doc) => ({
      id: doc.id,
      name: text(doc.get('name')) || doc.id,
      members: typeof doc.get('memberCount') === 'number' ? doc.get('memberCount') : 0,
    })),
    held: held.docs.map((doc) => ({
      id: doc.id,
      groupId: text(doc.get('groupId')),
      body: text(doc.get('body')).slice(0, 280),
      authorName: text(doc.get('authorName')),
      kind: doc.get('kind') === 'mentor' ? 'mentor' : 'post',
    })),
    mentors: mentorCards,
    updates: people.docs.flatMap((doc) => {
      const destination = text(doc.get('destination'));
      const job = text(doc.get('job'));
      if (!destination && !job) return [];
      return [{ name: text(doc.get('name')) || 'Alumnus', destination, job }];
    }).slice(0, 12),
    seatNote: SEAT_NOTE,
  };
}

async function userName(uid: string): Promise<string> {
  const user = await adminDb().doc(`users/${uid}`).get();
  return text(user.get('name')) || 'Alumnus';
}

export async function moderateHeldPost(input: {
  institutionId: string;
  queueId: string;
  release: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`institutions/${input.institutionId}/alumni_queue/${safeId(input.queueId)}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('status') !== 'held') return { error: 'That post is not waiting.' };
  const visible = input.release;
  const status = input.release ? 'released' : 'blocked';
  if (snap.get('kind') === 'yearbook') {
    const bookId = safeId(text(snap.get('bookId')));
    const signatureId = safeId(text(snap.get('signatureId')));
    if (bookId && signatureId) {
      await adminDb().doc(`institutions/${input.institutionId}/yearbooks/${bookId}/signatures/${signatureId}`).set({
        visible,
        queued: false,
        decision: input.release ? 'allow' : 'block',
      }, { merge: true });
    }
  } else if (snap.get('kind') === 'yearbook-memory') {
    const bookId = safeId(text(snap.get('bookId')));
    const memoryId = safeId(text(snap.get('memoryId')));
    if (bookId && memoryId) {
      await adminDb().doc(`institutions/${input.institutionId}/yearbooks/${bookId}/memories/${memoryId}`).set({
        visible,
        queued: false,
      }, { merge: true });
    }
  } else if (snap.get('kind') === 'feed') {
    const feedId = safeId(text(snap.get('feedId')));
    if (feedId) {
      await adminDb().doc(`alumni_feed/${feedId}`).set({ visible, queued: false }, { merge: true });
    }
  } else if (snap.get('kind') === 'feed-comment') {
    const feedId = safeId(text(snap.get('feedId')));
    const commentId = safeId(text(snap.get('commentId')));
    if (feedId && commentId) {
      await adminDb().doc(`alumni_feed/${feedId}/comments/${commentId}`).set({
        visible,
        queued: false,
      }, { merge: true });
    }
  } else if (snap.get('kind') === 'mentor') {
    const messageId = text(snap.get('messageId'));
    const mentorshipId = text(snap.get('mentorshipId'));
    if (messageId && mentorshipId) {
      await adminDb().doc(`institutions/${input.institutionId}/mentorships/${mentorshipId}/messages/${messageId}`).set({
        visible,
        decision: input.release ? 'allow' : 'block',
      }, { merge: true });
    }
  } else {
    const groupId = safeId(text(snap.get('groupId')));
    const postId = safeId(text(snap.get('postId')));
    if (groupId && postId) {
      await adminDb().doc(`institutions/${input.institutionId}/alumni_groups/${groupId}/posts/${postId}`).set({
        visible,
        queued: false,
        decision: input.release ? 'allow' : 'block',
      }, { merge: true });
    }
  }
  await ref.set({ status }, { merge: true });
  return { ok: true };
}

export async function approveMentorship(institutionId: string, mentorshipId: string): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`institutions/${institutionId}/mentorships/${safeId(mentorshipId)}`);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'Choose a mentorship.' };
  const student = await adminDb().doc(`users/${text(snap.get('studentId'))}`).get();
  const moderated = isMinorTier(asAgeTier(student.get('ageTier')));
  await ref.set({ status: 'approved', moderated }, { merge: true });
  return { ok: true };
}

export async function createAlumniEvent(input: {
  institutionId: string;
  title: unknown;
  when: unknown;
  place: unknown;
}): Promise<{ id: string } | { error: string }> {
  const title = clip(input.title, 120);
  if (!title) return { error: 'Name the event.' };
  const screened = screenPost(`${title} ${clip(input.place, 120)}`, 'adult');
  if (!screened.visible) return { error: 'Rewrite the event before it is published.' };
  const id = timeId('e');
  await adminDb().doc(`institutions/${input.institutionId}/alumni_events/${id}`).set({
    title,
    when: clip(input.when, 40),
    place: clip(input.place, 120),
    rsvpCount: 0,
    at: new Date().toISOString(),
  });
  return { id };
}

async function attendedDoc(uid: string, institutionId: string) {
  return adminDb().doc(`users/${uid}/attended/${institutionId}`).get();
}

async function ageOf(uid: string) {
  const user = await adminDb().doc(`users/${uid}`).get();
  return { user, tier: asAgeTier(user.get('ageTier')), name: text(user.get('name')) || 'Alumnus' };
}

export async function studentHome(uid: string, institutionId: string) {
  const attendedSnap = await adminDb().collection(`users/${uid}/attended`).limit(20).get();
  const attended = attendedSnap.docs.map((doc) => ({
    institutionId: doc.id,
    institutionName: text(doc.get('institutionName')),
    level: text(doc.get('level')),
    className: text(doc.get('className')),
    leftOn: text(doc.get('leftOn')),
    seatCounted: false,
    destination: text(doc.get('destination')),
    job: text(doc.get('job')),
    contact: text(doc.get('contact')),
  }));
  const inboxSnap = await adminDb().collection(`users/${uid}/inbox`).orderBy(FieldPath.documentId(), 'desc').limit(20).get();
  const inbox = inboxSnap.docs.map((doc) => ({
    id: doc.id,
    institutionId: text(doc.get('institutionId')),
    campaignId: text(doc.get('campaignId')),
    subject: text(doc.get('subject')),
    body: text(doc.get('body')),
    fromName: text(doc.get('fromName')),
    at: text(doc.get('at')),
  }));
  const chosen = safeId(institutionId) || attended[0]?.institutionId || '';
  if (!chosen || !attended.some((row) => row.institutionId === chosen)) {
    return { attended, inbox, network: null, seatNote: SEAT_NOTE };
  }
  const consent = await ensureConsent(uid, chosen);
  const profile = await ageOf(uid);
  const groupsSnap = await adminDb().collection(`institutions/${chosen}/alumni_groups`).limit(20).get();
  const groups: { id: string; name: string }[] = [];
  const directory: { name: string; level: string; className: string; destination: string }[] = [];
  const posts: { id: string; groupId: string; body: string; authorName: string; visible: boolean; queued: boolean }[] = [];
  for (const group of groupsSnap.docs) {
    const member = await group.ref.collection('members').doc(uid).get();
    if (!member.exists) continue;
    groups.push({ id: group.id, name: text(group.get('name')) || group.id });
    const members = await group.ref.collection('members').limit(40).get();
    for (const row of members.docs) {
      const shown = text(row.get('directoryName'));
      if (!shown) continue;
      const history = await adminDb().doc(`users/${row.id}/attended/${chosen}`).get();
      const entry = directoryEntry({
        directory: true,
        name: shown,
        level: text(group.get('level')),
        className: text(group.get('className')),
        destination: text(history.get('destination')),
      });
      if (entry && !directory.some((item) => item.name === entry.name && item.className === entry.className)) directory.push(entry);
    }
    const postSnap = await group.ref.collection('posts').orderBy(FieldPath.documentId(), 'desc').limit(20).get();
    for (const post of postSnap.docs) {
      const mine = post.get('authorId') === uid;
      const visible = post.get('visible') === true;
      if (!visible && !mine) continue;
      posts.push({
        id: post.id,
        groupId: group.id,
        body: text(post.get('body')),
        authorName: text(post.get('authorName')),
        visible,
        queued: post.get('queued') === true,
      });
    }
  }
  const eventsSnap = await adminDb().collection(`institutions/${chosen}/alumni_events`).orderBy(FieldPath.documentId(), 'desc').limit(20).get();
  const events = [];
  for (const event of eventsSnap.docs) {
    const rsvp = await event.ref.collection('rsvps').doc(uid).get();
    events.push({
      id: event.id,
      title: text(event.get('title')),
      when: text(event.get('when')),
      place: text(event.get('place')),
      going: rsvp.get('going') === true,
    });
  }
  const mentorSnap = await adminDb().collection(`users/${uid}/mentorships`).limit(20).get();
  const mentors = mentorSnap.docs
    .filter((doc) => text(doc.get('institutionId')) === chosen)
    .map((doc) => ({
      id: doc.id,
      status: text(doc.get('status')) || 'pending',
      moderated: doc.get('moderated') === true,
      mentorName: text(doc.get('mentorName')),
      studentName: text(doc.get('studentName')),
    }));
  return {
    attended,
    inbox,
    seatNote: SEAT_NOTE,
    network: {
      institutionId: chosen,
      consent: {
        email: consent.email,
        inbox: consent.inbox,
        push: consent.push,
        directory: consent.directory,
        messages: consent.messages,
        mentor: consent.mentor,
        unsubscribed: consent.unsubscribed,
      },
      adult: !isMinorTier(profile.tier),
      directory,
      groups,
      posts,
      events,
      mentors,
    },
  };
}

export async function saveAlumniConsent(uid: string, institutionId: string, patch: unknown): Promise<AlumniConsent | { error: string }> {
  if (!(await attendedDoc(uid, institutionId)).exists) return { error: 'This academy is not on your history.' };
  const next = readConsent({ ...(await ensureConsent(uid, institutionId)), ...(patch && typeof patch === 'object' ? patch : {}) });
  const profile = await ageOf(uid);
  if (isMinorTier(profile.tier)) next.mentor = false;
  if (isMinorTier(profile.tier)) next.messages = false;
  await adminDb().doc(`users/${uid}/alumni_consent/${institutionId}`).set(next, { merge: true });
  const groups = await adminDb().collection(`institutions/${institutionId}/alumni_groups`).limit(20).get();
  const directoryName = next.directory ? publicName(profile.name) : '';
  for (const group of groups.docs) {
    const member = group.ref.collection('members').doc(uid);
    if ((await member.get()).exists) await member.set({ directoryName }, { merge: true });
  }
  return next;
}

async function ownGroup(uid: string, institutionId: string, groupId: string) {
  const id = safeId(groupId);
  if (!id) return null;
  const member = await adminDb().doc(`institutions/${institutionId}/alumni_groups/${id}/members/${uid}`).get();
  return member.exists ? id : null;
}

export async function publishClassPost(input: {
  uid: string;
  institutionId: string;
  groupId: string;
  body: unknown;
}): Promise<{ id: string; visible: boolean; queued: boolean } | { error: string }> {
  if (!(await attendedDoc(input.uid, input.institutionId)).exists) return { error: 'This academy is not on your history.' };
  const groupId = await ownGroup(input.uid, input.institutionId, input.groupId);
  if (!groupId) return { error: 'Choose your class group.' };
  const profile = await ageOf(input.uid);
  const screened = screenPost(text(input.body), profile.tier);
  if (screened.decision === 'block') return { error: 'That post cannot be shared.' };
  const id = timeId('p');
  const authorName = publicName(profile.name);
  await adminDb().doc(`institutions/${input.institutionId}/alumni_groups/${groupId}/posts/${id}`).set({
    authorId: input.uid,
    authorName,
    body: clip(input.body, 2000),
    decision: screened.decision,
    reasons: screened.reasons,
    visible: screened.visible,
    queued: screened.queued,
    at: new Date().toISOString(),
  });
  if (screened.queued) {
    await adminDb().doc(`institutions/${input.institutionId}/alumni_queue/${id}`).set({
      status: 'held',
      kind: 'post',
      groupId,
      postId: id,
      authorId: input.uid,
      authorName,
      body: clip(input.body, 2000),
      at: new Date().toISOString(),
    });
  }
  return { id, visible: screened.visible, queued: screened.queued };
}

export async function rsvpAlumniEvent(input: {
  uid: string;
  institutionId: string;
  eventId: string;
  going: boolean;
}): Promise<{ ok: true } | { error: string }> {
  if (!(await attendedDoc(input.uid, input.institutionId)).exists) return { error: 'This academy is not on your history.' };
  const eventId = safeId(input.eventId);
  const ref = adminDb().doc(`institutions/${input.institutionId}/alumni_events/${eventId}`);
  const event = await ref.get();
  if (!event.exists) return { error: 'That event is not open.' };
  const rsvpRef = ref.collection('rsvps').doc(input.uid);
  const prior = await rsvpRef.get();
  const wasGoing = prior.get('going') === true;
  await rsvpRef.set({ going: input.going, at: new Date().toISOString() });
  if (input.going && !wasGoing) await ref.set({ rsvpCount: FieldValue.increment(1) }, { merge: true });
  if (!input.going && wasGoing) await ref.set({ rsvpCount: FieldValue.increment(-1) }, { merge: true });
  return { ok: true };
}

export async function reportAlumni(input: {
  uid: string;
  institutionId: string;
  targetId: unknown;
  postId: unknown;
  reason: unknown;
}): Promise<{ ok: true } | { error: string }> {
  if (!(await attendedDoc(input.uid, input.institutionId)).exists) return { error: 'This academy is not on your history.' };
  const screened = screenPost(text(input.reason) || 'Reported', 'adult');
  const reason = screened.decision === 'block' ? 'Reported' : clip(input.reason, 200) || 'Reported';
  await adminDb().collection(`institutions/${input.institutionId}/alumni_reports`).add({
    reporterId: input.uid,
    targetId: clip(input.targetId, 140),
    postId: clip(input.postId, 80),
    reason,
    at: new Date().toISOString(),
    status: 'open',
  });
  return { ok: true };
}

export async function blockAlumni(uid: string, otherId: string): Promise<{ ok: true } | { error: string }> {
  const other = safeId(otherId);
  if (!other || other === uid) return { error: 'Choose another person.' };
  await adminDb().doc(`users/${uid}/blocks/${other}`).set({ at: new Date().toISOString() });
  return { ok: true };
}

async function blockedEither(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    adminDb().doc(`users/${a}/blocks/${b}`).get(),
    adminDb().doc(`users/${b}/blocks/${a}`).get(),
  ]);
  return left.exists || right.exists;
}

export async function sendAlumniDirect(input: {
  uid: string;
  institutionId: string;
  otherId: string;
  body: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const otherId = safeId(input.otherId);
  if (!otherId) return { error: 'Choose a classmate.' };
  if (!(await attendedDoc(input.uid, input.institutionId)).exists) return { error: 'This academy is not on your history.' };
  if (!(await attendedDoc(otherId, input.institutionId)).exists) return { error: 'That person is not in this class network.' };
  const [me, them, meConsent, themConsent, blocked] = await Promise.all([
    ageOf(input.uid),
    ageOf(otherId),
    ensureConsent(input.uid, input.institutionId),
    ensureConsent(otherId, input.institutionId),
    blockedEither(input.uid, otherId),
  ]);
  const allowed = canDirectMessage(
    { id: input.uid, ageTier: me.tier, messages: meConsent.messages },
    { id: otherId, ageTier: them.tier, messages: themConsent.messages },
    blocked,
  );
  if (!allowed) return { error: 'Direct messages are for consenting adults.' };
  const screened = screenPost(text(input.body), 'adult');
  if (!screened.visible) return { error: 'Rewrite that message before it is sent.' };
  const id = timeId('d');
  const payload = { authorId: input.uid, body: clip(input.body, 2000), at: new Date().toISOString() };
  await adminDb().doc(`users/${input.uid}/alumni_threads/${otherId}`).set({
    otherId,
    otherName: publicName(them.name),
    institutionId: input.institutionId,
  }, { merge: true });
  await adminDb().doc(`users/${otherId}/alumni_threads/${input.uid}`).set({
    otherId: input.uid,
    otherName: publicName(me.name),
    institutionId: input.institutionId,
  }, { merge: true });
  await adminDb().doc(`users/${input.uid}/alumni_threads/${otherId}/messages/${id}`).set(payload);
  await adminDb().doc(`users/${otherId}/alumni_threads/${input.uid}/messages/${id}`).set(payload);
  await notifyUser({
    userId: otherId,
    title: `Note from ${publicName(me.name)}`,
    message: clip(input.body, 140),
    type: 'message',
    link: '/dashboard/student/network',
    pref: 'alumni',
    skipPush: !channelOpen(themConsent, 'push'),
  });
  return { ok: true };
}

async function openMentorship(input: {
  institutionId: string;
  mentorId: string;
  studentId: string;
}): Promise<{ id: string; pending: boolean; moderated: boolean } | { error: string }> {
  if (input.mentorId === input.studentId) return { error: 'Choose another person.' };
  const mentorAttended = await attendedDoc(input.mentorId, input.institutionId);
  if (!mentorAttended.exists) return { error: 'A mentor is an alumnus of this academy.' };
  const student = await adminDb().doc(`users/${input.studentId}`).get();
  if (text(student.get('institutionId')) !== input.institutionId) {
    return { error: 'Mentors are matched with current students of this academy.' };
  }
  const mentor = await ageOf(input.mentorId);
  const consent = await ensureConsent(input.mentorId, input.institutionId);
  const studentMinor = isMinorTier(asAgeTier(student.get('ageTier')));
  const decision = mentorDecision({
    mentorAdult: !isMinorTier(mentor.tier),
    mentorOptIn: consent.mentor,
    studentOptIn: true,
    institutionApproved: false,
    studentMinor,
  });
  if (!decision.pending) return { error: decision.reason };
  const mentorClean = input.mentorId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const studentClean = input.studentId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const id = `m-${mentorClean}-${studentClean}`.slice(0, 180);
  const studentName = publicName(text(student.get('name')) || 'Student');
  const mentorName = publicName(mentor.name);
  const payload = {
    institutionId: input.institutionId,
    mentorId: input.mentorId,
    studentId: input.studentId,
    mentorName,
    studentName,
    status: 'pending',
    moderated: decision.moderated,
    at: new Date().toISOString(),
  };
  await adminDb().doc(`institutions/${input.institutionId}/mentorships/${id}`).set(payload, { merge: true });
  await adminDb().doc(`users/${input.mentorId}/mentorships/${id}`).set(payload, { merge: true });
  await adminDb().doc(`users/${input.studentId}/mentorships/${id}`).set(payload, { merge: true });
  return { id, pending: true, moderated: decision.moderated };
}

export async function requestMentor(input: {
  uid: string;
  institutionId: string;
  mentorId: string;
}): Promise<{ id: string; pending: boolean; moderated: boolean } | { error: string }> {
  return openMentorship({ institutionId: input.institutionId, mentorId: safeId(input.mentorId), studentId: input.uid });
}

export async function offerMentorship(input: {
  uid: string;
  institutionId: string;
  studentId: string;
}): Promise<{ id: string; pending: boolean; moderated: boolean } | { error: string }> {
  if (!(await attendedDoc(input.uid, input.institutionId)).exists) return { error: 'This academy is not on your history.' };
  return openMentorship({ institutionId: input.institutionId, mentorId: input.uid, studentId: safeId(input.studentId) });
}

export async function sendMentorMessage(input: {
  uid: string;
  institutionId: string;
  mentorshipId: string;
  body: unknown;
}): Promise<{ id: string; visible: boolean } | { error: string }> {
  const ref = adminDb().doc(`institutions/${input.institutionId}/mentorships/${safeId(input.mentorshipId)}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('status') !== 'approved') return { error: 'The academy approves the match before messages.' };
  const mentorId = text(snap.get('mentorId'));
  const studentId = text(snap.get('studentId'));
  if (input.uid !== mentorId && input.uid !== studentId) return { error: 'This match is not yours.' };
  const profile = await ageOf(input.uid);
  const screened = screenPost(text(input.body), profile.tier);
  if (screened.decision === 'block') return { error: 'That message cannot be sent.' };
  const id = timeId('m');
  await ref.collection('messages').doc(id).set({
    authorId: input.uid,
    authorName: publicName(profile.name),
    body: clip(input.body, 2000),
    decision: screened.decision,
    visible: screened.visible,
    at: new Date().toISOString(),
  });
  if (screened.queued) {
    await adminDb().doc(`institutions/${input.institutionId}/alumni_queue/${id}`).set({
      status: 'held',
      kind: 'mentor',
      mentorshipId: ref.id,
      messageId: id,
      authorId: input.uid,
      authorName: publicName(profile.name),
      body: clip(input.body, 2000),
      at: new Date().toISOString(),
    });
  }
  return { id, visible: screened.visible };
}

export async function updateAlumniDestination(input: {
  uid: string;
  institutionId: string;
  destination: unknown;
  job: unknown;
  contact: unknown;
  country: unknown;
  kind: unknown;
  shareWithSchools: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const attended = await attendedDoc(input.uid, input.institutionId);
  if (!attended.exists) return { error: 'This academy is not on your history.' };
  const destination = clip(input.destination, 120);
  const job = clip(input.job, 80);
  const contact = clip(input.contact, 120);
  await attended.ref.set({ destination, job, contact, seatCounted: false, holdsSeat: false }, { merge: true });
  const alumniRef = adminDb().doc(`institutions/${input.institutionId}/alumni/${input.uid}`);
  if ((await alumniRef.get()).exists) {
    await alumniRef.set({ destination, job, contact }, { merge: true });
  }
  if (destination) {
    const saved = await recordStatedDestination(input.uid, {
      kind: text(input.kind) || 'work',
      name: destination,
      country: clip(input.country, 60),
      shareWithSchools: input.shareWithSchools,
      shareName: false,
      shareTestimonial: false,
    });
    if ('error' in saved) return saved;
  }
  return { ok: true };
}

export async function replyToCampaign(input: {
  uid: string;
  institutionId: string;
  campaignId: string;
  body: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const campaignId = safeId(input.campaignId);
  const campaign = await adminDb().doc(`alumni_outbox/${campaignId}`).get();
  if (!campaign.exists || text(campaign.get('institutionId')) !== input.institutionId) return { error: 'That note is not open.' };
  const receipt = await adminDb().doc(`alumni_outbox/${campaignId}/receipts/${input.uid}`).get();
  if (!receipt.exists) return { error: 'This note was not addressed to you.' };
  const profile = await ageOf(input.uid);
  const screened = screenPost(text(input.body), profile.tier);
  if (screened.decision === 'block') return { error: 'That reply cannot be sent.' };
  await adminDb().collection(`alumni_outbox/${campaignId}/replies`).add({
    studentId: input.uid,
    body: clip(input.body, 2000),
    decision: screened.decision,
    at: new Date().toISOString(),
  });
  await campaign.ref.set({ replies: FieldValue.increment(1) }, { merge: true });
  return { ok: true };
}

export async function recordCampaignSignal(token: string, kind: 'open' | 'click'): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(token)) return false;
  const pointer = await adminDb().doc(`alumni_receipts/${token}`).get();
  if (!pointer.exists) return false;
  const campaignId = text(pointer.get('campaignId'));
  const studentId = text(pointer.get('studentId'));
  const field = kind === 'click' ? 'clicked' : 'opened';
  await adminDb().runTransaction(async (tx) => {
    const receiptRef = adminDb().doc(`alumni_outbox/${campaignId}/receipts/${studentId}`);
    const campaignRef = adminDb().doc(`alumni_outbox/${campaignId}`);
    const receipt = await tx.get(receiptRef);
    if (!receipt.exists || receipt.get(field) === true) return;
    tx.set(receiptRef, { [field]: true }, { merge: true });
    tx.set(campaignRef, { [field]: FieldValue.increment(1) }, { merge: true });
  });
  return true;
}

export async function unsubscribeAlumni(token: string): Promise<{ institutionId: string } | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const pointer = await adminDb().doc(`alumni_unsubscribes/${token}`).get();
  if (!pointer.exists) return null;
  const studentId = text(pointer.get('studentId'));
  const institutionId = text(pointer.get('institutionId'));
  if (!studentId || !institutionId) return null;
  await adminDb().doc(`users/${studentId}/alumni_consent/${institutionId}`).set({ unsubscribed: true }, { merge: true });
  return { institutionId };
}

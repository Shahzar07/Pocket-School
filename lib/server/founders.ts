/**
 * Poket School Founders. Public matching is adult and opt-in.
 * TODO(institutions): programme mentors should reuse alumni mentoring when that collection exists.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { asAgeTier } from '../age-tier';
import { ActionError } from './actions';
import { reviewText } from './et-moderation';
import { automation } from './network';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import {
  mutualInterest, studentCanTeam, suggestPartners, type Commitment, type FounderCard, type FounderRole, type StartupStage,
} from '../founders/match';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const ROLES = new Set(['technical', 'business', 'design', 'domain']);
const COMMITMENTS = new Set(['full_time', 'part_time', 'exploring']);

async function requireFounders() {
  const settings = await automation();
  if (!settings.networkOn || !settings.foundersOn) throw new ActionError('FORBIDDEN', 'Poket School Founders is turned off.');
  return settings;
}

function asCard(id: string, data: FirebaseFirestore.DocumentData, ageTier: FounderCard['ageTier']): FounderCard {
  const roles = strList(data.roles).filter((role): role is FounderRole => ROLES.has(role));
  const looking = strList(data.lookingFor).filter((role): role is FounderRole => ROLES.has(role));
  return {
    id,
    ageTier,
    optIn: data.optIn === true,
    hasIdea: data.hasIdea === true,
    roles,
    commitment: COMMITMENTS.has(str(data.commitment)) ? str(data.commitment) as Commitment : 'exploring',
    location: str(data.location),
    remote: data.remote === true,
    timezone: str(data.timezone),
    industries: strList(data.industries),
    skills: Array.isArray(data.skills) ? data.skills.flatMap((skill: unknown) => {
      if (!skill || typeof skill !== 'object') return [];
      const row = skill as { name?: unknown; verified?: unknown };
      return typeof row.name === 'string' ? [{ name: row.name, verified: row.verified === true }] : [];
    }) : [],
    lookingFor: looking,
    stage: (['idea', 'building', 'launched', 'growing'].includes(str(data.stage)) ? str(data.stage) : 'idea') as StartupStage,
    institutionId: str(data.institutionId),
    classIds: strList(data.classIds),
  };
}

export async function saveFounder(uid: string, input: Record<string, unknown>) {
  await requireFounders();
  const user = await db().doc(`users/${uid}`).get();
  const ageTier = asAgeTier(user.data()?.ageTier);
  if (ageTier !== 'adult') throw new ActionError('FORBIDDEN', 'Public founder matching is for adults. Join a school entrepreneurship club instead.');
  const text = [str(input.idea), str(input.looking), str(input.links)].join('\n');
  const mod = await reviewText({
    surface: 'founder_profile',
    authorId: uid,
    authorName: str(user.data()?.name) || 'Member',
    ageTier,
    text,
    subjectPath: `founder_profiles/${uid}`,
    institutionId: str(user.data()?.institutionId),
  });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await db().doc(`founder_profiles/${uid}`).set({
    optIn: input.optIn === true,
    hasIdea: input.hasIdea === true,
    idea: str(input.idea).slice(0, 2000),
    roles: strList(input.roles).filter(role => ROLES.has(role)),
    commitment: COMMITMENTS.has(str(input.commitment)) ? str(input.commitment) : 'exploring',
    location: str(input.location).slice(0, 80),
    remote: input.remote === true,
    timezone: str(input.timezone).slice(0, 60),
    industries: strList(input.industries).slice(0, 8),
    skills: [],
    lookingFor: strList(input.lookingFor).filter(role => ROLES.has(role)),
    looking: str(input.looking).slice(0, 500),
    stage: str(input.stage) || 'idea',
    links: strList(input.links).slice(0, 6),
    ageTier,
    institutionId: str(user.data()?.institutionId),
    verifiedIdentity: user.data()?.emailVerified === true,
    moderation: mod.decision,
    disclaimer: 'Poket School does not vet investments.',
    updatedAtMs: Date.now(),
  }, { merge: true });
  return { moderation: mod.decision, authorMessage: mod.authorMessage };
}

export async function suggestions(uid: string) {
  await requireFounders();
  const mine = await db().doc(`founder_profiles/${uid}`).get();
  if (!mine.exists) return { suggestions: [] };
  const viewer = asCard(uid, mine.data() ?? {}, 'adult');
  const pool = await db().collection('founder_profiles').where('optIn', '==', true).where('ageTier', '==', 'adult').limit(40).get();
  const cards = pool.docs.filter(doc => doc.id !== uid).map(doc => asCard(doc.id, doc.data(), 'adult'));
  const hits = suggestPartners(viewer, cards);
  return {
    suggestions: hits.map(hit => ({
      ...hit,
      profile: pool.docs.find(doc => doc.id === hit.id)?.data() ?? null,
    })),
  };
}

export async function swipe(uid: string, targetId: string, choice: string) {
  await requireFounders();
  const interest = choice === 'interested' ? 'interested' : 'skip';
  await db().doc(`founder_swipes/${uid}_${targetId}`).set({ fromId: uid, toId: targetId, choice: interest, createdAtMs: Date.now() });
  const back = await db().doc(`founder_swipes/${targetId}_${uid}`).get();
  const matched = mutualInterest(interest, str(back.data()?.choice) as 'interested' | 'skip' | '');
  if (matched) {
    const pair = [uid, targetId].sort().join('_');
    await db().doc(`founder_matches/${pair}`).set({ userIds: [uid, targetId], createdAtMs: Date.now() });
    for (const id of [uid, targetId]) {
      try {
        await sendPush({
          recipientUid: id, category: 'network', title: 'New founder match', body: 'You both showed interest. You can message now.', link: '/dashboard/network/founders',
        }, { store: adminPushStore(), send: sendToDevice });
      } catch (error) {
        console.error('founder push skipped', error);
      }
    }
  }
  return { matched };
}

export async function founderMessage(uid: string, targetId: string, body: string) {
  await requireFounders();
  const pair = [uid, targetId].sort().join('_');
  const match = await db().doc(`founder_matches/${pair}`).get();
  if (!match.exists) throw new ActionError('FORBIDDEN', 'Message after you both show interest.');
  const user = await db().doc(`users/${uid}`).get();
  const ref = db().collection('founder_messages').doc();
  const mod = await reviewText({
    surface: 'founder_message',
    authorId: uid,
    authorName: str(user.data()?.name) || 'Member',
    ageTier: 'adult',
    text: body,
    subjectPath: `founder_messages/${ref.id}`,
  });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await ref.set({ fromId: uid, toId: targetId, body: body.slice(0, 2000), moderation: mod.decision, createdAtMs: Date.now() });
  return { id: ref.id, moderation: mod.decision, authorMessage: mod.authorMessage };
}

export async function saveStartup(uid: string, input: Record<string, unknown>) {
  await requireFounders();
  const user = await db().doc(`users/${uid}`).get();
  if (asAgeTier(user.data()?.ageTier) !== 'adult') throw new ActionError('FORBIDDEN', 'Startup pages are for adults.');
  const text = [str(input.problem), str(input.solution), str(input.name)].join('\n');
  const ref = str(input.id) ? db().doc(`startups/${str(input.id)}`) : db().collection('startups').doc();
  const mod = await reviewText({
    surface: 'startup_post',
    authorId: uid,
    authorName: str(user.data()?.name) || 'Member',
    ageTier: 'adult',
    text,
    subjectPath: `startups/${ref.id}`,
  });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  await ref.set({
    name: str(input.name).slice(0, 120),
    problem: str(input.problem).slice(0, 2000),
    solution: str(input.solution).slice(0, 2000),
    stage: str(input.stage) || 'idea',
    ownerId: uid,
    hiring: str(input.hiring).slice(0, 300),
    moderation: mod.decision,
    disclaimer: 'Poket School does not vet investments.',
    updatedAtMs: Date.now(),
  }, { merge: true });
  await db().doc(`startup_members/${ref.id}_${uid}`).set({ startupId: ref.id, userId: uid, role: 'founder' });
  if (str(input.hiring)) {
    await db().collection('job_openings').add({
      startupId: ref.id, title: str(input.hiring).slice(0, 140), kind: 'cofounder', status: 'open', postedBy: uid, createdAtMs: Date.now(),
    });
  }
  return { id: ref.id, moderation: mod.decision };
}

export async function applyStartup(uid: string, startupId: string, note: string) {
  await requireFounders();
  const mod = await reviewText({
    surface: 'startup_post', authorId: uid, authorName: 'Applicant', ageTier: 'adult', text: note, subjectPath: `startup_applications/pending`,
  });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  const ref = await db().collection('startup_applications').add({
    startupId, userId: uid, note: note.slice(0, 1000), status: 'submitted', moderation: mod.decision, createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function saveProgramme(uid: string, input: Record<string, unknown>) {
  await requireFounders();
  const user = await db().doc(`users/${uid}`).get();
  if (user.data()?.role !== 'admin' && user.data()?.role !== 'institution_admin' && user.data()?.role !== 'teacher') {
    throw new ActionError('FORBIDDEN', 'A school or organisation runs a programme.');
  }
  const ref = db().collection('founder_programmes').doc();
  await ref.set({
    orgId: str(input.orgId),
    name: str(input.name).slice(0, 140),
    kind: str(input.kind) || 'incubator',
    form: strList(input.questions).slice(0, 12),
    ownerId: uid,
    institutionId: str(user.data()?.institutionId),
    status: 'open',
    createdAtMs: Date.now(),
  });
  return { id: ref.id };
}

export async function applyProgramme(uid: string, programmeId: string, answers: unknown) {
  await requireFounders();
  const text = JSON.stringify(answers ?? '').slice(0, 2000);
  const mod = await reviewText({
    surface: 'founder_profile', authorId: uid, authorName: 'Applicant', ageTier: 'adult', text, subjectPath: `programme_applications/pending`,
  });
  if (mod.decision === 'block') throw new ActionError('FORBIDDEN', mod.authorMessage);
  const ref = await db().collection('programme_applications').add({
    programmeId, userId: uid, answers, status: 'submitted', moderation: mod.decision, createdAtMs: Date.now(),
  });
  return { id: ref.id, moderation: mod.decision };
}

export async function schoolTeam(uid: string, targetId: string) {
  const settings = await automation();
  if (!settings.networkOn) throw new ActionError('FORBIDDEN', 'The network is turned off.');
  const [a, b] = await Promise.all([db().doc(`users/${uid}`).get(), db().doc(`users/${targetId}`).get()]);
  const left = asCard(uid, { institutionId: a.data()?.institutionId, classIds: a.data()?.classIds, optIn: false }, asAgeTier(a.data()?.ageTier));
  const right = asCard(targetId, { institutionId: b.data()?.institutionId, classIds: b.data()?.classIds, optIn: false }, asAgeTier(b.data()?.ageTier));
  if (!studentCanTeam(left, right)) throw new ActionError('FORBIDDEN', 'School teams stay with classmates, with a teacher watching.');
  const pair = [uid, targetId].sort().join('_');
  await db().doc(`school_founder_teams/${pair}`).set({
    userIds: [uid, targetId], institutionId: str(a.data()?.institutionId), advisorRequired: true, createdAtMs: Date.now(),
  });
  return { id: pair };
}

export async function weeklyFounderDigest() {
  const settings = await automation();
  if (!settings.foundersOn) return { sent: 0 };
  const pool = await db().collection('founder_profiles').where('optIn', '==', true).limit(30).get();
  let sent = 0;
  for (const doc of pool.docs) {
    const hits = suggestPartners(asCard(doc.id, doc.data(), 'adult'), pool.docs.filter(other => other.id !== doc.id).map(other => asCard(other.id, other.data(), 'adult')));
    if (!hits.length) continue;
    await db().collection('safety_mail').add({
      userId: doc.id,
      subject: 'This week on Poket School Founders',
      body: `ET AI found ${hits.length} people who complement your profile.`,
      kind: 'founder_digest',
      status: 'queued',
      createdAtMs: Date.now(),
    });
    try {
      await sendPush({
        recipientUid: doc.id, category: 'network', title: 'Founder suggestions', body: 'New matches are ready.', link: '/dashboard/network/founders',
      }, { store: adminPushStore(), send: sendToDevice });
    } catch (error) {
      console.error('founder digest skipped', error);
    }
    sent += 1;
  }
  return { sent };
}

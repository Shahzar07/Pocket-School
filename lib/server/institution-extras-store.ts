import 'server-only';

import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { asAgeTier, type AgeTier } from '@/lib/age-tier';
import { publicName } from '@/lib/alumni';
import { channelOpen, readConsent } from '@/lib/alumni-network';
import {
  achievementPdf,
  albumOpen,
  canSeeOpening,
  draftEndorsement,
  givingIsOn,
  matchToApplication,
  parentBridgePlan,
  proveSkills,
  readBloom,
  readCampaign,
  readOpening,
  readOpportunity,
  readReunion,
  readSkillMap,
  readTalk,
  revokeEndorsement,
  sandboxGift,
  screenAlbumCaption,
  setEndorsementVisibility,
  setSkillVisibility,
  shareableCount,
  suggestOpportunities,
  talkVisibleToStudents,
  type CareerTalk,
  type Opportunity,
  type ProvenSkill,
  type ReunionPlan,
  type SchoolOpening,
  type SkillEvidence,
  type SkillMap,
  type TeacherEndorsement,
} from '@/lib/institution-extras';
import { adminDb } from '@/lib/firebase-admin';
import { shareTokenFrom } from '@/lib/linkedin';
import { notifyUser } from '@/lib/server/device-push';
import { sendInstitutionMail } from '@/lib/server/institution-mail';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function todayStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function idFor(prefix: string): string {
  return `${prefix}-${shareTokenFrom(randomBytes(8)).slice(0, 16)}`;
}

async function profileOf(uid: string): Promise<{ role: string; institutionId: string; alumniOf: string; name: string; ageTier: AgeTier; level: string; email: string }> {
  const user = await adminDb().doc(`users/${uid}`).get();
  return {
    role: text(user.get('role')),
    institutionId: text(user.get('institutionId')),
    alumniOf: text(user.get('alumniOf')),
    name: text(user.get('name')),
    ageTier: asAgeTier(user.get('ageTier')),
    level: text(user.get('level')),
    email: text(user.get('email')).toLowerCase(),
  };
}

async function schoolsFor(uid: string): Promise<string[]> {
  const profile = await profileOf(uid);
  const ids = new Set<string>();
  if (profile.institutionId) ids.add(profile.institutionId);
  if (profile.alumniOf) ids.add(profile.alumniOf);
  const attended = await adminDb().collection(`users/${uid}/attended`).limit(8).get();
  for (const doc of attended.docs) ids.add(doc.id);
  return [...ids];
}

async function sameSchool(uid: string, institutionId: string): Promise<boolean> {
  return (await schoolsFor(uid)).includes(institutionId);
}

async function pingAlumni(institutionId: string, title: string, message: string) {
  const people = await adminDb().collection(`institutions/${institutionId}/alumni`).limit(80).get();
  for (const person of people.docs) {
    const uid = text(person.get('studentId')) || person.id;
    if (!uid || uid.includes('@')) continue;
    const consent = readConsent((await adminDb().doc(`users/${uid}/alumni_consent/${institutionId}`).get()).data());
    if (!channelOpen(consent, 'push') && !channelOpen(consent, 'inbox')) continue;
    await notifyUser({
      userId: uid,
      title,
      message: message.slice(0, 180),
      type: 'announcement',
      link: '/dashboard/student/career',
      pref: 'alumni',
      skipPush: !channelOpen(consent, 'push'),
    });
  }
}

function skillFrom(id: string, data: Record<string, unknown> | undefined): ProvenSkill | null {
  if (!data) return null;
  const name = text(data.name).trim();
  if (!name) return null;
  const evidence = Array.isArray(data.evidence) ? data.evidence.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const kind = text(row.kind);
    if (kind !== 'lesson' && kind !== 'unit_test' && kind !== 'badge') return [];
    return [{
      kind,
      id: text(row.id),
      lessonId: text(row.lessonId),
      bloom: readBloom(row.bloom),
      label: text(row.label),
      url: text(row.url),
    } satisfies SkillEvidence];
  }) : [];
  return { id, name, visible: data.visible !== false, locked: true, evidence };
}

export async function learnerCareer(uid: string): Promise<Record<string, unknown>> {
  const profile = await profileOf(uid);
  const schools = await schoolsFor(uid);
  const [skills, endorsements, interests, openings, campaigns, reunions, talks, bridge] = await Promise.all([
    adminDb().collection(`users/${uid}/proven_skills`).limit(40).get(),
    adminDb().collection(`users/${uid}/endorsements`).limit(20).get(),
    adminDb().doc(`users/${uid}/career/profile`).get(),
    visibleOpenings(schools, false),
    visibleCampaigns(schools),
    visibleReunions(schools, false),
    visibleTalks(schools, false),
    adminDb().doc(`users/${uid}/parent_bridge/access`).get(),
  ]);
  const stated = Array.isArray(interests.get('interests')) ? interests.get('interests').filter((item: unknown) => typeof item === 'string') : [];
  const opportunities = await enteredOpportunities(schools);
  const scores = await verifiedScores(uid);
  return {
    schools,
    level: profile.level,
    interests: stated,
    skills: skills.docs.flatMap((doc) => {
      const skill = skillFrom(doc.id, doc.data());
      return skill ? [skill] : [];
    }),
    endorsements: endorsements.docs.flatMap((doc) => endorsementFrom(doc.id, doc.data()) ?? []),
    matches: suggestOpportunities({ interests: stated, level: profile.level, scores, opportunities }),
    openings,
    campaigns,
    reunions,
    talks,
    bridge: {
      consent: bridge.get('consent') === true,
      keepsPdf: parentBridgePlan({ ageTier: profile.ageTier, consent: bridge.get('consent') === true }).keepsPdf,
      needsConsent: parentBridgePlan({ ageTier: profile.ageTier, consent: bridge.get('consent') === true }).needsConsent,
    },
    note: 'ET AI matches opportunities an academy or a super admin entered. It does not invent one.',
  };
}

function endorsementFrom(id: string, data: Record<string, unknown> | undefined): TeacherEndorsement[] {
  if (!data || data.revoked === true) return [];
  const body = text(data.body).trim();
  if (!body) return [];
  return [{
    id,
    institutionId: text(data.institutionId),
    studentId: text(data.studentId),
    teacherId: text(data.teacherId),
    teacherName: text(data.teacherName) || 'Teacher',
    body,
    visible: data.visible !== false,
    revoked: false,
    locked: true,
  }];
}

async function verifiedScores(uid: string): Promise<{ title: string; score: string }[]> {
  const [grades, quizzes] = await Promise.all([
    adminDb().collection('grades').where('studentId', '==', uid).limit(30).get(),
    adminDb().collection('unit_quiz_attempts').where('studentId', '==', uid).limit(30).get(),
  ]);
  const scores: { title: string; score: string }[] = [];
  for (const doc of grades.docs) {
    const score = doc.get('score');
    const max = doc.get('maxScore');
    if (typeof score === 'number' && typeof max === 'number' && max > 0) scores.push({ title: text(doc.get('label')) || 'Assessment', score: `${score}/${max}` });
  }
  for (const doc of quizzes.docs) {
    if (typeof doc.get('percentage') === 'number') scores.push({ title: 'Unit test', score: `${Math.round(doc.get('percentage') as number)}%` });
  }
  return scores;
}

async function enteredOpportunities(schools: readonly string[]): Promise<Opportunity[]> {
  const snap = await adminDb().collection('opportunities').limit(80).get();
  return snap.docs.flatMap((doc) => {
    const read = readOpportunity({ ...doc.data(), id: doc.id }, text(doc.get('institutionId')));
    if ('error' in read) return [];
    if (read.institutionId && !schools.includes(read.institutionId)) return [];
    return [read];
  });
}

async function visibleOpenings(schools: readonly string[], staff: boolean): Promise<SchoolOpening[]> {
  if (!schools.length) return [];
  const rows: SchoolOpening[] = [];
  for (const institutionId of schools.slice(0, 4)) {
    const snap = await adminDb().collection(`institutions/${institutionId}/openings`).limit(40).get();
    for (const doc of snap.docs) {
      const read = readOpening({ ...doc.data(), id: doc.id }, institutionId);
      if ('error' in read) continue;
      const status = doc.get('status') === 'published' || doc.get('status') === 'rejected' ? doc.get('status') : 'pending';
      const opening = { ...read, status };
      if (canSeeOpening({ status: opening.status, sameSchool: true, staff })) rows.push(opening);
    }
  }
  return rows;
}

async function visibleCampaigns(schools: readonly string[]) {
  const rows: { id: string; institutionId: string; title: string; kind: string; goal: number; raised: number; currency: string; progress: number }[] = [];
  for (const institutionId of schools.slice(0, 4)) {
    const academy = await adminDb().doc(`institutions/${institutionId}`).get();
    if (!givingIsOn(academy.get('givingEnabled'))) continue;
    const snap = await adminDb().collection(`institutions/${institutionId}/campaigns`).limit(20).get();
    for (const doc of snap.docs) {
      const goal = typeof doc.get('goal') === 'number' ? doc.get('goal') : 0;
      const raised = typeof doc.get('raised') === 'number' ? doc.get('raised') : 0;
      const campaign = { id: doc.id, institutionId, title: text(doc.get('title')), kind: text(doc.get('kind')), goal, raised, currency: text(doc.get('currency')) || 'USD' };
      rows.push({ ...campaign, progress: campaign.goal > 0 ? Math.round((raised / goal) * 100) : 0 });
    }
  }
  return rows;
}

async function visibleReunions(schools: readonly string[], staff: boolean): Promise<(ReunionPlan & { publicRsvpCount: number | null })[]> {
  const rows: (ReunionPlan & { publicRsvpCount: number | null })[] = [];
  for (const institutionId of schools.slice(0, 4)) {
    const snap = await adminDb().collection(`institutions/${institutionId}/reunions`).limit(20).get();
    for (const doc of snap.docs) {
      const count = typeof doc.get('rsvpCount') === 'number' ? doc.get('rsvpCount') : 0;
      rows.push({
        id: doc.id,
        institutionId,
        title: text(doc.get('title')),
        when: text(doc.get('when')),
        place: text(doc.get('place')),
        ticketed: doc.get('ticketed') === true,
        price: typeof doc.get('price') === 'number' ? doc.get('price') : 0,
        currency: text(doc.get('currency')) || 'USD',
        wallOpenUntil: text(doc.get('wallOpenUntil')),
        bookId: text(doc.get('bookId')),
        rsvpCount: staff ? count : (shareableCount(count) ?? 0),
        publicRsvpCount: staff ? count : shareableCount(count),
      });
    }
  }
  return rows;
}

async function visibleTalks(schools: readonly string[], staff: boolean): Promise<CareerTalk[]> {
  const rows: CareerTalk[] = [];
  for (const institutionId of schools.slice(0, 4)) {
    const snap = await adminDb().collection(`institutions/${institutionId}/talks`).limit(20).get();
    for (const doc of snap.docs) {
      const talk: CareerTalk = {
        id: doc.id,
        institutionId,
        title: text(doc.get('title')),
        alumniId: text(doc.get('alumniId')),
        alumniName: text(doc.get('alumniName')),
        format: doc.get('format') === 'recorded' ? 'recorded' : 'live',
        provider: doc.get('provider') === 'zoom' || doc.get('provider') === 'meet' || doc.get('provider') === 'teams' ? doc.get('provider') : '',
        link: text(doc.get('link')),
        when: text(doc.get('when')),
        level: text(doc.get('level')),
        status: doc.get('status') === 'approved' || doc.get('status') === 'declined' ? doc.get('status') : 'proposed',
      };
      if (staff || talkVisibleToStudents(talk)) rows.push(talk);
    }
  }
  return rows;
}

export async function institutionCareer(institutionId: string): Promise<Record<string, unknown>> {
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  const givingEnabled = givingIsOn(academy.get('givingEnabled'));
  const [maps, opportunities, openings, campaigns, reunions, talks] = await Promise.all([
    adminDb().collection('skill_maps').where('institutionId', '==', institutionId).limit(40).get(),
    adminDb().collection('opportunities').where('institutionId', '==', institutionId).limit(40).get(),
    adminDb().collection(`institutions/${institutionId}/openings`).limit(40).get(),
    adminDb().collection(`institutions/${institutionId}/campaigns`).limit(20).get(),
    visibleReunions([institutionId], true),
    visibleTalks([institutionId], true),
  ]);
  return {
    givingEnabled,
    skills: maps.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    opportunities: opportunities.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    openings: openings.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    campaigns: campaigns.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    reunions,
    talks,
  };
}

export async function saveInterests(uid: string, interests: unknown): Promise<{ interests: string[] }> {
  const stated = Array.isArray(interests) ? interests.flatMap((item) => {
    const value = text(item).replace(/\s+/g, ' ').trim().slice(0, 40);
    return value ? [value] : [];
  }).slice(0, 12) : [];
  await adminDb().doc(`users/${uid}/career/profile`).set({ interests: stated }, { merge: true });
  return { interests: stated };
}

export async function saveSkillMap(actorId: string, institutionId: string, value: unknown, platform: boolean): Promise<SkillMap | { error: string }> {
  const read = readSkillMap(value, platform ? '' : institutionId);
  if ('error' in read) return read;
  await adminDb().doc(`skill_maps/${read.institutionId || 'platform'}_${read.id}`).set({ ...read, updatedBy: actorId });
  return read;
}

export async function refreshSkills(uid: string): Promise<ProvenSkill[]> {
  const schools = await schoolsFor(uid);
  const maps = await loadMaps(schools);
  const evidence = await loadEvidence(uid);
  const proven = proveSkills(maps, evidence);
  for (const skill of proven) {
    const ref = adminDb().doc(`users/${uid}/proven_skills/${skill.id}`);
    const existing = await ref.get();
    const previous = skillFrom(existing.id, existing.data());
    const next = setSkillVisibility(skill, previous ? previous.visible : true);
    await ref.set({ ...next, updatedAt: new Date().toISOString() });
  }
  return proven;
}

async function loadMaps(schools: readonly string[]): Promise<SkillMap[]> {
  const queries = [
    adminDb().collection('skill_maps').where('institutionId', '==', '').limit(40).get(),
    ...schools.slice(0, 4).map((institutionId) => adminDb().collection('skill_maps').where('institutionId', '==', institutionId).limit(40).get()),
  ];
  const snaps = await Promise.all(queries);
  const maps: SkillMap[] = [];
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const read = readSkillMap(doc.data(), text(doc.get('institutionId')));
      if (!('error' in read)) maps.push(read);
    }
  }
  return maps;
}

async function loadEvidence(uid: string): Promise<SkillEvidence[]> {
  const [attempts, badges, certificates] = await Promise.all([
    adminDb().collection('unit_quiz_attempts').where('studentId', '==', uid).limit(40).get(),
    adminDb().collection('badges').where('userId', '==', uid).limit(40).get(),
    adminDb().collection('certificates').where('studentId', '==', uid).limit(20).get(),
  ]);
  const evidence: SkillEvidence[] = [];
  const courseIds = new Set<string>();
  for (const doc of certificates.docs) {
    const courseId = text(doc.get('courseId'));
    if (courseId) courseIds.add(courseId);
  }
  for (const doc of attempts.docs) {
    if (doc.get('passed') !== true) continue;
    const lessonId = text(doc.get('lessonId'));
    const courseId = text(doc.get('courseId'));
    if (courseId) courseIds.add(courseId);
    let bloom = readBloom(doc.get('bloom'));
    if (!bloom && courseId && lessonId) {
      const lesson = await adminDb().doc(`courses/${courseId}/lessons/${lessonId}`).get();
      bloom = readBloom(lesson.get('blooms') ?? lesson.get('bloom'));
    }
    if (!lessonId) continue;
    const url = courseId ? `/dashboard/student/courses/${courseId}/lessons/${lessonId}` : '';
    evidence.push({ kind: 'unit_test', id: doc.id, lessonId, bloom, label: 'Unit test', url });
  }
  for (const courseId of courseIds) {
    const enrollment = await adminDb().doc(`courses/${courseId}/enrollments/${uid}`).get();
    const completed = Array.isArray(enrollment.get('completedLessons')) ? enrollment.get('completedLessons') : [];
    for (const lessonId of completed.filter((item: unknown): item is string => typeof item === 'string').slice(0, 40)) {
      evidence.push({
        kind: 'lesson',
        id: lessonId,
        lessonId,
        bloom: '',
        label: 'Lesson',
        url: `/dashboard/student/courses/${courseId}/lessons/${lessonId}`,
      });
    }
  }
  for (const doc of badges.docs) {
    const name = text(doc.get('name')).trim();
    if (!name) continue;
    evidence.push({
      kind: 'badge',
      id: doc.id,
      lessonId: '',
      bloom: '',
      label: name,
      url: `https://poketschool.ai/verify/badge/${encodeURIComponent(doc.id)}`,
    });
  }
  return evidence;
}

export async function hideSkill(uid: string, skillId: string, visible: boolean): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`users/${uid}/proven_skills/${skillId}`);
  const existing = skillFrom(skillId, (await ref.get()).data());
  if (!existing) return { error: 'That skill is not on this record yet.' };
  await ref.set({ visible: setSkillVisibility(existing, visible).visible }, { merge: true });
  return { ok: true };
}

export async function writeEndorsement(actorId: string, studentId: string, body: unknown): Promise<TeacherEndorsement | { error: string }> {
  const [teacher, student] = await Promise.all([profileOf(actorId), profileOf(studentId)]);
  if (teacher.role !== 'teacher' && teacher.role !== 'admin') return { error: 'A teacher writes this reference.' };
  const institutionId = student.institutionId || student.alumniOf;
  if (!institutionId || (teacher.role === 'teacher' && teacher.institutionId !== institutionId && teacher.institutionId !== student.institutionId)) {
    return { error: 'This student is not at your academy.' };
  }
  const draft = draftEndorsement({
    institutionId,
    studentId,
    teacherId: actorId,
    teacherName: teacher.name,
    teacherAge: teacher.ageTier,
    body,
  });
  if ('error' in draft) return draft;
  const id = idFor('ref');
  const saved = { ...draft, id };
  await adminDb().doc(`users/${studentId}/endorsements/${id}`).set({ ...saved, at: new Date().toISOString() });
  return saved;
}

export async function hideEndorsement(uid: string, id: string, visible: boolean): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`users/${uid}/endorsements/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('studentId') && snap.get('studentId') !== uid) return { error: 'That reference is not on this portfolio.' };
  if (snap.get('revoked') === true) return { error: 'The academy revoked this reference.' };
  const note = endorsementFrom(id, snap.data())[0];
  if (!note) return { error: 'That reference is not on this portfolio.' };
  await ref.set({ visible: setEndorsementVisibility(note, visible).visible, body: note.body }, { merge: true });
  return { ok: true };
}

export async function revokeSchoolEndorsement(institutionId: string, studentId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`users/${studentId}/endorsements/${id}`);
  const snap = await ref.get();
  if (!snap.exists || text(snap.get('institutionId')) !== institutionId) return { error: 'That reference is not from this academy.' };
  const note = endorsementFrom(id, snap.data())[0];
  if (!note) return { error: 'That reference is not from this academy.' };
  const revoked = revokeEndorsement(note);
  await ref.set({ revoked: true, visible: false, body: revoked.body }, { merge: true });
  return { ok: true };
}

export async function saveOpportunity(actorId: string, institutionId: string, value: unknown): Promise<Opportunity | { error: string }> {
  const read = readOpportunity(value, institutionId);
  if ('error' in read) return read;
  const id = read.id || idFor('opp');
  await adminDb().doc(`opportunities/${institutionId || 'platform'}_${id}`).set({ ...read, id, createdBy: actorId });
  return { ...read, id };
}

export async function saveMatch(uid: string, opportunityId: string, cvVersionId: string): Promise<{ id: string } | { error: string }> {
  const schools = await schoolsFor(uid);
  const opportunity = (await enteredOpportunities(schools)).find((row) => row.id === opportunityId);
  if (!opportunity) return { error: 'Choose an opportunity from the list.' };
  if (cvVersionId) {
    const version = await adminDb().doc(`users/${uid}/cv_versions/${cvVersionId}`).get();
    if (!version.exists) return { error: 'Choose a CV version from this portfolio.' };
  }
  const [profile, scores, interests] = await Promise.all([
    profileOf(uid),
    verifiedScores(uid),
    adminDb().doc(`users/${uid}/career/profile`).get(),
  ]);
  const stated = Array.isArray(interests.get('interests')) ? interests.get('interests').filter((item: unknown): item is string => typeof item === 'string') : [];
  const matched = suggestOpportunities({ interests: stated, level: profile.level, scores, opportunities: [opportunity] });
  if (!matched.length) return { error: 'ET AI did not match that opportunity from the entered list.' };
  const application = matchToApplication({ opportunity, today: todayStamp(), cvVersionId });
  const id = idFor('app');
  await adminDb().doc(`users/${uid}/applications/${id}`).set({ ...application, id, opportunityId: opportunity.id });
  return { id };
}

export async function postOpening(uid: string, institutionId: string, value: unknown): Promise<SchoolOpening | { error: string }> {
  if (!(await sameSchool(uid, institutionId))) return { error: 'This board is for this academy.' };
  const profile = await profileOf(uid);
  const opening = readOpening(value, institutionId);
  if ('error' in opening) return opening;
  const saved = {
    ...opening,
    id: idFor('job'),
    posterId: uid,
    posterRole: profile.role === 'institution_admin' ? 'partner' as const : 'alumni' as const,
  };
  await adminDb().doc(`institutions/${institutionId}/openings/${saved.id}`).set(saved);
  return saved;
}

export async function reviewOpening(institutionId: string, openingId: string, publish: boolean): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`institutions/${institutionId}/openings/${openingId}`);
  if (!(await ref.get()).exists) return { error: 'Choose an opening.' };
  await ref.set({ status: publish ? 'published' : 'rejected' }, { merge: true });
  return { ok: true };
}

export async function applyToOpening(uid: string, institutionId: string, openingId: string, cvVersionId: string): Promise<{ id: string } | { error: string }> {
  if (!(await sameSchool(uid, institutionId))) return { error: 'This board is for students and alumni of this academy.' };
  const openingSnap = await adminDb().doc(`institutions/${institutionId}/openings/${openingId}`).get();
  if (openingSnap.get('status') !== 'published') return { error: 'This opening is not open yet.' };
  if (cvVersionId) {
    const version = await adminDb().doc(`users/${uid}/cv_versions/${cvVersionId}`).get();
    if (!version.exists) return { error: 'Choose a CV version from this portfolio.' };
  }
  const id = idFor('app');
  await adminDb().doc(`users/${uid}/applications/${id}`).set({
    id,
    company: text(openingSnap.get('employer')),
    role: text(openingSnap.get('title')),
    link: text(openingSnap.get('url')),
    status: 'applied',
    date: todayStamp(),
    reminderOn: text(openingSnap.get('deadline')),
    deadline: text(openingSnap.get('deadline')),
    shareToken: '',
    cvVersionId,
    openingId,
  });
  return { id };
}

export async function setGiving(institutionId: string, enabled: boolean): Promise<{ givingEnabled: boolean }> {
  await adminDb().doc(`institutions/${institutionId}`).set({ givingEnabled: enabled === true }, { merge: true });
  return { givingEnabled: enabled === true };
}

export async function saveCampaign(institutionId: string, value: unknown): Promise<{ id: string } | { error: string }> {
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  const campaign = readCampaign(value, institutionId, givingIsOn(academy.get('givingEnabled')));
  if ('error' in campaign) return campaign;
  const id = idFor('gift');
  await adminDb().doc(`institutions/${institutionId}/campaigns/${id}`).set(campaign);
  return { id };
}

export async function giveToCampaign(uid: string, institutionId: string, campaignId: string, amount: number): Promise<{ receipt: string } | { error: string }> {
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  if (!givingIsOn(academy.get('givingEnabled'))) return { error: 'Alumni giving is off for this academy.' };
  if (!(await sameSchool(uid, institutionId))) return { error: 'This campaign is for this academy.' };
  const ref = adminDb().doc(`institutions/${institutionId}/campaigns/${campaignId}`);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'Choose a campaign.' };
  const giftId = idFor('receipt');
  const gift = sandboxGift({ amount, currency: text(snap.get('currency')) || 'USD', id: giftId });
  if ('error' in gift) return gift;
  const raised = (typeof snap.get('raised') === 'number' ? snap.get('raised') : 0) + Math.round(amount);
  await ref.set({ raised }, { merge: true });
  await ref.collection('gifts').doc(giftId).set({
    id: giftId,
    uid,
    amount: Math.round(amount),
    sandbox: true,
    receipt: gift.receipt,
    at: new Date().toISOString(),
  });
  const profile = await profileOf(uid);
  if (profile.email) await sendInstitutionMail(profile.email, { subject: 'Sandbox receipt', text: gift.receipt });
  return { receipt: gift.receipt };
}

export async function saveReunion(institutionId: string, value: unknown): Promise<ReunionPlan | { error: string }> {
  const reunion = readReunion(value, institutionId);
  if ('error' in reunion) return reunion;
  const id = idFor('event');
  const saved = { ...reunion, id };
  await adminDb().doc(`institutions/${institutionId}/reunions/${id}`).set(saved);
  await pingAlumni(institutionId, saved.title, 'A reunion is open for RSVPs.');
  return saved;
}

export async function rsvpReunion(uid: string, institutionId: string, reunionId: string, going: boolean): Promise<{ ok: true; publicRsvpCount: number | null } | { error: string }> {
  if (!(await sameSchool(uid, institutionId))) return { error: 'This reunion is for this academy.' };
  const ref = adminDb().doc(`institutions/${institutionId}/reunions/${reunionId}`);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'Choose a reunion.' };
  const rsvp = ref.collection('rsvps').doc(uid);
  const existing = await rsvp.get();
  if (going && !existing.exists) {
    await rsvp.set({ going: true, at: new Date().toISOString() });
    await ref.set({ rsvpCount: FieldValue.increment(1) }, { merge: true });
  }
  if (!going && existing.exists) {
    await rsvp.delete();
    await ref.set({ rsvpCount: FieldValue.increment(-1) }, { merge: true });
  }
  const count = typeof (await ref.get()).get('rsvpCount') === 'number' ? (await ref.get()).get('rsvpCount') as number : 0;
  return { ok: true, publicRsvpCount: shareableCount(count) };
}

export async function buyReunionTicket(uid: string, institutionId: string, reunionId: string): Promise<{ receipt: string } | { error: string }> {
  const ref = adminDb().doc(`institutions/${institutionId}/reunions/${reunionId}`);
  const snap = await ref.get();
  if (snap.get('ticketed') !== true) return { error: 'This reunion has no ticket.' };
  const gift = sandboxGift({ amount: typeof snap.get('price') === 'number' ? snap.get('price') : 0, currency: text(snap.get('currency')) || 'USD', id: idFor('ticket') });
  if ('error' in gift) return gift;
  await ref.collection('tickets').doc(uid).set({ sandbox: true, receipt: gift.receipt, at: new Date().toISOString() });
  return { receipt: gift.receipt };
}

export async function addReunionPhoto(uid: string, institutionId: string, reunionId: string, caption: unknown, url: unknown): Promise<{ id: string; queued: boolean } | { error: string }> {
  const profile = await profileOf(uid);
  const ref = adminDb().doc(`institutions/${institutionId}/reunions/${reunionId}`);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'Choose a reunion.' };
  if (!albumOpen(todayStamp(), text(snap.get('when')))) return { error: 'The album opens after the reunion.' };
  const note = text(caption).slice(0, 160);
  const screened = screenAlbumCaption(note, profile.ageTier);
  if (!screened.ok) return { error: screened.reason };
  const link = text(url);
  if (link && !/^https:\/\//i.test(link)) return { error: 'A photo link starts with https://' };
  const id = idFor('photo');
  await ref.collection('album').doc(id).set({
    caption: note,
    url: link,
    authorId: uid,
    visible: !screened.queued,
    queued: screened.queued,
    at: new Date().toISOString(),
  });
  return { id, queued: screened.queued };
}

export async function reopenWall(institutionId: string, reunionId: string): Promise<{ wallOpenUntil: string } | { error: string }> {
  const reunion = await adminDb().doc(`institutions/${institutionId}/reunions/${reunionId}`).get();
  if (!reunion.exists) return { error: 'Choose a reunion.' };
  const until = text(reunion.get('wallOpenUntil')) || text(reunion.get('when'));
  const bookId = text(reunion.get('bookId'));
  if (bookId) {
    await adminDb().doc(`institutions/${institutionId}/yearbooks/${bookId}`).set({ wallOpenUntil: until }, { merge: true });
  } else {
    const books = await adminDb().collection(`institutions/${institutionId}/yearbooks`).limit(5).get();
    for (const book of books.docs) await book.ref.set({ wallOpenUntil: until }, { merge: true });
  }
  await pingAlumni(institutionId, 'The signing wall is open', 'The yearbook signing wall is open again for this reunion.');
  return { wallOpenUntil: until };
}

export async function proposeTalk(uid: string, institutionId: string, value: unknown): Promise<CareerTalk | { error: string }> {
  const profile = await profileOf(uid);
  if (profile.alumniOf !== institutionId && profile.institutionId !== institutionId) return { error: 'A talk is booked through your academy.' };
  if (profile.ageTier !== 'adult') return { error: 'A career talk is given by an adult.' };
  const talk = readTalk(value, institutionId);
  if ('error' in talk) return talk;
  const saved: CareerTalk = { ...talk, id: idFor('talk'), alumniId: uid, alumniName: publicName(profile.name) || 'Alumnus' };
  await adminDb().doc(`institutions/${institutionId}/talks/${saved.id}`).set(saved);
  return saved;
}

export async function reviewTalkRequest(institutionId: string, talkId: string, approve: boolean): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`institutions/${institutionId}/talks/${talkId}`);
  if (!(await ref.get()).exists) return { error: 'Choose a talk.' };
  await ref.set({ status: approve ? 'approved' : 'declined' }, { merge: true });
  return { ok: true };
}

export async function setParentConsent(uid: string, consent: boolean): Promise<{ keepsPdf: boolean }> {
  const profile = await profileOf(uid);
  const plan = parentBridgePlan({ ageTier: profile.ageTier, consent, studentName: profile.name });
  await adminDb().doc(`users/${uid}/parent_bridge/access`).set({
    consent: consent === true,
    keepsPdf: plan.keepsPdf,
    needsConsent: plan.needsConsent,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return { keepsPdf: plan.keepsPdf };
}

export async function parentAchievementPdf(actorId: string, studentId: string): Promise<{ pdf: Uint8Array } | { error: string }> {
  const target = studentId || actorId;
  const student = await profileOf(target);
  const bridge = await adminDb().doc(`users/${target}/parent_bridge/access`).get();
  const plan = parentBridgePlan({ ageTier: student.ageTier, consent: bridge.get('consent') === true, studentName: student.name });
  if (actorId !== target) {
    const parent = await adminDb().doc(`users/${actorId}`).get();
    const children = Array.isArray(parent.get('childIds')) ? parent.get('childIds') : [];
    if (!children.includes(target)) return { error: 'A linked parent can read this summary.' };
    if (!plan.keepsPdf) return { error: plan.line };
  }
  const certificates = await adminDb().collection('certificates').where('studentId', '==', target).limit(12).get();
  const lines = [
    'Poket School achievement summary',
    student.name,
    student.level,
    ...certificates.docs.map((doc) => text(doc.get('courseTitle')) || text(doc.get('moduleTitle'))).filter(Boolean),
  ];
  return { pdf: achievementPdf(lines) };
}

export async function provenSkillItemsFor(uid: string): Promise<{ id: string; name: string; visible: boolean; evidence: { label: string; url: string }[] }[]> {
  const snap = await adminDb().collection(`users/${uid}/proven_skills`).limit(40).get();
  return snap.docs.flatMap((doc) => {
    const skill = skillFrom(doc.id, doc.data());
    if (!skill || !skill.visible) return [];
    return [{ id: skill.id, name: skill.name, visible: true, evidence: skill.evidence.map((item) => ({ label: item.label, url: item.url })) }];
  });
}

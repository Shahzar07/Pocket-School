import 'server-only';

import { adminDb } from '../firebase-admin';
import { asAgeTier, type AgeTier } from '../age-tier';
import { publicName } from '../alumni';
import {
  detectDestination,
  readDestinationKind,
  stateDestination,
  destinationBoard,
  type DestinationBoard,
  type DestinationChoice,
  type DestinationKind,
  type DestinationRow,
} from '../destinations';
import { type EducationSpan, openEducation, rememberClosed } from '../lifelong';
import {
  canPublishPortfolio,
  cvLines,
  cvPdf,
  defaultConsent,
  etSummary,
  linkedInText,
  portfolioJson,
  portfolioNudges,
  publicPortfolioView,
  readTemplate,
  sectionForKind,
  selfItem,
  verifiedItems,
  visibleItems,
  SECTION_IDS,
  type CvTemplate,
  type PortfolioConsent,
  type RecordItem,
} from '../portfolio';
import { logAutomation } from './automation-store';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function whenOf(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  return '';
}

function safeId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('/')) return '';
  return trimmed.slice(0, 120);
}

function spanFrom(id: string, data: Record<string, unknown> | undefined): EducationSpan | null {
  const institutionId = safeId(text(data?.institutionId) || id);
  if (!institutionId) return null;
  return {
    institutionId,
    institutionName: text(data?.institutionName).trim() || 'Academy',
    level: text(data?.level).trim(),
    from: text(data?.from).slice(0, 10),
    to: text(data?.to).slice(0, 10),
    studentNumber: text(data?.studentNumber).trim().toUpperCase(),
  };
}

export async function loadEducation(uid: string): Promise<EducationSpan[]> {
  if (!uid) return [];
  const snap = await adminDb().collection(`users/${uid}/education`).limit(50).get();
  return snap.docs.flatMap((doc) => {
    const span = spanFrom(doc.id, doc.data());
    return span ? [span] : [];
  });
}

async function writeSpans(uid: string, spans: readonly EducationSpan[]): Promise<void> {
  for (const span of spans) {
    const institutionId = safeId(span.institutionId);
    if (!institutionId) continue;
    await adminDb().doc(`users/${uid}/education/${institutionId}`).set({ ...span, institutionId });
  }
}

export async function openEducationSpan(
  uid: string,
  next: { institutionId: string; institutionName: string; level: string; studentNumber: string },
  today: string,
): Promise<EducationSpan[]> {
  const institutionId = safeId(next.institutionId);
  if (!uid || !institutionId) return [];
  const history = await loadEducation(uid);
  const spans = openEducation(history, { ...next, institutionId }, today);
  await writeSpans(uid, spans);
  const kept = spans.find((span) => span.studentNumber)?.studentNumber ?? '';
  const name = next.institutionName.trim() || 'Academy';
  await logAutomation({
    rule: 'learner_record',
    outcome: 'auto',
    summary: kept
      ? `Student number ${kept} now includes ${name}. Earlier history stays.`
      : `${name} was added to the learner record. Earlier history stays.`,
    actorId: uid,
    refId: institutionId,
  });
  return spans;
}

export async function closeEducationSpan(
  uid: string,
  institutionId: string,
  today: string,
  fallback?: { institutionName: string; level: string; studentNumber: string },
): Promise<void> {
  const id = safeId(institutionId);
  if (!uid || !id) return;
  const history = await loadEducation(uid);
  const spans = rememberClosed(history, {
    institutionId: id,
    institutionName: fallback?.institutionName ?? 'Academy',
    level: fallback?.level ?? '',
    studentNumber: fallback?.studentNumber ?? '',
  }, today);
  if (!history.some((span) => span.institutionId === id) && !fallback) return;
  await writeSpans(uid, spans);
}

function consentFrom(data: Record<string, unknown> | undefined): PortfolioConsent {
  const consent = defaultConsent();
  if (!data) return consent;
  consent.publicPortfolio = data.publicPortfolio === true;
  consent.parentApproved = data.parentApproved === true;
  consent.sharePortfolioWithSchools = data.sharePortfolioWithSchools === true;
  consent.shareDestinationWithSchools = data.shareDestinationWithSchools === true;
  consent.includeScores = data.includeScores === true;
  consent.template = readTemplate(data.template);
  const sections = data.sections;
  if (sections && typeof sections === 'object') {
    for (const id of SECTION_IDS) {
      const value = (sections as Record<string, unknown>)[id];
      if (value === 'private' || value === 'schools' || value === 'public') consent.sections[id] = value;
    }
  }
  return consent;
}

function itemFrom(id: string, data: Record<string, unknown> | undefined): RecordItem | null {
  if (!data || data.source !== 'self_reported') return null;
  const title = text(data.title).trim();
  if (!title) return null;
  const kind = text(data.kind);
  return {
    id,
    source: 'self_reported',
    kind,
    title,
    detail: text(data.detail),
    when: text(data.when),
    verifyUrl: '',
    evidenceLink: text(data.evidenceLink),
    section: text(data.section) || sectionForKind(kind),
  };
}

async function scoreLines(uid: string): Promise<{ title: string; score: string }[]> {
  const [grades, quizzes] = await Promise.all([
    adminDb().collection('grades').where('studentId', '==', uid).limit(30).get(),
    adminDb().collection('unit_quiz_attempts').where('studentId', '==', uid).limit(30).get(),
  ]);
  const lines: { title: string; score: string }[] = [];
  for (const doc of grades.docs) {
    const score = doc.get('score');
    const maxScore = doc.get('maxScore');
    if (typeof score !== 'number' || typeof maxScore !== 'number') continue;
    const title = text(doc.get('label')) || 'Assessment';
    lines.push({ title, score: `${score}/${maxScore}` });
  }
  for (const doc of quizzes.docs) {
    const percentage = doc.get('percentage');
    if (typeof percentage !== 'number') continue;
    const title = text(doc.get('unitId')) ? `Unit test ${text(doc.get('unitId'))}` : 'Unit test';
    lines.push({ title, score: `${Math.round(percentage)}%` });
  }
  return lines;
}

export interface BuiltPortfolio {
  name: string;
  studentNumber: string;
  ageTier: AgeTier;
  consent: PortfolioConsent;
  items: RecordItem[];
  summary: string;
  bullets: string[];
  nudges: string[];
  publication: { public: boolean; reason: string };
}

export async function buildPortfolio(uid: string): Promise<BuiltPortfolio> {
  const userRef = adminDb().doc(`users/${uid}`);
  const [user, education, profile, selfSnap, certificates, badges, projects, endorsements] = await Promise.all([
    userRef.get(),
    loadEducation(uid),
    adminDb().doc(`users/${uid}/portfolio/profile`).get(),
    adminDb().collection(`users/${uid}/portfolio_items`).limit(80).get(),
    adminDb().collection('certificates').where('studentId', '==', uid).limit(100).get(),
    adminDb().collection('badges').where('userId', '==', uid).limit(100).get(),
    adminDb().collection(`users/${uid}/studio_projects`).limit(20).get(),
    adminDb().collection(`users/${uid}/endorsements`).limit(20).get(),
  ]);
  const consent = consentFrom(profile.data());
  const savedSummary = text(profile.get('summary'));
  const savedBullets = Array.isArray(profile.get('bullets'))
    ? profile.get('bullets').filter((item: unknown): item is string => typeof item === 'string')
    : [];
  const courseTitles = new Map<string, string>();
  const certificateItems: { id: string; title: string; when?: string }[] = [];
  for (const doc of certificates.docs) {
    if (doc.get('status') === 'revoked') continue;
    const title = text(doc.get('courseTitle')) || text(doc.get('moduleTitle'));
    if (!title) continue;
    certificateItems.push({ id: doc.id, title, when: whenOf(doc.get('issuedAt')) });
    if (!courseTitles.has(title)) courseTitles.set(title, whenOf(doc.get('issuedAt')));
  }
  const scores = consent.includeScores ? await scoreLines(uid) : [];
  const verified = verifiedItems({
    education,
    courses: [...courseTitles.entries()].map(([title, when]) => ({ title, when })),
    scores,
    certificates: certificateItems,
    badges: badges.docs.flatMap((doc) => {
      const title = text(doc.get('name')).trim();
      return title ? [{ title }] : [];
    }),
    projects: projects.docs.flatMap((doc) => {
      const title = text(doc.get('title')).trim();
      return title ? [{ title, detail: text(doc.get('detail')) }] : [];
    }),
    endorsements: endorsements.docs.flatMap((doc) => {
      const title = text(doc.get('title')).trim();
      return title ? [{ title, detail: text(doc.get('detail')) }] : [];
    }),
    includeScores: consent.includeScores,
  });
  const selfItems = selfSnap.docs.flatMap((doc) => {
    const item = itemFrom(doc.id, doc.data());
    return item ? [item] : [];
  });
  const items = [...verified, ...selfItems];
  const selfTitles = new Set(selfItems.map((item) => item.title.toLowerCase()));
  const nudges = portfolioNudges(
    verified
      .filter((item) => (item.kind === 'certificate' || item.kind === 'badge' || item.kind === 'course') && !selfTitles.has(item.title.toLowerCase()))
      .slice(0, 4)
      .map((item) => ({ title: item.title })),
  );
  const ageTier = asAgeTier(user.get('ageTier'));
  const name = text(user.get('name'));
  return {
    name,
    studentNumber: text(user.get('studentNumber')).trim().toUpperCase(),
    ageTier,
    consent,
    items,
    summary: savedSummary,
    bullets: savedBullets,
    nudges,
    publication: canPublishPortfolio({
      ageTier,
      wantsPublic: consent.publicPortfolio,
      parentApproved: consent.parentApproved,
    }),
  };
}

async function syncPublic(uid: string, built: BuiltPortfolio): Promise<void> {
  const number = built.studentNumber.trim().toUpperCase();
  const view = publicPortfolioView({
    name: built.name,
    studentNumber: number,
    items: built.items,
    consent: built.consent,
    ageTier: built.ageTier,
    summary: built.summary,
  });
  if (!number) return;
  if (!view) {
    await adminDb().doc(`portfolio_public/${number}`).delete();
    return;
  }
  await adminDb().doc(`portfolio_public/${number}`).set({
    name: view.name,
    studentNumber: view.studentNumber,
    summary: view.summary,
    qrUrl: view.qrUrl,
    items: view.items.map((item) => ({
      source: item.source,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      when: item.when,
      verifyUrl: item.verifyUrl,
      section: item.section,
    })),
  });
}

export async function readPublicPortfolio(studentNumber: string): Promise<{
  name: string;
  studentNumber: string;
  summary: string;
  qrUrl: string;
  items: { source: string; title: string; detail: string; when: string; verifyUrl: string }[];
} | null> {
  const number = studentNumber.trim().toUpperCase();
  if (!number) return null;
  const snap = await adminDb().doc(`portfolio_public/${number}`).get();
  if (!snap.exists) return null;
  const items = Array.isArray(snap.get('items')) ? snap.get('items') : [];
  return {
    name: publicName(text(snap.get('name'))),
    studentNumber: number,
    summary: text(snap.get('summary')).slice(0, 400),
    qrUrl: `https://poketschool.ai/portfolio/${number}`,
    items: items.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const title = text(row.title).trim();
      if (!title) return [];
      return [{
        source: row.source === 'self_reported' ? 'self_reported' : 'verified',
        title: title.slice(0, 120),
        detail: text(row.detail).slice(0, 280),
        when: text(row.when).slice(0, 40),
        verifyUrl: text(row.verifyUrl).startsWith('https://poketschool.ai/verify/') ? text(row.verifyUrl) : '',
      }];
    }).slice(0, 40),
  };
}

export async function saveSelfItem(uid: string, input: {
  id?: string;
  kind: string;
  title: string;
  detail?: string;
  when?: string;
  evidenceLink?: string;
  evidencePath?: string;
}): Promise<RecordItem | { error: string }> {
  const made = selfItem(input);
  if ('error' in made) return made;
  const evidencePath = (input.evidencePath ?? '').trim().slice(0, 240);
  if (evidencePath && !evidencePath.startsWith(`media/${uid}/portfolio/`)) {
    return { error: 'Evidence files stay in your portfolio folder.' };
  }
  if (!safeId(made.id)) return { error: 'Choose a title.' };
  await adminDb().doc(`users/${uid}/portfolio_items/${made.id}`).set({
    ...made,
    evidencePath,
    userId: uid,
  });
  return made;
}

export async function deleteSelfItem(uid: string, id: string): Promise<{ deleted: boolean } | { error: string }> {
  const itemId = safeId(id);
  if (!itemId) return { error: 'Choose an item.' };
  const ref = adminDb().doc(`users/${uid}/portfolio_items/${itemId}`);
  const snap = await ref.get();
  if (!snap.exists) return { deleted: false };
  if (snap.get('source') !== 'self_reported') return { error: 'Verified lines stay on the record.' };
  await ref.delete();
  return { deleted: true };
}

export async function saveConsent(uid: string, input: {
  publicPortfolio?: boolean;
  sharePortfolioWithSchools?: boolean;
  shareDestinationWithSchools?: boolean;
  includeScores?: boolean;
  template?: string;
  sections?: Record<string, unknown>;
}): Promise<PortfolioConsent> {
  const current = await adminDb().doc(`users/${uid}/portfolio/profile`).get();
  const consent = consentFrom(current.data());
  if (typeof input.publicPortfolio === 'boolean') consent.publicPortfolio = input.publicPortfolio;
  if (typeof input.sharePortfolioWithSchools === 'boolean') consent.sharePortfolioWithSchools = input.sharePortfolioWithSchools;
  if (typeof input.shareDestinationWithSchools === 'boolean') consent.shareDestinationWithSchools = input.shareDestinationWithSchools;
  if (typeof input.includeScores === 'boolean') consent.includeScores = input.includeScores;
  if (input.template !== undefined) consent.template = readTemplate(input.template);
  if (input.sections) {
    for (const id of SECTION_IDS) {
      const value = input.sections[id];
      if (value === 'private' || value === 'schools' || value === 'public') consent.sections[id] = value;
    }
  }
  await adminDb().doc(`users/${uid}/portfolio/profile`).set({
    ...consent,
    summary: text(current.get('summary')),
    bullets: Array.isArray(current.get('bullets')) ? current.get('bullets') : [],
  });
  await applyDestinationSharing(uid, consent.shareDestinationWithSchools);
  const built = await buildPortfolio(uid);
  await syncPublic(uid, built);
  return consent;
}

export async function parentApprove(parentUid: string, studentUid: string): Promise<{ approved: true } | { error: string }> {
  const studentId = safeId(studentUid);
  if (!parentUid || !studentId) return { error: 'Choose the learner.' };
  const parent = await adminDb().doc(`users/${parentUid}`).get();
  const childIds = Array.isArray(parent.get('childIds')) ? parent.get('childIds') : [];
  if (!childIds.includes(studentId)) return { error: 'A linked parent approves a public portfolio.' };
  await adminDb().doc(`users/${studentId}/portfolio/profile`).set({ parentApproved: true }, { merge: true });
  const built = await buildPortfolio(studentId);
  await syncPublic(studentId, built);
  return { approved: true };
}

export async function saveReviewedSummary(uid: string): Promise<{ summary: string; bullets: string[] }> {
  const built = await buildPortfolio(uid);
  const visible = visibleItems({ items: built.items, consent: built.consent, audience: 'self', ageTier: built.ageTier });
  const draft = etSummary({ name: built.name, items: visible });
  await adminDb().doc(`users/${uid}/portfolio/profile`).set({
    summary: draft.summary,
    bullets: draft.bullets,
  }, { merge: true });
  const next = { ...built, summary: draft.summary, bullets: draft.bullets };
  await syncPublic(uid, next);
  return { summary: draft.summary, bullets: draft.bullets };
}

export async function previewSummary(uid: string): Promise<{ summary: string; bullets: string[]; fromRecord: true; invented: false }> {
  const built = await buildPortfolio(uid);
  const visible = visibleItems({ items: built.items, consent: built.consent, audience: 'self', ageTier: built.ageTier });
  return etSummary({ name: built.name, items: visible });
}

export async function exportPortfolio(uid: string, format: 'json' | 'linkedin' | 'cv', template?: CvTemplate): Promise<{
  json?: string;
  text?: string;
  pdf?: string;
  filename: string;
}> {
  const built = await buildPortfolio(uid);
  const items = visibleItems({ items: built.items, consent: built.consent, audience: 'self', ageTier: built.ageTier });
  const name = publicName(built.name);
  if (format === 'json') {
    return { json: portfolioJson({ name, studentNumber: built.studentNumber, items, summary: built.summary }), filename: 'portfolio.json' };
  }
  if (format === 'linkedin') {
    return { text: linkedInText({ name, studentNumber: built.studentNumber, items }), filename: 'portfolio.txt' };
  }
  const bytes = cvPdf({
    template: template ?? built.consent.template,
    name,
    lines: cvLines(items),
  });
  return { pdf: Buffer.from(bytes).toString('base64'), filename: 'poket-school-cv.pdf' };
}

interface StoredDestination extends DestinationChoice {
  destinationInstitutionId: string;
}

function destinationFrom(data: Record<string, unknown> | undefined): StoredDestination | null {
  if (!data) return null;
  const name = text(data.name).trim();
  if (!name) return null;
  const shareWithSchools = data.shareWithSchools === true;
  return {
    kind: readDestinationKind(data.kind),
    name,
    course: text(data.course),
    country: text(data.country),
    source: data.source === 'detected' ? 'detected' : 'stated',
    shareWithSchools,
    shareName: data.shareName === true && shareWithSchools,
    testimonial: text(data.testimonial).slice(0, 280),
    shareTestimonial: data.shareTestimonial === true && shareWithSchools && text(data.testimonial).trim().length > 0,
    destinationInstitutionId: safeId(text(data.destinationInstitutionId)),
  };
}

async function schoolIdsFor(uid: string): Promise<string[]> {
  const [history, user] = await Promise.all([
    loadEducation(uid),
    adminDb().doc(`users/${uid}`).get(),
  ]);
  const ids = new Set<string>();
  for (const span of history) ids.add(span.institutionId);
  const current = safeId(text(user.get('institutionId')));
  const alumni = safeId(text(user.get('alumniOf')));
  if (current) ids.add(current);
  if (alumni) ids.add(alumni);
  return [...ids];
}

async function writeDestinationRows(uid: string, choice: StoredDestination, learnerName: string): Promise<void> {
  const schools = await schoolIdsFor(uid);
  const display = choice.shareName ? learnerName : '';
  for (const school of schools) {
    if (!school || school === choice.destinationInstitutionId) continue;
    const row: DestinationRow & { studentId: string } = {
      ...choice,
      fromInstitutionId: school,
      learnerName: display,
      studentId: uid,
    };
    await adminDb().doc(`learner_destinations/${school}_${uid}`).set(row);
  }
  await adminDb().doc(`users/${uid}/destination/current`).set(choice);
}

async function deleteDestinationRows(uid: string): Promise<void> {
  const rows = await adminDb().collection('learner_destinations').where('studentId', '==', uid).limit(50).get();
  for (const doc of rows.docs) await doc.ref.delete();
}

export async function applyDestinationSharing(uid: string, share: boolean): Promise<void> {
  const current = destinationFrom((await adminDb().doc(`users/${uid}/destination/current`).get()).data());
  if (!share) {
    await deleteDestinationRows(uid);
    if (current) {
      await adminDb().doc(`users/${uid}/destination/current`).set({
        ...current,
        shareWithSchools: false,
        shareName: false,
        shareTestimonial: false,
      });
    }
    return;
  }
  if (!current) return;
  const user = await adminDb().doc(`users/${uid}`).get();
  await writeDestinationRows(uid, { ...current, shareWithSchools: true }, publicName(text(user.get('name'))));
}

export async function recordStatedDestination(uid: string, input: {
  kind: string;
  name: string;
  course?: string;
  country?: string;
  shareWithSchools: boolean;
  shareName: boolean;
  testimonial?: string;
  shareTestimonial: boolean;
}): Promise<DestinationChoice | { error: string }> {
  const choice = stateDestination(input);
  if ('error' in choice) return choice;
  await adminDb().doc(`users/${uid}/portfolio/profile`).set({
    shareDestinationWithSchools: input.shareWithSchools,
  }, { merge: true });
  const allowed = input.shareWithSchools && choice.shareWithSchools;
  const user = await adminDb().doc(`users/${uid}`).get();
  const stored: StoredDestination = {
    ...choice,
    shareWithSchools: allowed,
    shareName: allowed && choice.shareName,
    shareTestimonial: allowed && choice.shareTestimonial,
    destinationInstitutionId: '',
  };
  if (!allowed) {
    await deleteDestinationRows(uid);
    await adminDb().doc(`users/${uid}/destination/current`).set(stored);
    return stored;
  }
  await writeDestinationRows(uid, stored, publicName(text(user.get('name'))));
  return stored;
}

export async function noteDetectedDestination(uid: string, input: {
  institutionId: string;
  institutionName: string;
  level: string;
  ruleOn: boolean;
}): Promise<void> {
  const profile = await adminDb().doc(`users/${uid}/portfolio/profile`).get();
  const consent = profile.get('shareDestinationWithSchools') === true;
  if (!consent) return;
  const institutionId = safeId(input.institutionId);
  if (!input.ruleOn) {
    await logAutomation({
      rule: 'learner_record',
      outcome: 'held',
      summary: 'Destination detection waits. The earlier school is not updated until the lifelong record rule is on.',
      actorId: uid,
      refId: institutionId,
    });
    return;
  }
  const academy = institutionId ? await adminDb().doc(`institutions/${institutionId}`).get() : null;
  const detected = detectDestination({
    consent: true,
    institutionName: input.institutionName,
    level: input.level,
    country: text(academy?.get('country')),
  });
  if (!detected || !institutionId) return;
  const user = await adminDb().doc(`users/${uid}`).get();
  const earlier = (await schoolIdsFor(uid)).filter((school) => school !== institutionId);
  await writeDestinationRows(uid, { ...detected, destinationInstitutionId: institutionId }, publicName(text(user.get('name'))));
  await logAutomation({
    rule: 'learner_record',
    outcome: 'auto',
    summary: earlier.length > 0
      ? `${input.institutionName} was recorded as the next step with consent. The earlier school sees the aggregate only.`
      : `${input.institutionName} was saved as the next step with consent. No earlier academy is on the record yet.`,
    actorId: uid,
    refId: institutionId,
  });
}

export async function destinationDashboard(institutionId: string): Promise<DestinationBoard & { note: string }> {
  const id = safeId(institutionId);
  if (!id) {
    return { institutions: [], countries: [], courses: [], named: [], testimonials: [], hiddenBuckets: 0, note: 'Groups under five stay hidden.' };
  }
  const snap = await adminDb().collection('learner_destinations').where('fromInstitutionId', '==', id).limit(500).get();
  const rows: DestinationRow[] = snap.docs.flatMap((doc) => {
    const data = doc.data();
    const name = text(data.name).trim();
    if (!name) return [];
    return [{
      kind: readDestinationKind(data.kind) as DestinationKind,
      name,
      course: text(data.course),
      country: text(data.country),
      source: data.source === 'detected' ? 'detected' : 'stated',
      shareWithSchools: data.shareWithSchools === true,
      shareName: data.shareName === true,
      testimonial: text(data.testimonial),
      shareTestimonial: data.shareTestimonial === true,
      fromInstitutionId: id,
      learnerName: text(data.learnerName),
    }];
  });
  return { ...destinationBoard(rows), note: 'Groups under five stay hidden.' };
}

export async function unpublishLearnerRecord(uid: string): Promise<void> {
  if (!uid) return;
  const user = await adminDb().doc(`users/${uid}`).get();
  const number = text(user.get('studentNumber')).trim().toUpperCase();
  if (number) await adminDb().doc(`portfolio_public/${number}`).delete();
  await adminDb().doc(`users/${uid}/portfolio/profile`).set({
    publicPortfolio: false,
    shareDestinationWithSchools: false,
    sharePortfolioWithSchools: false,
  }, { merge: true });
  await deleteDestinationRows(uid);
  const current = await adminDb().doc(`users/${uid}/destination/current`).get();
  if (current.exists) {
    await current.ref.set({ shareWithSchools: false, shareName: false, shareTestimonial: false }, { merge: true });
  }
}

export async function refreshPortfolio(uid: string): Promise<BuiltPortfolio> {
  const built = await buildPortfolio(uid);
  await syncPublic(uid, built);
  return built;
}

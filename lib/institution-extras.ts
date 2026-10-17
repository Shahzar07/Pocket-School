/**
 * Career extras for an academy: a skills passport, teacher references,
 * ET AI matches from a real list, a school board, alumni giving, reunions,
 * career talks, the parent bridge, and a portfolio link on a certificate.
 * ET AI ranks opportunities the academy entered. It never creates one.
 */

import { asAgeTier, isMinorTier, type AgeTier } from './age-tier';
import { BRAND, brandPdfRgb } from './brand-theme';
import { canPublishPortfolio } from './portfolio';
import { screenPost } from './alumni-network';

export const BLOOM_TAGS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type BloomTag = (typeof BLOOM_TAGS)[number];

export const OPPORTUNITY_KINDS = ['scholarship', 'university', 'internship'] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const OPENING_KINDS = ['job', 'internship'] as const;
export type OpeningKind = (typeof OPENING_KINDS)[number];

export const CAMPAIGN_KINDS = ['fundraising', 'sponsor_seat'] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const TALK_FORMATS = ['live', 'recorded'] as const;
export type TalkFormat = (typeof TALK_FORMATS)[number];

export const TALK_PROVIDERS = ['zoom', 'meet', 'teams'] as const;
export type TalkProvider = (typeof TALK_PROVIDERS)[number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIVE_HOSTS: Record<TalkProvider, string[]> = {
  zoom: ['zoom.us'],
  meet: ['meet.google.com'],
  teams: ['teams.microsoft.com', 'teams.live.com'],
};

export interface SkillEvidence {
  kind: 'lesson' | 'unit_test' | 'badge';
  id: string;
  lessonId: string;
  bloom: BloomTag | '';
  label: string;
  url: string;
}

export interface SkillMap {
  id: string;
  name: string;
  institutionId: string;
  lessonIds: string[];
  blooms: BloomTag[];
  badgeIds: string[];
}

export interface ProvenSkill {
  id: string;
  name: string;
  visible: boolean;
  locked: true;
  evidence: SkillEvidence[];
}

export interface TeacherEndorsement {
  id: string;
  institutionId: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  body: string;
  visible: boolean;
  revoked: boolean;
  locked: true;
}

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  organisation: string;
  summary: string;
  url: string;
  deadline: string;
  interests: string[];
  levels: string[];
  minScore: number | null;
  institutionId: string;
}

export interface SchoolOpening {
  id: string;
  institutionId: string;
  title: string;
  employer: string;
  kind: OpeningKind;
  summary: string;
  url: string;
  deadline: string;
  posterRole: 'alumni' | 'partner';
  status: 'pending' | 'published' | 'rejected';
  level: string;
}

export interface Campaign {
  id: string;
  institutionId: string;
  title: string;
  kind: CampaignKind;
  goal: number;
  raised: number;
  currency: string;
}

export interface ReunionPlan {
  id: string;
  institutionId: string;
  title: string;
  when: string;
  place: string;
  ticketed: boolean;
  price: number;
  currency: string;
  wallOpenUntil: string;
  bookId: string;
  rsvpCount: number;
}

export interface CareerTalk {
  id: string;
  institutionId: string;
  title: string;
  alumniId: string;
  alumniName: string;
  format: TalkFormat;
  provider: TalkProvider | '';
  link: string;
  when: string;
  level: string;
  status: 'proposed' | 'approved' | 'declined';
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

export function readBloom(value: unknown): BloomTag | '' {
  const text = clip(value, 40).toLowerCase();
  if (text === 'analyse') return 'analyze';
  return (BLOOM_TAGS as readonly string[]).includes(text) ? text as BloomTag : '';
}

export function readSkillMap(value: unknown, institutionId = ''): SkillMap | { error: string } {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const name = clip(row.name, 80);
  if (name.length < 2) return { error: 'Name the skill.' };
  const lessonIds = listOf(row.lessonIds, 40);
  const blooms = listOf(row.blooms, 6).map(readBloom).filter((tag): tag is BloomTag => tag !== '');
  const badgeIds = listOf(row.badgeIds, 40);
  if (!lessonIds.length && !badgeIds.length) return { error: 'Map the skill to a lesson or a badge.' };
  const id = slug(clip(row.id, 60) || name) || 'skill';
  return { id, name, institutionId: institutionId.trim(), lessonIds, blooms, badgeIds };
}

function listOf(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = clip(item, 80);
    if (text) seen.add(text);
    if (seen.size >= max) break;
  }
  return [...seen];
}

export function proveSkills(maps: readonly SkillMap[], evidence: readonly SkillEvidence[]): ProvenSkill[] {
  const proven: ProvenSkill[] = [];
  for (const map of maps) {
    const hits = evidence.filter((item) => evidenceProves(map, item));
    if (!hits.length) continue;
    proven.push({
      id: map.id,
      name: map.name,
      visible: true,
      locked: true,
      evidence: hits.slice(0, 8),
    });
  }
  return proven;
}

function evidenceProves(map: SkillMap, item: SkillEvidence): boolean {
  if (item.kind === 'badge') return map.badgeIds.includes(item.id);
  if (!item.lessonId || !map.lessonIds.includes(item.lessonId)) return false;
  if (item.kind === 'lesson') return true;
  if (!map.blooms.length) return true;
  return item.bloom !== '' && map.blooms.includes(item.bloom);
}

/** A learner may show or hide a proven skill. The name and the evidence stay. */
export function setSkillVisibility(skill: ProvenSkill, visible: boolean): ProvenSkill {
  return { ...skill, visible, locked: true };
}

export function skillWasEdited(before: ProvenSkill, after: Pick<ProvenSkill, 'name' | 'evidence'>): boolean {
  if (before.name !== after.name) return true;
  return JSON.stringify(before.evidence) !== JSON.stringify(after.evidence);
}

export function draftEndorsement(input: {
  institutionId: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  teacherAge: AgeTier;
  body: unknown;
}): TeacherEndorsement | { error: string } {
  if (isMinorTier(asAgeTier(input.teacherAge))) return { error: 'A teacher reference comes from an adult.' };
  if (!input.studentId || input.studentId === input.teacherId) return { error: 'Choose a student.' };
  const body = clip(input.body, 400);
  if (body.length < 12) return { error: 'Write a short reference.' };
  const screened = screenPost(body, 'adult');
  if (screened.decision === 'block') return { error: 'Rewrite that reference before it is saved.' };
  return {
    id: '',
    institutionId: input.institutionId.trim(),
    studentId: input.studentId,
    teacherId: input.teacherId,
    teacherName: clip(input.teacherName, 80) || 'Teacher',
    body,
    visible: true,
    revoked: false,
    locked: true,
  };
}

export function setEndorsementVisibility(note: TeacherEndorsement, visible: boolean): TeacherEndorsement {
  if (note.revoked) return { ...note, visible: false, locked: true };
  return { ...note, visible, locked: true };
}

export function revokeEndorsement(note: TeacherEndorsement): TeacherEndorsement {
  return { ...note, revoked: true, visible: false, locked: true };
}

export function endorsementWasEdited(before: TeacherEndorsement, body: string): boolean {
  return before.body !== body.trim();
}

export function readOpportunity(value: unknown, institutionId = ''): Opportunity | { error: string } {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const kind = clip(row.kind, 20);
  if (!(OPPORTUNITY_KINDS as readonly string[]).includes(kind)) return { error: 'Choose a scholarship, a university place, or an internship.' };
  const title = clip(row.title, 120);
  const organisation = clip(row.organisation, 120);
  if (title.length < 2 || organisation.length < 2) return { error: 'Name the opportunity and who offers it.' };
  const url = clip(row.url, 300);
  if (url && !/^https:\/\//i.test(url)) return { error: 'The opportunity link starts with https://' };
  const deadline = clip(row.deadline, 10);
  if (!DATE.test(deadline)) return { error: 'Add a deadline as YYYY-MM-DD.' };
  const summary = clip(row.summary, 400);
  const screened = screenPost(`${title} ${summary}`, 'adult');
  if (screened.decision === 'block') return { error: 'Rewrite that opportunity before it is saved.' };
  const min = typeof row.minScore === 'number' ? row.minScore : null;
  return {
    id: slug(clip(row.id, 60) || title) || 'opportunity',
    kind: kind as OpportunityKind,
    title,
    organisation,
    summary,
    url,
    deadline,
    interests: listOf(row.interests, 12),
    levels: listOf(row.levels, 8),
    minScore: min !== null && min >= 0 && min <= 100 ? Math.round(min) : null,
    institutionId: institutionId.trim(),
  };
}

export function scorePercent(score: string): number | null {
  const text = score.trim();
  const percent = /^(\d{1,3})(?:\.\d+)?%$/.exec(text);
  if (percent) {
    const value = Number(percent[1]);
    return value <= 100 ? value : null;
  }
  const ratio = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(text);
  if (!ratio) return null;
  const got = Number(ratio[1]);
  const max = Number(ratio[2]);
  if (max <= 0) return null;
  return Math.round((got / max) * 100);
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

/**
 * ET AI suggests from the entered list only.
 * A match needs a stated interest, the learner's level when the row names levels,
 * and a verified score when the row sets a minimum. Nothing is added.
 */
export function suggestOpportunities(input: {
  interests: readonly string[];
  level: string;
  scores: readonly { title: string; score: string }[];
  opportunities: readonly Opportunity[];
}): Opportunity[] {
  const interests = input.interests.map((item) => item.trim()).filter(Boolean);
  if (!interests.length) return [];
  const interestWords = new Set(interests.flatMap(words));
  const percents = input.scores.map((row) => scorePercent(row.score)).filter((value): value is number => value !== null);
  const best = percents.length ? Math.max(...percents) : null;
  const level = input.level.trim().toLowerCase();
  const matches = input.opportunities.filter((row) => {
    if (row.levels.length && !row.levels.some((name) => name.trim().toLowerCase() === level)) return false;
    if (row.minScore !== null && (best === null || best < row.minScore)) return false;
    if (!row.interests.length) return false;
    return row.interests.flatMap(words).some((word) => interestWords.has(word));
  });
  return [...matches].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title));
}

export function matchToApplication(input: {
  opportunity: Opportunity;
  today: string;
  cvVersionId?: string;
}): { company: string; role: string; link: string; status: 'applied'; date: string; reminderOn: string; deadline: string; cvVersionId: string } {
  return {
    company: input.opportunity.organisation,
    role: input.opportunity.title,
    link: input.opportunity.url,
    status: 'applied',
    date: DATE.test(input.today) ? input.today : input.opportunity.deadline,
    reminderOn: input.opportunity.deadline,
    deadline: input.opportunity.deadline,
    cvVersionId: (input.cvVersionId ?? '').trim(),
  };
}

export function readOpening(value: unknown, institutionId: string): SchoolOpening | { error: string } {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const kind = clip(row.kind, 20);
  if (!(OPENING_KINDS as readonly string[]).includes(kind)) return { error: 'Choose a job or an internship.' };
  const title = clip(row.title, 120);
  const employer = clip(row.employer, 120);
  if (title.length < 2 || employer.length < 2) return { error: 'Name the opening and the employer.' };
  const summary = clip(row.summary, 400);
  const screened = screenPost(`${title} ${summary}`, 'adult');
  if (screened.decision === 'block') return { error: 'Rewrite that opening before it is saved.' };
  const deadline = clip(row.deadline, 10);
  if (!DATE.test(deadline)) return { error: 'Add a deadline as YYYY-MM-DD.' };
  const url = clip(row.url, 300);
  if (url && !/^https:\/\//i.test(url)) return { error: 'The opening link starts with https://' };
  const poster = clip(row.posterRole, 20) === 'partner' ? 'partner' : 'alumni';
  return {
    id: slug(clip(row.id, 60) || title) || 'opening',
    institutionId,
    title,
    employer,
    kind: kind as OpeningKind,
    summary,
    url,
    deadline,
    posterRole: poster,
    status: 'pending',
    level: clip(row.level, 60),
  };
}

export function moderateOpening(opening: SchoolOpening, publish: boolean): SchoolOpening {
  return { ...opening, status: publish ? 'published' : 'rejected' };
}

export function canSeeOpening(input: { status: SchoolOpening['status']; sameSchool: boolean; staff: boolean }): boolean {
  if (input.staff) return true;
  return input.sameSchool && input.status === 'published';
}

export function givingIsOn(value: unknown): boolean {
  return value === true;
}

export function readCampaign(value: unknown, institutionId: string, givingOn: boolean): Campaign | { error: string } {
  if (!givingOn) return { error: 'Alumni giving is off for this academy.' };
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const kind = clip(row.kind, 20);
  if (!(CAMPAIGN_KINDS as readonly string[]).includes(kind)) return { error: 'Choose fundraising or sponsor a student seat.' };
  const title = clip(row.title, 120);
  if (title.length < 2) return { error: 'Name the campaign.' };
  const goal = typeof row.goal === 'number' ? Math.round(row.goal) : 0;
  if (goal < 1 || goal > 1_000_000) return { error: 'Set a goal between 1 and 1,000,000.' };
  const currency = clip(row.currency, 3).toUpperCase() || 'USD';
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Use a three-letter currency.' };
  return {
    id: slug(clip(row.id, 60) || title) || 'campaign',
    institutionId,
    title,
    kind: kind as CampaignKind,
    goal,
    raised: 0,
    currency,
  };
}

export function campaignProgress(campaign: Campaign): number {
  if (campaign.goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((campaign.raised / campaign.goal) * 100)));
}

export function sandboxGift(input: { amount: number; currency: string; id: string }): { id: string; sandbox: true; receipt: string } | { error: string } {
  const amount = Math.round(input.amount);
  if (amount < 1 || amount > 100_000) return { error: 'Enter an amount between 1 and 100,000.' };
  const id = input.id.trim() || 'gift';
  return {
    id,
    sandbox: true,
    receipt: `Sandbox receipt ${id} for ${amount} ${input.currency || 'USD'}. No card was charged.`,
  };
}

export function applyGift(campaign: Campaign, amount: number): Campaign {
  return { ...campaign, raised: campaign.raised + Math.max(0, Math.round(amount)) };
}

export function readReunion(value: unknown, institutionId: string): ReunionPlan | { error: string } {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const title = clip(row.title, 120);
  if (title.length < 2) return { error: 'Name the reunion.' };
  const when = clip(row.when, 10);
  if (!DATE.test(when)) return { error: 'Add the date as YYYY-MM-DD.' };
  const screened = screenPost(title, 'adult');
  if (screened.decision === 'block') return { error: 'Rewrite that reunion title.' };
  const price = typeof row.price === 'number' ? Math.max(0, Math.round(row.price)) : 0;
  const ticketed = row.ticketed === true && price > 0;
  return {
    id: slug(clip(row.id, 60) || title) || 'reunion',
    institutionId,
    title,
    when,
    place: clip(row.place, 120),
    ticketed,
    price: ticketed ? price : 0,
    currency: clip(row.currency, 3).toUpperCase() || 'USD',
    wallOpenUntil: when,
    bookId: clip(row.bookId, 80),
    rsvpCount: 0,
  };
}

/** A public or insights count under 5 stays hidden. The organiser still sees the real number. */
export function shareableCount(count: number): number | null {
  return count >= 5 ? count : null;
}

export function albumOpen(today: string, eventOn: string): boolean {
  return DATE.test(today) && DATE.test(eventOn) && today >= eventOn;
}

export function screenAlbumCaption(caption: string, ageTier: AgeTier): { ok: boolean; queued: boolean; reason: string } {
  const screened = screenPost(caption, asAgeTier(ageTier));
  if (screened.decision === 'block') return { ok: false, queued: false, reason: 'That caption cannot be shared.' };
  return { ok: true, queued: screened.queued, reason: '' };
}

export function readTalk(value: unknown, institutionId: string): CareerTalk | { error: string } {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const title = clip(row.title, 120);
  if (title.length < 2) return { error: 'Name the talk.' };
  const format = clip(row.format, 20);
  if (!(TALK_FORMATS as readonly string[]).includes(format)) return { error: 'Choose a live talk or a recording.' };
  const link = clip(row.link, 300);
  if (!/^https:\/\//i.test(link)) return { error: 'Add an https link for the talk.' };
  const provider = clip(row.provider, 20);
  let liveProvider: TalkProvider | '' = '';
  if (format === 'live') {
    if (!(TALK_PROVIDERS as readonly string[]).includes(provider)) return { error: 'A live talk uses Zoom, Meet, or Teams.' };
    liveProvider = provider as TalkProvider;
    let host = '';
    try { host = new URL(link).hostname.replace(/^www\./, ''); } catch { host = ''; }
    if (!LIVE_HOSTS[liveProvider].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      return { error: 'The live link has to be on Zoom, Meet, or Teams.' };
    }
  }
  const screened = screenPost(title, 'adult');
  if (screened.decision === 'block') return { error: 'Rewrite that talk title.' };
  const when = clip(row.when, 10);
  if (when && !DATE.test(when)) return { error: 'Add the date as YYYY-MM-DD.' };
  return {
    id: slug(clip(row.id, 60) || title) || 'talk',
    institutionId,
    title,
    alumniId: '',
    alumniName: '',
    format: format as TalkFormat,
    provider: liveProvider,
    link,
    when,
    level: clip(row.level, 60),
    status: 'proposed',
  };
}

export function reviewTalk(talk: CareerTalk, approve: boolean): CareerTalk {
  return { ...talk, status: approve ? 'approved' : 'declined' };
}

export function talkVisibleToStudents(talk: CareerTalk): boolean {
  return talk.status === 'approved';
}

export interface ParentBridgePlan {
  keepsPdf: boolean;
  needsConsent: boolean;
  line: string;
}

export function parentBridgePlan(input: { ageTier: AgeTier; consent: boolean; studentName?: string }): ParentBridgePlan {
  const name = clip(input.studentName, 80) || 'This graduate';
  if (!isMinorTier(asAgeTier(input.ageTier))) {
    if (!input.consent) {
      return {
        keepsPdf: false,
        needsConsent: true,
        line: `${name} is 18 or over. The achievement PDF stays private until they agree to share it.`,
      };
    }
    return { keepsPdf: true, needsConsent: false, line: `${name} agreed that you can keep reading the achievement PDF.` };
  }
  return { keepsPdf: true, needsConsent: false, line: 'You can keep reading the achievement PDF. A learner under 18 does not have to agree again.' };
}

export function appendParentBridge(letter: { subject: string; text: string }, plan: ParentBridgePlan): { subject: string; text: string } {
  return { subject: letter.subject, text: `${letter.text}\n${plan.line}` };
}

/** The certificate QR and verify page add the public portfolio only when sharing is already on. */
export function portfolioOnCertificate(input: {
  publicPortfolio: boolean;
  ageTier: AgeTier;
  parentApproved: boolean;
  studentNumber: string;
}): string {
  const decision = canPublishPortfolio({
    ageTier: asAgeTier(input.ageTier),
    wantsPublic: input.publicPortfolio,
    parentApproved: input.parentApproved,
  });
  if (!decision.public) return '';
  const number = input.studentNumber.trim().toUpperCase();
  if (!number) return '';
  return `https://poketschool.ai/portfolio/${encodeURIComponent(number)}`;
}

export function achievementPdf(lines: readonly string[]): Uint8Array {
  const ink = brandPdfRgb(BRAND.ink);
  const bar = brandPdfRgb(BRAND.blueDeep);
  const safe = lines.slice(0, 24).map((line) => line.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').slice(0, 90));
  const commands = [
    `${bar} rg`,
    '0 790 595 52 re f',
    '1 1 1 rg',
    'BT /F1 16 Tf 36 808 Td (Poket School) Tj ET',
    `${ink} rg`,
    'BT /F1 11 Tf 14 TL 36 760 Td',
    ...safe.map((line, index) => (index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`)),
    'ET',
  ];
  const stream = commands.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`,
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let cursor = '%PDF-1.4\n'.length;
  const offsets = objects.map((object) => {
    const offset = cursor;
    cursor += object.length;
    return offset;
  });
  const xref = [
    'xref\n',
    '0 6\n',
    '0000000000 65535 f \n',
    ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    'trailer << /Size 6 /Root 1 0 R >>\n',
    'startxref\n',
    `${cursor}\n`,
    '%%EOF',
  ].join('');
  return new TextEncoder().encode(`%PDF-1.4\n${objects.join('')}${xref}`);
}

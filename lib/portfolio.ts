/**
 * CV and portfolio. Verified lines come from the Poket School record.
 * ET AI only restates those lines. Self-reported lines stay labelled.
 */

import { isMinorTier, type AgeTier } from './age-tier';
import { publicName } from './alumni';
import { BRAND, brandPdfRgb, brandRgbChannels } from './brand-theme';
import { spanDates, type EducationSpan } from './lifelong';
import { linkedInPack } from './linkedin';

/** Older portfolios stored forest, gold, or coral. */
export const CV_TEMPLATES = ['deep', 'mid', 'bright', 'classic'] as const;
export type CvTemplate = (typeof CV_TEMPLATES)[number];

export const SELF_KINDS = [
  'activity', 'award', 'competition', 'volunteering', 'sport', 'leadership', 'work', 'skill', 'language', 'link',
] as const;
export type SelfKind = (typeof SELF_KINDS)[number];

export const VERIFIED_KINDS = ['institution', 'course', 'score', 'certificate', 'badge', 'project', 'endorsement'] as const;
export type VerifiedKind = (typeof VERIFIED_KINDS)[number];

export type ItemSource = 'verified' | 'self_reported';
export type SectionAudience = 'private' | 'schools' | 'public';

export interface RecordItem {
  id: string;
  source: ItemSource;
  kind: string;
  title: string;
  detail: string;
  when: string;
  verifyUrl: string;
  evidenceLink: string;
  section: string;
  confirmation?: '' | 'learner' | 'school';
}

export interface PortfolioConsent {
  publicPortfolio: boolean;
  parentApproved: boolean;
  sharePortfolioWithSchools: boolean;
  shareDestinationWithSchools: boolean;
  includeScores: boolean;
  template: CvTemplate;
  sections: Record<string, SectionAudience>;
}

export const SECTION_IDS = [
  'education', 'courses', 'scores', 'certificates', 'badges', 'projects', 'endorsements',
  'activities', 'awards', 'experience', 'skills', 'links',
] as const;

export function defaultConsent(): PortfolioConsent {
  const sections = {} as Record<string, SectionAudience>;
  for (const id of SECTION_IDS) sections[id] = id === 'education' || id === 'certificates' ? 'schools' : 'private';
  return {
    publicPortfolio: false,
    parentApproved: false,
    sharePortfolioWithSchools: false,
    shareDestinationWithSchools: false,
    includeScores: false,
    template: 'deep',
    sections,
  };
}

const LEGACY_CV_TEMPLATE: Record<string, CvTemplate> = {
  forest: 'deep',
  gold: 'mid',
  coral: 'bright',
  blue: 'bright',
};

export function readTemplate(value: unknown): CvTemplate {
  if (typeof value === 'string' && (CV_TEMPLATES as readonly string[]).includes(value)) return value as CvTemplate;
  if (typeof value === 'string' && LEGACY_CV_TEMPLATE[value]) return LEGACY_CV_TEMPLATE[value];
  return 'deep';
}

export function needsParentApproval(ageTier: AgeTier): boolean {
  return isMinorTier(ageTier);
}

export function canPublishPortfolio(input: {
  ageTier: AgeTier;
  wantsPublic: boolean;
  parentApproved: boolean;
}): { public: boolean; reason: string } {
  if (!input.wantsPublic) return { public: false, reason: 'The portfolio stays private until sharing is turned on.' };
  if (needsParentApproval(input.ageTier) && !input.parentApproved) {
    return { public: false, reason: 'A parent approves a public portfolio for a learner under 18. It stays off until then.' };
  }
  return { public: true, reason: 'The public portfolio is on.' };
}

export function sourceLabel(source: ItemSource): 'Verified by Poket School' | 'Self-reported' {
  return source === 'verified' ? 'Verified by Poket School' : 'Self-reported';
}

export function sectionForKind(kind: string): string {
  if (kind === 'institution') return 'education';
  if (kind === 'course') return 'courses';
  if (kind === 'score') return 'scores';
  if (kind === 'certificate') return 'certificates';
  if (kind === 'badge') return 'badges';
  if (kind === 'project') return 'projects';
  if (kind === 'endorsement') return 'endorsements';
  if (kind === 'activity' || kind === 'award' || kind === 'competition' || kind === 'volunteering' || kind === 'sport' || kind === 'leadership') return 'activities';
  if (kind === 'work') return 'experience';
  if (kind === 'skill' || kind === 'language') return 'skills';
  return 'links';
}

export function provenSkillItems(skills: readonly {
  id: string;
  name: string;
  evidence: readonly { label: string; url: string }[];
}[]): RecordItem[] {
  return skills.flatMap((skill) => {
    const name = skill.name.trim();
    if (!name) return [];
    const link = skill.evidence.find((item) => item.url.startsWith('https://') || item.url.startsWith('/'))?.url ?? '';
    return [{
      id: `skill-${skill.id}`,
      source: 'verified' as const,
      kind: 'proven_skill',
      title: name,
      detail: skill.evidence.map((item) => item.label).filter(Boolean).slice(0, 4).join(' · '),
      when: '',
      verifyUrl: link.startsWith('https://') ? link : '',
      evidenceLink: link,
      section: 'skills',
    }];
  });
}

export function verifiedItems(input: {
  education: readonly EducationSpan[];
  courses: readonly { title: string; when?: string }[];
  scores: readonly { title: string; score: string }[];
  certificates: readonly { id: string; title: string; when?: string }[];
  badges: readonly { id?: string; title: string; when?: string }[];
  projects: readonly { title: string; detail?: string }[];
  endorsements: readonly { title: string; detail?: string }[];
  includeScores: boolean;
}): RecordItem[] {
  const items: RecordItem[] = [];
  for (const span of input.education) {
    items.push({
      id: `edu-${span.institutionId}`,
      source: 'verified',
      kind: 'institution',
      title: span.institutionName,
      detail: span.level,
      when: spanDates(span),
      verifyUrl: '',
      evidenceLink: '',
      section: 'education',
    });
  }
  for (const course of input.courses) {
    items.push({
      id: `course-${course.title}`,
      source: 'verified',
      kind: 'course',
      title: course.title,
      detail: 'Completed',
      when: course.when ?? '',
      verifyUrl: '',
      evidenceLink: '',
      section: 'courses',
    });
  }
  if (input.includeScores) {
    for (const score of input.scores) {
      if (!score.score.trim()) continue;
      items.push({
        id: `score-${score.title}`,
        source: 'verified',
        kind: 'score',
        title: score.title,
        detail: score.score.trim(),
        when: '',
        verifyUrl: '',
        evidenceLink: '',
        section: 'scores',
      });
    }
  }
  for (const certificate of input.certificates) {
    items.push({
      id: `cert-${certificate.id}`,
      source: 'verified',
      kind: 'certificate',
      title: certificate.title,
      detail: 'Certificate',
      when: certificate.when ?? '',
      verifyUrl: certificate.id ? `https://poketschool.ai/verify/${certificate.id}` : '',
      evidenceLink: '',
      section: 'certificates',
    });
  }
  for (const badge of input.badges) {
    items.push({
      id: `badge-${badge.title}`,
      source: 'verified',
      kind: 'badge',
      title: badge.title,
      detail: 'Badge',
      when: badge.when ?? '',
      verifyUrl: badge.id ? `https://poketschool.ai/verify/badge/${encodeURIComponent(badge.id)}` : '',
      evidenceLink: '',
      section: 'badges',
    });
  }
  for (const project of input.projects) {
    items.push({
      id: `project-${project.title}`,
      source: 'verified',
      kind: 'project',
      title: project.title,
      detail: project.detail ?? '',
      when: '',
      verifyUrl: '',
      evidenceLink: '',
      section: 'projects',
    });
  }
  for (const note of input.endorsements) {
    items.push({
      id: `note-${note.title}`,
      source: 'verified',
      kind: 'endorsement',
      title: note.title,
      detail: note.detail ?? '',
      when: '',
      verifyUrl: '',
      evidenceLink: '',
      section: 'endorsements',
    });
  }
  return items;
}

export function selfItem(input: {
  id?: string;
  kind: string;
  title: string;
  detail?: string;
  when?: string;
  evidenceLink?: string;
}): RecordItem | { error: string } {
  const kind = SELF_KINDS.includes(input.kind as SelfKind) ? input.kind : '';
  const title = input.title.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!kind) return { error: 'Choose a kind of achievement.' };
  if (!title) return { error: 'Add a title.' };
  const evidence = (input.evidenceLink ?? '').trim().slice(0, 300);
  if (evidence && !/^https:\/\//i.test(evidence)) return { error: 'An evidence link starts with https://' };
  const id = (input.id ?? '').trim() || `self-${kind}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
  return {
    id,
    source: 'self_reported',
    kind,
    title,
    detail: (input.detail ?? '').replace(/\s+/g, ' ').trim().slice(0, 280),
    when: (input.when ?? '').trim().slice(0, 40),
    verifyUrl: '',
    evidenceLink: evidence,
    section: sectionForKind(kind),
  };
}

/** ET AI restates recorded achievements. It does not add a school, score, or award that is not in the list. */
export function etSummary(input: { name: string; items: readonly Pick<RecordItem, 'title' | 'detail' | 'source'>[] }): {
  summary: string;
  bullets: string[];
  fromRecord: true;
  invented: false;
} {
  const used = input.items.filter((item) => item.title.trim()).slice(0, 8);
  const bullets = used.map((item) => {
    const detail = item.detail.trim();
    const line = detail ? `${item.title.trim()} — ${detail}` : item.title.trim();
    return `${line} (${sourceLabel(item.source)})`;
  });
  const name = input.name.trim() || 'This learner';
  const summary = bullets.length
    ? `${name} has ${bullets.length} recorded achievement${bullets.length === 1 ? '' : 's'} on Poket School.`
    : '';
  return { summary, bullets, fromRecord: true, invented: false };
}

export function portfolioNudges(events: readonly { title: string }[]): string[] {
  return events
    .map((event) => event.title.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((title) => `Add this to your portfolio: ${title}.`);
}

export function visibleItems(input: {
  items: readonly RecordItem[];
  consent: PortfolioConsent;
  audience: 'self' | 'school' | 'public';
  ageTier: AgeTier;
}): RecordItem[] {
  const publication = canPublishPortfolio({
    ageTier: input.ageTier,
    wantsPublic: input.consent.publicPortfolio,
    parentApproved: input.consent.parentApproved,
  });
  return input.items.filter((item) => {
    if (item.kind === 'score' && !input.consent.includeScores) return false;
    if (input.audience === 'self') return true;
    const section = input.consent.sections[item.section] ?? 'private';
    if (section === 'private') return false;
    if (input.audience === 'school') return input.consent.sharePortfolioWithSchools && (section === 'schools' || section === 'public');
    return publication.public && section === 'public';
  });
}

export function publicPortfolioView(input: {
  name: string;
  studentNumber: string;
  items: readonly RecordItem[];
  consent: PortfolioConsent;
  ageTier: AgeTier;
  summary: string;
}): { name: string; studentNumber: string; summary: string; items: RecordItem[]; qrUrl: string } | null {
  const gate = canPublishPortfolio({
    ageTier: input.ageTier,
    wantsPublic: input.consent.publicPortfolio,
    parentApproved: input.consent.parentApproved,
  });
  if (!gate.public) return null;
  const studentNumber = input.studentNumber.trim().toUpperCase();
  if (!studentNumber) return null;
  const items = visibleItems({ items: input.items, consent: input.consent, audience: 'public', ageTier: input.ageTier })
    .map((item) => ({ ...item, evidenceLink: /^https:\/\//i.test(item.evidenceLink) ? item.evidenceLink : '' }));
  return {
    name: publicName(input.name),
    studentNumber,
    summary: input.summary,
    items,
    qrUrl: `https://poketschool.ai/portfolio/${studentNumber}`,
  };
}

export function linkedInText(input: { name: string; studentNumber: string; items: readonly RecordItem[] }): string {
  return linkedInPack({
    name: input.name,
    studentNumber: input.studentNumber,
    items: input.items.slice(0, 24).map((item) => ({
      source: item.source,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      when: item.when,
    })),
  }).text;
}

export function portfolioJson(input: {
  name: string;
  studentNumber: string;
  items: readonly RecordItem[];
  summary: string;
}): string {
  return JSON.stringify({
    name: input.name,
    studentNumber: input.studentNumber.trim().toUpperCase(),
    summary: input.summary,
    items: input.items.map((item) => ({
      source: item.source,
      label: sourceLabel(item.source),
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      when: item.when,
      verifyUrl: item.verifyUrl,
      evidenceLink: item.evidenceLink,
    })),
  }, null, 2);
}

const HEADER: Record<CvTemplate, [number, number, number]> = {
  deep: brandRgbChannels(BRAND.blueDeep),
  mid: brandRgbChannels(BRAND.primary),
  bright: brandRgbChannels(BRAND.blueBright),
  classic: brandRgbChannels(BRAND.ink),
};

function pdfEscape(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** One-page CV. The header colour follows the template. Classic uses a thin rule. */
export function cvPdf(input: { template: CvTemplate; name: string; lines: readonly string[] }): Uint8Array {
  const template = readTemplate(input.template);
  const [r, g, b] = HEADER[template];
  const bar = template === 'classic' ? '48 742 516 1.5 re f' : '0 736 612 56 re f';
  const titleInk = template === 'classic' || template === 'bright' ? `${brandPdfRgb(BRAND.ink)} rg` : '1 1 1 rg';
  const body = [input.name.trim() || 'Learner', ...input.lines].slice(0, 36).map((line) => pdfEscape(line).slice(0, 90));
  const commands = [
    `${r} ${g} ${b} rg`,
    bar,
    titleInk,
    'BT /F1 18 Tf 48 756 Td (Poket School CV) Tj ET',
    '0 0 0 rg',
    'BT /F1 11 Tf 14 TL 48 710 Td',
  ];
  body.forEach((line, index) => {
    commands.push(index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`);
  });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let cursor = '%PDF-1.4\n'.length;
  const offsets = objects.map((object) => {
    const offset = cursor;
    cursor += object.length;
    return offset;
  });
  const xref = ['xref\n', '0 6\n', '0000000000 65535 f \n', ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)];
  const trailer = `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`;
  return new TextEncoder().encode(`%PDF-1.4\n${objects.join('')}${xref.join('')}${trailer}`);
}

export function cvLines(items: readonly RecordItem[]): string[] {
  return items.slice(0, 30).map((item) => {
    const when = item.when ? ` · ${item.when}` : '';
    const detail = item.detail ? ` — ${item.detail}` : '';
    return `${item.title}${detail}${when} · ${sourceLabel(item.source)}`;
  });
}

export interface GradeBand {
  min: number;
  grade: string;
}

export interface GradingScale {
  id: string;
  label: string;
  bands: GradeBand[];
}

/**
 * Default boundaries. A school can pass its own bands; these are the starting
 * template, not an exam board's confidential grade boundary.
 */
export const SCALES: readonly GradingScale[] = [
  {
    id: 'igcse_9_1',
    label: 'IGCSE 9–1',
    bands: [
      { min: 90, grade: '9' }, { min: 80, grade: '8' }, { min: 70, grade: '7' },
      { min: 60, grade: '6' }, { min: 50, grade: '5' }, { min: 40, grade: '4' },
      { min: 30, grade: '3' }, { min: 20, grade: '2' }, { min: 0, grade: '1' },
    ],
  },
  {
    id: 'alevel',
    label: 'A-Level',
    bands: [
      { min: 90, grade: 'A*' }, { min: 80, grade: 'A' }, { min: 70, grade: 'B' },
      { min: 60, grade: 'C' }, { min: 50, grade: 'D' }, { min: 40, grade: 'E' },
      { min: 0, grade: 'U' },
    ],
  },
  {
    id: 'letter',
    label: 'Letter',
    bands: [
      { min: 90, grade: 'A' }, { min: 80, grade: 'B' }, { min: 70, grade: 'C' },
      { min: 60, grade: 'D' }, { min: 0, grade: 'F' },
    ],
  },
  {
    id: 'a_to_e',
    label: 'A to E',
    bands: [
      { min: 80, grade: 'A' }, { min: 70, grade: 'B' }, { min: 60, grade: 'C' },
      { min: 50, grade: 'D' }, { min: 0, grade: 'E' },
    ],
  },
  {
    id: 'percent',
    label: 'Percent',
    bands: [{ min: 0, grade: '%' }],
  },
];

export interface ReportTemplate {
  id: string;
  label: string;
  scaleId: string;
  heading: string;
}

export const REPORT_TEMPLATES: readonly ReportTemplate[] = [
  { id: 'malaysia', label: 'Malaysia school term', scaleId: 'letter', heading: 'Term report' },
  { id: 'uk', label: 'UK secondary', scaleId: 'letter', heading: 'Progress report' },
  { id: 'igcse', label: 'IGCSE', scaleId: 'igcse_9_1', heading: 'IGCSE report' },
  { id: 'alevel', label: 'A-Level', scaleId: 'alevel', heading: 'A-Level report' },
  { id: 'a_to_e', label: 'A to E', scaleId: 'a_to_e', heading: 'Term report' },
];

export interface SchoolTemplate {
  id: string;
  institutionId: string;
  label: string;
  heading: string;
  scaleId: string;
  logoUrl: string;
}

/** A school logo must be an https URL. Anything else is stored blank. */
export function normaliseTemplate(input: {
  id?: string;
  institutionId: string;
  label?: string;
  heading?: string;
  scaleId?: string;
  logoUrl?: string;
}): SchoolTemplate {
  const logo = (input.logoUrl ?? '').trim();
  const logoUrl = logo.startsWith('https://') ? logo : '';
  return {
    id: input.id?.trim() || `tpl_${input.institutionId}`,
    institutionId: input.institutionId,
    label: input.label?.trim() || 'School report',
    heading: input.heading?.trim() || 'Term report',
    scaleId: scaleById(input.scaleId || 'a_to_e').id,
    logoUrl,
  };
}

export function scaleById(id: string): GradingScale {
  return SCALES.find(s => s.id === id) ?? SCALES[0];
}

export function gradeOnScale(percent: number, scale: GradingScale): string {
  if (!Number.isFinite(percent)) return '—';
  if (scale.id === 'percent') return `${Math.round(percent)}%`;
  const sorted = [...scale.bands].sort((a, b) => b.min - a.min);
  const band = sorted.find(b => percent >= b.min);
  return band?.grade ?? sorted[sorted.length - 1]?.grade ?? '—';
}

export interface Acknowledgement {
  status: 'pending' | 'acknowledged';
  parentId?: string;
  parentName?: string;
  at?: string;
  note?: string;
}

export function newVerificationToken(): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `rc_${id.replace(/-/g, '')}`;
}

export interface ReportCardDraft {
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  termId: string;
  year: number;
  percent: number;
  scaleId: string;
  templateId: string;
  comment: string;
  commentSource: 'ai_draft' | 'teacher';
  teacherId: string;
  institutionId?: string;
}

export function publishFields(draft: ReportCardDraft, token: string) {
  const scale = scaleById(draft.scaleId);
  const template = REPORT_TEMPLATES.find(t => t.id === draft.templateId) ?? REPORT_TEMPLATES[0];
  return {
    ...draft,
    grade: gradeOnScale(draft.percent, scale),
    heading: template.heading,
    verificationToken: token,
    acknowledgement: { status: 'pending' } satisfies Acknowledgement,
    automaticPenalty: false,
  };
}

/** What a public QR may show. Comments stay on the private card. */
export function publicCard(card: {
  studentName: string;
  courseTitle: string;
  grade: string;
  termId: string;
  year: number;
  heading: string;
  verificationToken: string;
}) {
  return {
    studentName: card.studentName,
    courseTitle: card.courseTitle,
    grade: card.grade,
    termId: card.termId,
    year: card.year,
    heading: card.heading,
    verificationToken: card.verificationToken,
    issuer: 'PoketSchool.Ai',
  };
}

/**
 * Programme names, levels and subjects.
 * Source: Harry's Master Alignment Brief (October 2026). That brief wins where
 * older briefs disagree. Placement uses named levels only. Stored year numbers
 * from older accounts are shown as those levels.
 */

import { NAMED_LEVELS, isNamedLevel } from './example-courses';
import { resolveLevel } from './levels';

export interface Programme {
  value: string;
  /** Public label. No year numbers. */
  label: string;
  /** Short public description. Degree cards and the CMS use this. */
  summary?: string;
  tier: 0 | 1 | 2 | 3 | 4;
  /**
   * Level labels for this programme.
   * Empty means the only choice is "Not applicable" (independent study).
   */
  years: readonly string[];
  subjects: readonly string[];
}

export const PROGRAMMES: readonly Programme[] = [
  {
    value: 'Primary',
    label: 'Primary',
    tier: 1,
    years: ['Primary'],
    subjects: ['Science', 'Mathematics', 'English', 'Malay'],
  },
  {
    value: 'Lower Secondary',
    label: 'Lower Secondary',
    tier: 1,
    years: ['Lower Secondary'],
    subjects: [
      'Biology', 'Chemistry', 'Physics', 'Mathematics', 'English', 'English Second Language',
      'Malay', 'Business Studies', 'ICT', 'History', 'Geography', 'Global Citizenship',
    ],
  },
  {
    value: 'IGCSE',
    label: 'IGCSE',
    tier: 2,
    years: ['IGCSE'],
    subjects: [
      'Biology', 'Human Biology', 'Chemistry', 'Physics', 'Mathematics', 'Additional Mathematics',
      'English First Language', 'English Second Language', 'Malay', 'Mandarin', 'French', 'German',
      'Business Studies', 'Economics', 'Accounting', 'History', 'Geography', 'Computer Science',
      'ICT', 'Global Citizenship', 'Psychology', 'Sociology', 'Media Studies', 'Art and Design', 'Music',
    ],
  },
  {
    value: 'A-Level',
    label: 'A-Level',
    tier: 2,
    years: ['A-Level'],
    subjects: [
      'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Further Mathematics', 'English Literature',
      'English Language', 'Malay', 'Mandarin', 'French', 'German', 'Business Studies', 'Economics',
      'Accounting', 'History', 'Geography', 'Computer Science', 'Psychology', 'Sociology',
      'Media Studies', 'Law', 'Art and Design', 'Music',
    ],
  },
  {
    value: 'Pre-University',
    label: 'Pre-University',
    summary: 'The step between school exams and a degree.',
    tier: 2,
    years: ['Pre-University'],
    subjects: ['Physics', 'Mathematics', 'Chemistry', 'Biology', 'Economics', 'English'],
  },
  {
    value: 'LLB Law',
    label: 'LLB Law',
    summary: 'LLB Law covers the University of London (UoL) and other universities.',
    tier: 4,
    years: ['Degree'],
    subjects: [
      'Contract Law', 'Tort Law', 'Criminal Law', 'Public Law', 'Land Law', 'Equity and Trusts',
      'Company Law', 'Jurisprudence', 'Evidence', 'Family Law', 'Commercial Law', 'International Law',
    ],
  },
  {
    value: 'MBBS Medicine',
    label: 'MBBS Medicine',
    summary: 'A full medical degree. ET Medicine is included on Professional & Degrees.',
    tier: 4,
    years: ['Degree'],
    subjects: [
      'Anatomy', 'Physiology', 'Biochemistry', 'Pharmacology', 'Pathology', 'Clinical Reasoning',
      'Internal Medicine', 'Surgery', 'Obstetrics and Gynaecology', 'Paediatrics', 'Psychiatry',
      'Community Medicine',
    ],
  },
  {
    value: 'Engineering',
    label: 'Engineering',
    summary: 'A degree programme. ET Engineering is included on Professional & Degrees.',
    tier: 4,
    years: ['Foundation', 'Degree'],
    subjects: ['Engineering Mathematics', 'Mechanics', 'Materials', 'Circuits', 'Structures', 'Design'],
  },
  {
    value: 'Nursing',
    label: 'Nursing',
    summary: 'A degree programme. ET Nursing is included on Professional & Degrees.',
    tier: 4,
    years: ['Foundation', 'Degree'],
    subjects: ['Anatomy', 'Physiology', 'Pharmacology', 'Patient Care', 'Clinical Practice', 'Community Health'],
  },
  {
    value: 'Micro Degree',
    label: 'Micro Degrees',
    tier: 3,
    years: ['Degree'],
    subjects: [],
  },
  {
    value: 'Professional Certification',
    label: 'Professional',
    tier: 3,
    years: ['Professional'],
    subjects: [],
  },
  {
    value: 'Independent Learning',
    label: 'Independent',
    tier: 3,
    years: [],
    subjects: ['Mandarin', 'French', 'German', 'Russian', 'Languages'],
  },
];

export const PROGRAMME_VALUES = PROGRAMMES.map((p) => p.value);

/** Shown when a programme has no school or professional year. */
export const NOT_APPLICABLE = 'Not applicable';

/**
 * Older stored values, mapped onto the current programme names.
 * Sign-up, profile, CMS and allocation all go through this.
 */
const LEGACY_PROGRAMMES: Record<string, string> = {
  primary: 'Primary',
  lower_secondary: 'Lower Secondary',
  'lower-secondary': 'Lower Secondary',
  middle: 'Lower Secondary',
  secondary: 'Lower Secondary',
  Secondary: 'Lower Secondary',
  igcse: 'IGCSE',
  GCSE: 'IGCSE',
  alevels: 'A-Level',
  'a-level': 'A-Level',
  foundation: 'A-Level',
  undergraduate: 'LLB Law',
  postgraduate: 'MBBS Medicine',
  other: 'Independent Learning',
};

export function programmeByValue(value: string | null | undefined): Programme | undefined {
  return PROGRAMMES.find((p) => p.value === value);
}

/** Programme name as stored today. Unknown values pass through. */
export function canonicalProgramme(value: string | null | undefined): string {
  if (!value) return '';
  if (programmeByValue(value)) return value;
  return LEGACY_PROGRAMMES[value] ?? value;
}

export function yearsForProgramme(value: string | null | undefined): readonly string[] {
  return programmeByValue(canonicalProgramme(value))?.years ?? [];
}

/**
 * Level choices for one programme.
 * Independent study offers "Not applicable".
 */
export function levelsForProgramme(value: string | null | undefined): readonly string[] {
  const programme = programmeByValue(canonicalProgramme(value));
  if (!programme) return [];
  return programme.years.length ? programme.years : [NOT_APPLICABLE];
}

export interface Placement {
  pathway: string;
  level: string;
  yearGroup: string;
}

/**
 * Accept a programme and level only when the level belongs to that programme.
 * "Not applicable" is stored as an empty level. Older year-number labels are
 * rewritten to the named level.
 */
export function assertPlacement(programme: string, year: string): Placement {
  const level = canonicalProgramme(programme);
  if (!level && !year.trim()) return { pathway: '', level: '', yearGroup: '' };
  if (!programmeByValue(level)) {
    throw new Error('Choose a programme from the list.');
  }
  const years = levelsForProgramme(level);
  const offered = years.includes(year) ? year : toNamedLevel(year);
  if (!years.includes(offered)) {
    throw new Error('That level does not belong to the selected programme.');
  }
  return {
    pathway: level,
    level,
    yearGroup: offered === NOT_APPLICABLE ? '' : offered,
  };
}

/** Sign-up programme dropdown. Same objects the CMS taxonomy uses. */
export function signupProgrammeOptions(): readonly { value: string; label: string }[] {
  return PROGRAMMES.map((programme) => ({ value: programme.value, label: programme.label }));
}

/** Allocation and course-creator level chips, without a separate list. */
export function allocationLevelOptions(): readonly string[] {
  return PROGRAMMES.map((programme) => programme.value);
}

/**
 * Year chips for allocation. With no programme selected, every taxonomy year
 * is available. With programmes selected, only their years remain.
 */
export function allocationYearsFor(programmeIds: readonly string[]): readonly string[] {
  const known = programmeIds
    .map((id) => programmeByValue(canonicalProgramme(id))?.value)
    .filter((id): id is string => !!id);
  const source = programmeIds.length === 0
    ? PROGRAMMES.map((programme) => programme.value)
    : known;
  return [...new Set(source.flatMap((id) => [...levelsForProgramme(id)]))];
}

/** Every year the CMS may suggest, in taxonomy order, each label once. */
export function cmsYearLevelSuggestions(): readonly string[] {
  return [...new Set(PROGRAMMES.flatMap((programme) => [...levelsForProgramme(programme.value)]))];
}

/**
 * Levels a CMS subject may use. A programme name from the taxonomy wins.
 * A custom CMS programme keeps the levels stored on that document.
 * Older year-number labels are rewritten to named levels.
 */
export function cmsSubjectYearOptions(
  name: string | null | undefined,
  storedYears: readonly string[] = [],
): readonly string[] {
  const known = programmeByValue(canonicalProgramme(name));
  if (known) return levelsForProgramme(known.value);
  const stored = [...new Set(storedYears.map((year) => toNamedLevel(year.trim())).filter(Boolean))];
  if (stored.length) return stored;
  return cmsYearLevelSuggestions();
}

/** Age on 1 September of the academic year that contains `now`. */
export function schoolAge(dob: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [yearText, monthText, dayText] = dob.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(birth.getTime())
    || birth.getUTCFullYear() !== year
    || birth.getUTCMonth() !== month - 1
    || birth.getUTCDate() !== day
  ) return null;
  const academicYear = now.getMonth() > 8 || (now.getMonth() === 8 && now.getDate() >= 1)
    ? now.getFullYear()
    : now.getFullYear() - 1;
  let age = academicYear - year;
  if (month > 9 || (month === 9 && day > 1)) age -= 1;
  return age;
}

/**
 * Suggest a programme and level from a date of birth.
 * Ages follow the same bands as before: primary from age 5 on 1 September.
 * 18 and over is Independent Learning.
 */
export function suggestPlacementFromDob(
  dob: string,
  now = new Date(),
): { programme: string; year: string } | null {
  const age = schoolAge(dob, now);
  if (age === null || age < 5) return null;
  if (age >= 18) return { programme: 'Independent Learning', year: NOT_APPLICABLE };
  const bands = [
    { min: 16, programme: 'A-Level' },
    { min: 14, programme: 'IGCSE' },
    { min: 11, programme: 'Lower Secondary' },
    { min: 5, programme: 'Primary' },
  ];
  const band = bands.find((item) => age >= item.min);
  if (!band) return null;
  const years = levelsForProgramme(band.programme);
  const year = years[age - band.min] ?? years[years.length - 1] ?? '';
  return { programme: band.programme, year };
}

export function subjectsForProgramme(value: string | null | undefined): readonly string[] {
  return programmeByValue(canonicalProgramme(value))?.subjects ?? [];
}

/** Subjects from every programme whose year resolves to this learner level. */
export function subjectsForLevel(value: string | null | undefined): readonly string[] {
  const id = resolveLevel(value);
  if (!id) return subjectsForProgramme(value);
  const names = new Set<string>();
  for (const programme of PROGRAMMES) {
    if (programme.years.some((year) => resolveLevel(year) === id)) {
      for (const subject of programme.subjects) names.add(subject);
    }
  }
  return [...names];
}

/** Access tier for a programme, or for a year-placement label. */
export function tierForProgramme(value: string | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const direct = programmeByValue(canonicalProgramme(value));
  if (direct) return direct.tier;
  const owner = PROGRAMMES.find((p) => p.years.includes(value ?? ''));
  return owner?.tier ?? 1;
}

/** Internal tutor mode. The studio shows one programme dropdown; this is not a second control. */
export type StudioMode = 'k12' | 'college' | 'professional' | 'legal';

export function studioModeForLevel(value: string | null | undefined): StudioMode {
  const id = resolveLevel(value);
  if (id === 'primary' || id === 'lower-secondary' || id === 'upper-secondary') return 'k12';
  if (id === 'igcse' || id === 'a-level' || id === 'pre-university' || id === 'undergraduate' || id === 'masters' || id === 'phd') return 'college';
  if (id === 'professional' || id === 'independent') return 'professional';
  return studioModeForProgramme(value);
}

export function studioModeForProgramme(value: string | null | undefined): StudioMode {
  const programme = canonicalProgramme(value);
  if (programme === 'Primary' || programme === 'Lower Secondary') return 'k12';
  if (programme === 'IGCSE' || programme === 'A-Level' || programme === 'Pre-University') return 'college';
  if (programme === 'LLB Law') return 'legal';
  if (programme === 'MBBS Medicine' || programme === 'Engineering' || programme === 'Nursing') return 'professional';
  return 'professional';
}

/**
 * Public level names for a stored level list.
 * Older labels such as a school year number become Primary, Lower Secondary,
 * IGCSE, A-Level or Degree. Labels that already name a level are kept.
 */
export function displayLevels(yearGroups: readonly string[] | null | undefined): string {
  if (!yearGroups?.length) return '';
  const labels: string[] = [];
  for (const raw of yearGroups) {
    for (const part of raw.split(/[·,]/).map((item) => item.trim()).filter(Boolean)) {
      labels.push(...levelsInLabel(part));
    }
  }
  return [...new Set(labels)].join(' · ');
}

function levelsInLabel(part: string): string[] {
  if (/LLB/i.test(part) || /MBBS/i.test(part)) return ['Degree'];
  if (/engineering/i.test(part) && /foundation|degree/i.test(part)) return ['Engineering'];
  if (/nursing/i.test(part) && /foundation|degree/i.test(part)) return ['Nursing'];
  if (/^secondary$/i.test(part)) return ['Lower Secondary'];
  const form = /\bform\s+([0-9]{1,2})\b/i.exec(part);
  if (form) return [levelFromForm(Number(form[1]))];
  const grade = /\b(?:grade|y)\s*([0-9]{1,2})\b/i.exec(part);
  if (grade) return [levelFromSchoolNumber(Number(grade[1]))];
  const year = /\bYear\s+(\d+)\b/i.exec(part);
  if (year) return [levelFromSchoolNumber(Number(year[1]))];
  if (isNamedLevel(part)) return [part];
  const known = PROGRAMMES.find((programme) => programme.value === part || programme.label === part);
  if (known) return [known.label];
  return [part];
}

function levelFromForm(n: number): string {
  if (n <= 3) return 'Lower Secondary';
  if (n <= 5) return 'IGCSE';
  return 'A-Level';
}

function levelFromSchoolNumber(n: number): string {
  if (n <= 6) return 'Primary';
  if (n <= 9) return 'Lower Secondary';
  if (n <= 11) return 'IGCSE';
  if (n <= 13) return 'A-Level';
  return 'Degree';
}

/** Rewrite a stored year number or form label into a named level when we know it. */
export function toNamedLevel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isNamedLevel(trimmed)) return trimmed;
  const shown = displayLevels([trimmed]);
  if (!shown) return trimmed;
  const first = shown.split(' · ')[0] ?? shown;
  if (isNamedLevel(first) || (NAMED_LEVELS as readonly string[]).includes(first)) return first;
  if (/\bYear\s+\d/.test(first)) return levelFromSchoolNumber(Number(/\d+/.exec(first)?.[0] ?? 0));
  return first;
}

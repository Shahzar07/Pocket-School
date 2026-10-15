/**
 * Programme names, year bands and subjects.
 * Source: Harry's Master Alignment Brief (October 2026). That brief wins where
 * older briefs disagree. Year numbers are placement labels on the registration
 * form only — public pages use the programme name.
 */

export interface Programme {
  value: string;
  /** Public label. No year numbers. */
  label: string;
  tier: 0 | 1 | 2 | 3 | 4;
  /**
   * Year / Level labels for this programme.
   * Empty means the only choice is "Not applicable" (adult and professional courses).
   */
  years: readonly string[];
  subjects: readonly string[];
}

export const PROGRAMMES: readonly Programme[] = [
  {
    value: 'Primary',
    label: 'Primary',
    tier: 1,
    years: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
    subjects: ['Science', 'Mathematics', 'English', 'Malay'],
  },
  {
    value: 'Lower Secondary',
    label: 'Lower Secondary',
    tier: 1,
    years: ['Year 7', 'Year 8', 'Year 9'],
    subjects: [
      'Biology', 'Chemistry', 'Physics', 'Mathematics', 'English', 'English Second Language',
      'Malay', 'Business Studies', 'ICT', 'History', 'Geography', 'Global Citizenship',
    ],
  },
  {
    value: 'IGCSE',
    label: 'IGCSE',
    tier: 2,
    years: ['Year 10', 'Year 11'],
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
    years: ['Year 12', 'Year 13'],
    subjects: [
      'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Further Mathematics', 'English Literature',
      'English Language', 'Malay', 'Mandarin', 'French', 'German', 'Business Studies', 'Economics',
      'Accounting', 'History', 'Geography', 'Computer Science', 'Psychology', 'Sociology',
      'Media Studies', 'Law', 'Art and Design', 'Music',
    ],
  },
  {
    value: 'LLB Law',
    label: 'LLB Law',
    tier: 4,
    years: ['Year 1 (LLB)', 'Year 2 (LLB)', 'Year 3 (LLB)'],
    subjects: [
      'Contract Law', 'Tort Law', 'Criminal Law', 'Public Law', 'Land Law', 'Equity and Trusts',
      'Company Law', 'Jurisprudence', 'Evidence', 'Family Law', 'Commercial Law', 'International Law',
    ],
  },
  {
    value: 'MBBS Medicine',
    label: 'MBBS Medicine',
    tier: 4,
    years: ['Year 1 (MBBS)', 'Year 2 (MBBS)', 'Year 3 (MBBS)', 'Year 4 (MBBS)', 'Year 5 (MBBS)'],
    subjects: [
      'Anatomy', 'Physiology', 'Biochemistry', 'Pharmacology', 'Pathology', 'Clinical Reasoning',
      'Internal Medicine', 'Surgery', 'Obstetrics and Gynaecology', 'Paediatrics', 'Psychiatry',
      'Community Medicine',
    ],
  },
  {
    value: 'Micro Degree',
    label: 'Micro Degree',
    tier: 3,
    years: [],
    subjects: [],
  },
  {
    value: 'Professional Certification',
    label: 'Professional Certification',
    tier: 3,
    years: [],
    subjects: [],
  },
  {
    value: 'Independent Learning',
    label: 'Independent Learning',
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
 * Year / Level choices for one programme.
 * Adult and professional courses offer "Not applicable".
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
 * Accept a programme and year only when the year belongs to that programme.
 * "Not applicable" is stored as an empty year group.
 */
export function assertPlacement(programme: string, year: string): Placement {
  const level = canonicalProgramme(programme);
  if (!level && !year.trim()) return { pathway: '', level: '', yearGroup: '' };
  if (!programmeByValue(level)) {
    throw new Error('Choose a programme from the list.');
  }
  const years = levelsForProgramme(level);
  if (!years.includes(year)) {
    throw new Error('That year does not belong to the selected programme.');
  }
  return {
    pathway: level,
    level,
    yearGroup: year === NOT_APPLICABLE ? '' : year,
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
 * Years a CMS subject may use. A programme name from the taxonomy wins.
 * A custom CMS programme keeps the years stored on that document.
 */
export function cmsSubjectYearOptions(
  name: string | null | undefined,
  storedYears: readonly string[] = [],
): readonly string[] {
  const known = programmeByValue(canonicalProgramme(name));
  if (known) return levelsForProgramme(known.value);
  const stored = storedYears.map((year) => year.trim()).filter(Boolean);
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
 * Suggest a programme and year from a date of birth.
 * Ages follow the international Year 1–13 structure: Year 1 at age 5 on 1 September.
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

/** Access tier for a programme, or for a year-placement label. */
export function tierForProgramme(value: string | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const direct = programmeByValue(canonicalProgramme(value));
  if (direct) return direct.tier;
  const owner = PROGRAMMES.find((p) => p.years.includes(value ?? ''));
  return owner?.tier ?? 1;
}

/** Internal tutor mode. The studio shows one programme dropdown; this is not a second control. */
export type StudioMode = 'k12' | 'college' | 'professional' | 'legal';

export function studioModeForProgramme(value: string | null | undefined): StudioMode {
  const programme = canonicalProgramme(value);
  if (programme === 'Primary' || programme === 'Lower Secondary') return 'k12';
  if (programme === 'IGCSE' || programme === 'A-Level') return 'college';
  if (programme === 'LLB Law' || programme === 'MBBS Medicine') return 'legal';
  return 'professional';
}

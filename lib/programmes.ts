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
  /** Empty means the year field is hidden (Micro Degree, Professional, Independent). */
  years: readonly string[];
  subjects: readonly string[];
}

export const PROGRAMMES: readonly Programme[] = [
  {
    value: 'Primary',
    label: 'Primary',
    tier: 1,
    years: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
    subjects: ['Science', 'Mathematics', 'English', 'Malay'],
  },
  {
    value: 'Lower Secondary',
    label: 'Lower Secondary',
    tier: 1,
    years: ['Year 6', 'Year 7', 'Year 8'],
    subjects: [
      'Biology', 'Chemistry', 'Physics', 'Mathematics', 'English', 'English Second Language',
      'Malay', 'Business Studies', 'ICT', 'History', 'Geography', 'Global Citizenship',
    ],
  },
  {
    value: 'IGCSE',
    label: 'IGCSE',
    tier: 2,
    years: ['Year 9', 'Year 10', 'Year 11'],
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

export function programmeByValue(value: string | null | undefined): Programme | undefined {
  return PROGRAMMES.find((p) => p.value === value);
}

export function yearsForProgramme(value: string | null | undefined): readonly string[] {
  return programmeByValue(value)?.years ?? [];
}

export function subjectsForProgramme(value: string | null | undefined): readonly string[] {
  return programmeByValue(value)?.subjects ?? [];
}

/** Access tier for a programme, or for a year-placement label. */
export function tierForProgramme(value: string | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const direct = programmeByValue(value);
  if (direct) return direct.tier;
  const owner = PROGRAMMES.find((p) => p.years.includes(value ?? ''));
  return owner?.tier ?? 1;
}

/** Internal tutor mode. The studio shows one programme dropdown; this is not a second control. */
export type StudioMode = 'k12' | 'college' | 'professional' | 'legal';

export function studioModeForProgramme(value: string | null | undefined): StudioMode {
  if (value === 'Primary' || value === 'Lower Secondary') return 'k12';
  if (value === 'IGCSE' || value === 'A-Level') return 'college';
  if (value === 'LLB Law' || value === 'MBBS Medicine') return 'legal';
  return 'professional';
}

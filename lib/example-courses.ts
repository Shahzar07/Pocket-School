/**
 * Named levels and rotating example courses for empty creation forms.
 * School, pre-university, degree and professional work all share one list.
 * Placeholders are chosen on the client after mount so server and client
 * render the same first paint.
 */

export const NAMED_LEVELS = [
  'Primary',
  'Lower Secondary',
  'IGCSE',
  'A-Level',
  'Pre-University',
  'Foundation',
  'Degree',
  'Professional',
] as const;

export type NamedLevel = (typeof NAMED_LEVELS)[number];

export interface ExampleCourse {
  title: string;
  subject: string;
  level: NamedLevel;
  weeks: string;
  hours: string;
  description: string;
}

export const EXAMPLE_COURSES: readonly ExampleCourse[] = [
  {
    title: 'Primary Mathematics',
    subject: 'Mathematics',
    level: 'Primary',
    weeks: '36',
    hours: '40',
    description: 'Number, measure and simple problem solving across a primary year.',
  },
  {
    title: 'Lower Secondary English',
    subject: 'English',
    level: 'Lower Secondary',
    weeks: '36',
    hours: '40',
    description: 'Reading, writing and spoken English for lower secondary classes.',
  },
  {
    title: 'IGCSE Combined Science',
    subject: 'Combined Science',
    level: 'IGCSE',
    weeks: '40',
    hours: '60',
    description: 'Biology, chemistry and physics for the IGCSE combined science course.',
  },
  {
    title: 'A-Level Economics',
    subject: 'Economics',
    level: 'A-Level',
    weeks: '36',
    hours: '50',
    description: 'Markets, macroeconomics and exam essays for A-Level Economics.',
  },
  {
    title: 'Pre-University Physics',
    subject: 'Physics',
    level: 'Pre-University',
    weeks: '28',
    hours: '48',
    description: 'Mechanics, waves and electricity before a physics degree.',
  },
  {
    title: 'Foundation in Business',
    subject: 'Business',
    level: 'Foundation',
    weeks: '28',
    hours: '40',
    description: 'Accounting basics, marketing and how a business is run.',
  },
  {
    title: 'LLB Contract Law',
    subject: 'Contract Law',
    level: 'Degree',
    weeks: '12',
    hours: '36',
    description: 'Offer, acceptance, terms and remedies in contract law.',
  },
  {
    title: 'MBBS Anatomy',
    subject: 'Anatomy',
    level: 'Degree',
    weeks: '16',
    hours: '48',
    description: 'Gross anatomy of the body systems for the opening medical block.',
  },
  {
    title: 'BEng Mechanical Engineering',
    subject: 'Mechanical Engineering',
    level: 'Degree',
    weeks: '14',
    hours: '42',
    description: 'Statics, dynamics and materials for mechanical engineering.',
  },
  {
    title: 'BSc Nursing',
    subject: 'Nursing',
    level: 'Degree',
    weeks: '16',
    hours: '40',
    description: 'Patient care, anatomy and clinical practice for nursing students.',
  },
  {
    title: 'ACCA Financial Reporting',
    subject: 'Financial Reporting',
    level: 'Professional',
    weeks: '12',
    hours: '30',
    description: 'Financial statements and reporting standards for the ACCA paper.',
  },
];

/** Stable first paint. A random course replaces this after mount. */
export const EXAMPLE_PLACEHOLDER_FALLBACK = EXAMPLE_COURSES[2];

export function isNamedLevel(value: string): value is NamedLevel {
  return (NAMED_LEVELS as readonly string[]).includes(value);
}

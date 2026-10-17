/**
 * Where alumni go next. A school sees counts, not names, unless the alumnus opts in.
 * Counts under five are left out.
 */

export const MIN_DESTINATION_BUCKET = 5;

export const DESTINATION_KINDS = ['university', 'college', 'institution', 'work', 'other'] as const;
export type DestinationKind = (typeof DESTINATION_KINDS)[number];

export type DestinationOutcome = 'hired' | 'studying' | 'other';

export interface DestinationChoice {
  kind: DestinationKind;
  name: string;
  course: string;
  country: string;
  source: 'stated' | 'detected';
  shareWithSchools: boolean;
  shareName: boolean;
  testimonial: string;
  shareTestimonial: boolean;
  /** Set when the learner states hired or studying. Otherwise the kind decides. */
  outcome?: DestinationOutcome;
}

export interface DestinationRow extends DestinationChoice {
  fromInstitutionId: string;
  learnerName: string;
}

export interface DestinationBucket {
  label: string;
  count: number;
}

export interface DestinationBoard {
  institutions: DestinationBucket[];
  countries: DestinationBucket[];
  courses: DestinationBucket[];
  named: { name: string; destination: string; course: string }[];
  testimonials: { quote: string; name: string }[];
  outcomes: DestinationBucket[];
  hiddenBuckets: number;
}

export function readDestinationKind(value: unknown): DestinationKind {
  return DESTINATION_KINDS.includes(value as DestinationKind) ? value as DestinationKind : 'other';
}

export function stateDestination(input: {
  kind: string;
  name: string;
  course?: string;
  country?: string;
  shareWithSchools: boolean;
  shareName: boolean;
  testimonial?: string;
  shareTestimonial: boolean;
  outcome?: string;
}): DestinationChoice | { error: string } {
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!name) return { error: 'Add the university, college, or workplace.' };
  const testimonial = (input.testimonial ?? '').replace(/\s+/g, ' ').trim().slice(0, 280);
  return {
    kind: readDestinationKind(input.kind),
    name,
    course: (input.course ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
    country: (input.country ?? '').trim().slice(0, 60),
    source: 'stated',
    shareWithSchools: input.shareWithSchools,
    shareName: input.shareName && input.shareWithSchools,
    testimonial,
    shareTestimonial: input.shareTestimonial && input.shareWithSchools && testimonial.length > 0,
    outcome: outcomeOf({ kind: readDestinationKind(input.kind), outcome: input.outcome }),
  };
}

export function outcomeOf(row: { kind: DestinationKind; outcome?: string }): DestinationOutcome {
  if (row.outcome === 'hired' || row.outcome === 'studying') return row.outcome;
  if (row.kind === 'work') return 'hired';
  if (row.kind === 'university' || row.kind === 'college' || row.kind === 'institution') return 'studying';
  return 'other';
}

/** Joining another Poket School academy can fill the next step only with consent. */
export function detectDestination(input: {
  consent: boolean;
  institutionName: string;
  level: string;
  country: string;
}): DestinationChoice | null {
  if (!input.consent) return null;
  const name = input.institutionName.trim();
  if (!name) return null;
  return {
    kind: 'institution',
    name,
    course: input.level.trim(),
    country: input.country.trim(),
    source: 'detected',
    shareWithSchools: true,
    shareName: false,
    testimonial: '',
    shareTestimonial: false,
    outcome: 'studying',
  };
}

function buckets(rows: readonly DestinationRow[], pick: (row: DestinationRow) => string): { shown: DestinationBucket[]; hidden: number } {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.shareWithSchools) continue;
    const label = pick(row).replace(/\s+/g, ' ').trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const shown: DestinationBucket[] = [];
  let hidden = 0;
  for (const [label, count] of counts) {
    if (count >= MIN_DESTINATION_BUCKET) shown.push({ label, count });
    else hidden += 1;
  }
  shown.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { shown, hidden };
}

export function destinationBoard(rows: readonly DestinationRow[]): DestinationBoard {
  const institutions = buckets(rows, (row) => row.name);
  const countries = buckets(rows, (row) => row.country);
  const courses = buckets(rows, (row) => row.course);
  const outcomes = buckets(rows, (row) => {
    const outcome = outcomeOf(row);
    if (outcome === 'hired') return 'Hired';
    if (outcome === 'studying') return 'Studying';
    return '';
  });
  const named = rows
    .filter((row) => row.shareWithSchools && row.shareName && row.learnerName.trim())
    .slice(0, 12)
    .map((row) => ({ name: row.learnerName.trim(), destination: row.name, course: row.course }));
  const testimonials = rows
    .filter((row) => row.shareWithSchools && row.shareTestimonial && row.testimonial.trim())
    .slice(0, 6)
    .map((row) => ({ quote: row.testimonial.trim(), name: row.shareName && row.learnerName.trim() ? row.learnerName.trim() : 'Alumnus' }));
  return {
    institutions: institutions.shown,
    countries: countries.shown,
    courses: courses.shown,
    named,
    testimonials,
    outcomes: outcomes.shown,
    hiddenBuckets: institutions.hidden + countries.hidden + courses.hidden + outcomes.hidden,
  };
}

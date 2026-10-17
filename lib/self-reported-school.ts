/**
 * A school a student types because it is not a registered Poket School institution.
 * The key groups punctuation and spacing variants. Country and state stay on the key
 * so the same words in two places remain two leads.
 */

export const DEFAULT_SCHOOL_STRIP_MINIMUM = 3;

export function schoolDisplayName(value: unknown): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text.slice(0, 80);
}

export function schoolSlug(name: string): string {
  const folded = schoolDisplayName(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return folded.slice(0, 80);
}

export function schoolKey(country: string, state: string, name: string): string {
  const slug = schoolSlug(name);
  if (!slug) return '';
  const place = `${country.trim().toUpperCase().slice(0, 2)}|${state.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)}`;
  return `${place}|${slug}`;
}

export interface SchoolLead {
  key: string;
  name: string;
  country: string;
  state: string;
  count: number;
  alumniCount: number;
  registeredInstitutionId: string;
  approvedForLanding: boolean;
  mergedInto: string;
}

export function leaderboardSchool(input: {
  institutionId?: string | null;
  institutionName?: string | null;
  selfReportedName?: string | null;
}): string {
  if ((input.institutionId ?? '').trim()) return schoolDisplayName(input.institutionName);
  return schoolDisplayName(input.selfReportedName);
}

/** Names allowed on the homepage strip. Unregistered names need approval and the count. Institutions need an admin opt-in. */
export function visibleSchoolNames(input: {
  minimum: number;
  unregistered: readonly { name: string; count: number; approved: boolean; mergedInto?: string }[];
  institutions: readonly { name: string; optedIn: boolean }[];
}): string[] {
  const minimum = Number.isFinite(input.minimum) ? Math.max(1, Math.round(input.minimum)) : DEFAULT_SCHOOL_STRIP_MINIMUM;
  const names = [
    ...input.unregistered
      .filter((row) => row.approved && !row.mergedInto && row.count >= minimum)
      .map((row) => row.name),
    ...input.institutions.filter((row) => row.optedIn).map((row) => row.name),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const clean = schoolDisplayName(name);
    const slug = schoolSlug(clean);
    if (!clean || !slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(clean);
  }
  return out;
}

export function schoolStripMinimum(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SCHOOL_STRIP_MINIMUM;
  return Math.min(1000, Math.max(1, Math.round(parsed)));
}

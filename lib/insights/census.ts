/**
 * Grouped counts for the Insights panel.
 * A bucket under five people is omitted so a chart cannot point at one student.
 */

import { ageTierFromDob } from '../age-tier';
import { toNamedLevel } from '../programmes';

export const MIN_BUCKET = 5;

export const DEMOGRAPHIC_CONSENT =
  'I agree that Poket School may store my gender, level, age band, and country or region and use them only in grouped statistics. Any group smaller than five people is hidden. This supports the PDPA and the GDPR. Poket School does not sell this information.';

export type Gender = 'male' | 'female';
export type AgeBand = 'under13' | 'teen' | 'adult' | 'unset';
export type CensusRole = 'student' | 'parent' | 'teacher' | 'other';
export type Membership = 'institution' | 'independent' | 'na';

export interface CensusFacet {
  country: string;
  state: string;
  gender: Gender | 'unset';
  level: string;
  role: CensusRole;
  ageBand: AgeBand;
  membership: Membership;
  city: string;
  institutionId: string;
  schoolKey: string;
  schoolName: string;
  schoolKind: 'verified' | 'unregistered' | '';
}

export interface DayMetrics {
  signups: number;
  active: number;
  enrolments: number;
  sparksSpent: number;
  sparksIssued: number;
}

export interface CensusCell {
  scope: string;
  country: string;
  state: string;
  gender: Gender | 'unset';
  level: string;
  count: number;
  roles: Partial<Record<CensusRole, number>>;
  ageBands: Partial<Record<AgeBand, number>>;
  membership: Partial<Record<Membership, number>>;
  days: Record<string, Partial<DayMetrics>>;
  weeks: Record<string, number>;
  months: Record<string, number>;
  cohorts: Record<string, { size?: number; retained?: Record<string, number> }>;
}

export interface GeoPlace {
  country: string;
  students: number;
  parents: number;
  teachers: number;
  institutions: number;
  states: { name: string; students: number; parents: number; teachers: number; institutions: number }[];
  cities: { name: string; count: number }[];
}

export interface SchoolRank {
  name: string;
  kind: 'verified' | 'unregistered';
  count: number;
  country: string;
  state: string;
  /** Verified rows use the institution id so an admin can scope the panel. */
  id?: string;
}

export interface InsightsView {
  suppressed: boolean;
  population: number;
  roles: Record<CensusRole, number>;
  gender: { male: number; female: number };
  levels: { name: string; count: number }[];
  ageBands: { band: string; count: number }[];
  membership: { independent: number; institution: number };
  countries: GeoPlace[];
  states: GeoPlace['states'];
  cities: { name: string; count: number }[];
  schools: SchoolRank[];
  series: ({ day: string } & DayMetrics)[];
  active: { dau: number; wau: number; mau: number };
  retention: { cohort: string; size: number; retained: number }[];
}

export function parseGender(value: unknown): Gender | '' {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'male' || text === 'm') return 'male';
  if (text === 'female' || text === 'f') return 'female';
  return '';
}

export function namedLevel(value: unknown): string {
  const named = toNamedLevel(typeof value === 'string' ? value : '');
  if (!named || /\byear\s*\d/i.test(named)) return '';
  return named.slice(0, 80);
}

export function censusRole(value: unknown): CensusRole {
  if (value === 'student' || value === 'parent' || value === 'teacher') return value;
  if (value === 'learner') return 'student';
  if (value === 'institution_admin') return 'teacher';
  return 'other';
}

export function fieldToken(value: string): string {
  const clean = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  return clean || 'unset';
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthKey(day: string): string {
  return day.slice(0, 7);
}

/** ISO week, Monday-based, from a YYYY-MM-DD day. */
export function weekKey(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const utc = new Date(Date.UTC(year || 1970, (month || 1) - 1, date || 1));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function coarseGeo(headers: { get(name: string): string | null }): { country: string; region: string; city: string } {
  const country = (headers.get('x-vercel-ip-country') || '').trim().toUpperCase();
  const region = (headers.get('x-vercel-ip-country-region') || '').trim().slice(0, 80);
  const city = (headers.get('x-vercel-ip-city') || '').trim().slice(0, 80);
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    region: /^-?\d+(\.\d+)?$/.test(region) ? '' : region,
    city: /^-?\d+(\.\d+)?$/.test(city) ? '' : city,
  };
}

export function censusFacet(input: {
  role?: unknown;
  roles?: unknown;
  gender?: unknown;
  level?: unknown;
  yearGroup?: unknown;
  country?: unknown;
  region?: unknown;
  geoCountry?: unknown;
  geoRegion?: unknown;
  geoCity?: unknown;
  institutionId?: unknown;
  dateOfBirth?: unknown;
  ageTier?: unknown;
  schoolName?: unknown;
  schoolKey?: unknown;
  today?: Date;
}): CensusFacet {
  const role = censusRole(input.role);
  const gender = parseGender(input.gender) || 'unset';
  const level = namedLevel(input.yearGroup) || namedLevel(input.level) || 'unset';
  const declaredCountry = typeof input.country === 'string' ? input.country.trim().toUpperCase().slice(0, 2) : '';
  const geoCountry = typeof input.geoCountry === 'string' ? input.geoCountry.trim().toUpperCase().slice(0, 2) : '';
  const country = /^[A-Z]{2}$/.test(declaredCountry) ? declaredCountry : (/^[A-Z]{2}$/.test(geoCountry) ? geoCountry : 'unset');
  const declaredState = typeof input.region === 'string' ? input.region.trim().slice(0, 80) : '';
  const geoState = typeof input.geoRegion === 'string' ? input.geoRegion.trim().slice(0, 80) : '';
  const state = declaredState || geoState || 'unset';
  const city = typeof input.geoCity === 'string' ? input.geoCity.trim().slice(0, 80) : '';
  const institutionId = typeof input.institutionId === 'string' ? input.institutionId.trim() : '';
  const schoolName = typeof input.schoolName === 'string' ? input.schoolName.trim().slice(0, 80) : '';
  const schoolKey = typeof input.schoolKey === 'string' ? input.schoolKey.trim() : '';
  let ageBand: AgeBand = 'unset';
  if (typeof input.dateOfBirth === 'string' && input.dateOfBirth) {
    ageBand = ageTierFromDob(input.dateOfBirth, input.today ?? new Date()) ?? 'unset';
  } else if (input.ageTier === 'under13' || input.ageTier === 'teen' || input.ageTier === 'adult') {
    ageBand = input.ageTier;
  }
  const membership: Membership = role !== 'student' ? 'na' : institutionId ? 'institution' : 'independent';
  const schoolKind = role === 'student' && institutionId ? 'verified' : role === 'student' && schoolKey ? 'unregistered' : '';
  return {
    country,
    state,
    gender,
    level,
    role,
    ageBand,
    membership,
    city,
    institutionId,
    schoolKey: schoolKind === 'verified' ? institutionId : schoolKey,
    schoolName: schoolKind === 'verified' ? schoolName : schoolName,
    schoolKind,
  };
}

export function sameFacet(a: CensusFacet | null, b: CensusFacet | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cellId(scope: string, facet: Pick<CensusFacet, 'country' | 'state' | 'gender' | 'level'>): string {
  return [scope, facet.country, fieldToken(facet.state), facet.gender, fieldToken(facet.level)].join('__');
}

const INDEXED: string[][] = [
  ['scope'],
  ['scope', 'country'],
  ['scope', 'country', 'state'],
  ['scope', 'country', 'state', 'gender'],
  ['scope', 'country', 'state', 'gender', 'level'],
  ['scope', 'country', 'state', 'level'],
  ['scope', 'country', 'gender'],
  ['scope', 'country', 'level'],
  ['scope', 'gender'],
  ['scope', 'level'],
  ['scope', 'level', 'gender'],
];

/** Equality filters that match a composite index. Leftover filters are applied in memory. */
export function indexedCellFilters(input: {
  scope: string;
  country?: string;
  state?: string;
  gender?: string;
  level?: string;
}): { query: Record<string, string>; rest: Record<string, string> } {
  const wanted: Record<string, string> = { scope: input.scope };
  if (input.country) wanted.country = input.country;
  if (input.state && input.country) wanted.state = input.state;
  if (input.gender) wanted.gender = input.gender;
  if (input.level) wanted.level = input.level;
  const ordered = ['scope'];
  if (wanted.country) ordered.push('country');
  if (wanted.state) ordered.push('state');
  if (wanted.country || wanted.state) {
    if (wanted.gender) ordered.push('gender');
    if (wanted.level) ordered.push('level');
  } else if (wanted.level) {
    ordered.push('level');
    if (wanted.gender) ordered.push('gender');
  } else if (wanted.gender) {
    ordered.push('gender');
  }
  let chain = ['scope'];
  for (const candidate of INDEXED) {
    if (candidate.length > chain.length && candidate.every((field, index) => ordered[index] === field)) chain = candidate;
  }
  const query: Record<string, string> = {};
  const rest: Record<string, string> = {};
  for (const [field, value] of Object.entries(wanted)) {
    if (chain.includes(field)) query[field] = value;
    else rest[field] = value;
  }
  return { query, rest };
}

function addNum(map: Record<string, number>, key: string, amount: number) {
  map[key] = (map[key] ?? 0) + amount;
}

export function foldCells(cells: readonly CensusCell[]): {
  count: number;
  roles: Record<string, number>;
  genders: Record<string, number>;
  levels: Record<string, number>;
  ageBands: Record<string, number>;
  membership: Record<string, number>;
  days: Record<string, DayMetrics>;
  weeks: Record<string, number>;
  months: Record<string, number>;
  cohorts: Record<string, { size: number; retained: Record<string, number> }>;
  places: Record<string, { students: number; parents: number; teachers: number }>;
} {
  const roles: Record<string, number> = {};
  const genders: Record<string, number> = {};
  const levels: Record<string, number> = {};
  const ageBands: Record<string, number> = {};
  const membership: Record<string, number> = {};
  const days: Record<string, DayMetrics> = {};
  const weeks: Record<string, number> = {};
  const months: Record<string, number> = {};
  const cohorts: Record<string, { size: number; retained: Record<string, number> }> = {};
  const places: Record<string, { students: number; parents: number; teachers: number }> = {};
  let count = 0;
  for (const cell of cells) {
    count += cell.count;
    addNum(genders, cell.gender, cell.count);
    if (cell.level && cell.level !== 'unset') addNum(levels, cell.level, cell.count);
    for (const [role, value] of Object.entries(cell.roles)) addNum(roles, role, value ?? 0);
    for (const [band, value] of Object.entries(cell.ageBands)) addNum(ageBands, band, value ?? 0);
    for (const [kind, value] of Object.entries(cell.membership)) addNum(membership, kind, value ?? 0);
    for (const [day, metrics] of Object.entries(cell.days)) {
      const row = days[day] ?? { signups: 0, active: 0, enrolments: 0, sparksSpent: 0, sparksIssued: 0 };
      row.signups += metrics.signups ?? 0;
      row.active += metrics.active ?? 0;
      row.enrolments += metrics.enrolments ?? 0;
      row.sparksSpent += metrics.sparksSpent ?? 0;
      row.sparksIssued += metrics.sparksIssued ?? 0;
      days[day] = row;
    }
    for (const [week, value] of Object.entries(cell.weeks)) addNum(weeks, week, value);
    for (const [month, value] of Object.entries(cell.months)) addNum(months, month, value);
    for (const [cohort, value] of Object.entries(cell.cohorts)) {
      const row = cohorts[cohort] ?? { size: 0, retained: {} };
      row.size += value.size ?? 0;
      for (const [month, kept] of Object.entries(value.retained ?? {})) addNum(row.retained, month, kept);
      cohorts[cohort] = row;
    }
    const place = places[`${cell.country}|${cell.state}`] ?? { students: 0, parents: 0, teachers: 0 };
    place.students += cell.roles.student ?? 0;
    place.parents += cell.roles.parent ?? 0;
    place.teachers += cell.roles.teacher ?? 0;
    places[`${cell.country}|${cell.state}`] = place;
  }
  return { count, roles, genders, levels, ageBands, membership, days, weeks, months, cohorts, places };
}

function shown(count: number): number {
  return count >= MIN_BUCKET ? count : 0;
}

export function presentInsights(input: {
  folded: ReturnType<typeof foldCells>;
  places: GeoPlace[];
  schools: readonly SchoolRank[];
  from: string;
  to: string;
  today: string;
  cities: { name: string; count: number }[];
}): InsightsView {
  const people = input.folded.count;
  if (people < MIN_BUCKET) {
    return emptyInsights();
  }
  const series = Object.entries(input.folded.days)
    .filter(([day]) => day >= input.from && day <= input.to)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, metrics]) => ({
      day,
      signups: shown(metrics.signups),
      active: shown(metrics.active),
      enrolments: shown(metrics.enrolments),
      sparksSpent: metrics.sparksSpent,
      sparksIssued: metrics.sparksIssued,
    }));
  const levels = Object.entries(input.folded.levels)
    .map(([name, count]) => ({ name, count: shown(count) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const countries = input.places
    .map((place) => ({
      ...place,
      students: shown(place.students),
      parents: shown(place.parents),
      teachers: shown(place.teachers),
      states: place.states.map((state) => ({
        ...state,
        students: shown(state.students),
        parents: shown(state.parents),
        teachers: shown(state.teachers),
      })).filter((state) => state.students || state.parents || state.teachers || state.institutions),
    }))
    .filter((place) => place.students || place.parents || place.teachers || place.institutions);
  const selectedStates = countries.flatMap((place) => place.states);
  return {
    suppressed: false,
    population: people,
    roles: {
      student: shown(input.folded.roles.student ?? 0),
      parent: shown(input.folded.roles.parent ?? 0),
      teacher: shown(input.folded.roles.teacher ?? 0),
      other: shown(input.folded.roles.other ?? 0),
    },
    gender: {
      male: shown(input.folded.genders.male ?? 0),
      female: shown(input.folded.genders.female ?? 0),
    },
    levels,
    ageBands: (['under13', 'teen', 'adult'] as const)
      .map((band) => ({ band: band === 'under13' ? 'Under 13' : band === 'teen' ? '13–17' : '18+', count: shown(input.folded.ageBands[band] ?? 0) }))
      .filter((row) => row.count > 0),
    membership: {
      independent: shown(input.folded.membership.independent ?? 0),
      institution: shown(input.folded.membership.institution ?? 0),
    },
    countries,
    states: selectedStates,
    cities: input.cities.filter((city) => city.count >= MIN_BUCKET),
    schools: input.schools.filter((school) => school.count >= MIN_BUCKET),
    series,
    active: {
      dau: shown(input.folded.days[input.today]?.active ?? 0),
      wau: shown(input.folded.weeks[weekKey(input.today)] ?? 0),
      mau: shown(input.folded.months[monthKey(input.today)] ?? 0),
    },
    retention: Object.entries(input.folded.cohorts)
      .map(([cohort, value]) => ({
        cohort,
        size: shown(value.size),
        retained: shown(Object.values(value.retained).reduce((sum, count) => sum + count, 0)),
      }))
      .filter((row) => row.size > 0),
  };
}

export function emptyInsights(): InsightsView {
  return {
    suppressed: true,
    population: 0,
    roles: { student: 0, parent: 0, teacher: 0, other: 0 },
    gender: { male: 0, female: 0 },
    levels: [],
    ageBands: [],
    membership: { independent: 0, institution: 0 },
    countries: [],
    states: [],
    cities: [],
    schools: [],
    series: [],
    active: { dau: 0, wau: 0, mau: 0 },
    retention: [],
  };
}

export function insightsCsv(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => cells.map((cell) => {
    const text = String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',');
  return [line(headers), ...rows.map(line)].join('\n');
}

export function placesFromFold(
  places: ReturnType<typeof foldCells>['places'],
  institutions: Record<string, number>,
): GeoPlace[] {
  const byCountry = new Map<string, GeoPlace>();
  for (const [key, value] of Object.entries(places)) {
    const [country, state] = key.split('|');
    const place = byCountry.get(country || 'unset') ?? {
      country: country || 'unset',
      students: 0,
      parents: 0,
      teachers: 0,
      institutions: institutions[country || 'unset'] ?? 0,
      states: [],
      cities: [],
    };
    place.students += value.students;
    place.parents += value.parents;
    place.teachers += value.teachers;
    if (state && state !== 'unset') {
      place.states.push({ name: state, ...value, institutions: 0 });
    }
    byCountry.set(country || 'unset', place);
  }
  return [...byCountry.values()].sort((a, b) => b.students - a.students || a.country.localeCompare(b.country));
}

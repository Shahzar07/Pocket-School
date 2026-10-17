import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { ageTierFromDob } from '../age-tier';
import {
  cellId,
  censusFacet,
  coarseGeo,
  dayKey,
  fieldToken,
  foldCells,
  indexedCellFilters,
  monthKey,
  placesFromFold,
  presentInsights,
  sameFacet,
  weekKey,
  type CensusCell,
  type CensusFacet,
  type GeoPlace,
  type InsightsView,
  type SchoolRank,
} from '../insights/census';

function db() {
  return adminDb();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function scopes(facet: CensusFacet): string[] {
  return facet.institutionId ? ['platform', facet.institutionId] : ['platform'];
}

function storedFacet(value: unknown): CensusFacet | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<CensusFacet>;
  if (!row.country || !row.role) return null;
  return censusFacet(row);
}

async function writeCell(scope: string, facet: CensusFacet, patch: Record<string, unknown>) {
  await db().doc(`insight_cells/${cellId(scope, facet)}`).set({
    scope,
    country: facet.country,
    state: facet.state,
    gender: facet.gender,
    level: facet.level,
    ...patch,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function shiftPeople(facet: CensusFacet, direction: 1 | -1) {
  const patch = {
    count: FieldValue.increment(direction),
    [`roles.${facet.role}`]: FieldValue.increment(direction),
    [`ageBands.${facet.ageBand}`]: FieldValue.increment(direction),
    [`membership.${facet.membership}`]: FieldValue.increment(direction),
  };
  const stateToken = fieldToken(facet.state);
  const cityToken = facet.city ? fieldToken(facet.city) : '';
  const roleField = facet.role === 'parent' ? 'parents' : facet.role === 'teacher' ? 'teachers' : facet.role === 'student' ? 'students' : 'other';
  for (const scope of scopes(facet)) {
    await writeCell(scope, facet, patch);
    const geo: Record<string, unknown> = {
      scope,
      country: facet.country,
      [roleField]: FieldValue.increment(direction),
      [`states.${stateToken}.label`]: facet.state,
      [`states.${stateToken}.${roleField}`]: FieldValue.increment(direction),
    };
    if (cityToken && facet.role === 'student') {
      geo[`cities.${cityToken}`] = FieldValue.increment(direction);
      geo[`cityLabels.${cityToken}`] = facet.city;
    }
    await db().doc(`insight_geo/${scope}__${facet.country}`).set(geo, { merge: true });
    if (facet.schoolKind && facet.schoolKey) {
      const schoolId = `${scope}__${facet.schoolKind}__${fieldToken(facet.schoolKey)}`;
      await db().doc(`insight_schools/${schoolId}`).set({
        scope,
        schoolKey: facet.schoolKey,
        name: facet.schoolName || facet.schoolKey,
        kind: facet.schoolKind,
        country: facet.country,
        state: facet.state,
        count: FieldValue.increment(direction),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
}

async function shiftEvents(facet: CensusFacet, day: string, patch: Record<string, unknown>) {
  for (const scope of scopes(facet)) await writeCell(scope, facet, patch);
}

function eventPatch(day: string, input: {
  signups?: number;
  active?: boolean;
  week?: boolean;
  month?: boolean;
  enrolments?: number;
  sparksSpent?: number;
  sparksIssued?: number;
  cohort?: string;
  retain?: string;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.signups) patch[`days.${day}.signups`] = FieldValue.increment(input.signups);
  if (input.active) patch[`days.${day}.active`] = FieldValue.increment(1);
  if (input.week) patch[`weeks.${weekKey(day)}`] = FieldValue.increment(1);
  if (input.month) patch[`months.${monthKey(day)}`] = FieldValue.increment(1);
  if (input.enrolments) patch[`days.${day}.enrolments`] = FieldValue.increment(input.enrolments);
  if (input.sparksSpent) patch[`days.${day}.sparksSpent`] = FieldValue.increment(input.sparksSpent);
  if (input.sparksIssued) patch[`days.${day}.sparksIssued`] = FieldValue.increment(input.sparksIssued);
  if (input.signups && input.cohort) patch[`cohorts.${input.cohort}.size`] = FieldValue.increment(1);
  if (input.cohort && input.retain) patch[`cohorts.${input.cohort}.retained.${input.retain}`] = FieldValue.increment(1);
  return patch;
}

function facetFromUser(data: Record<string, unknown>, today: Date): CensusFacet {
  const school = data.selfReportedSchool && typeof data.selfReportedSchool === 'object'
    ? data.selfReportedSchool as { name?: string; key?: string }
    : {};
  const institutionId = text(data.institutionId);
  return censusFacet({
    role: data.role,
    gender: data.gender,
    level: data.level,
    yearGroup: data.yearGroup,
    country: data.country,
    region: data.region,
    geoCountry: data.geoCountry,
    geoRegion: data.geoRegion,
    geoCity: data.geoCity,
    institutionId,
    dateOfBirth: data.dateOfBirth,
    ageTier: data.ageTier,
    schoolName: institutionId ? text(data.institutionName) : text(school.name),
    schoolKey: text(school.key),
    today,
  });
}

export async function reconcileUser(uid: string, patch: Record<string, unknown> = {}, headers?: { get(name: string): string | null }): Promise<void> {
  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = { ...(snap.data() ?? {}) };
  const today = new Date();
  const day = dayKey(today);
  const nextData: Record<string, unknown> = {};
  for (const key of ['gender', 'country', 'region', 'level', 'yearGroup', 'institutionName'] as const) {
    if (typeof patch[key] === 'string' && patch[key]) nextData[key] = patch[key];
  }
  if (patch.demographicConsent === true && !data.demographicConsentAt) {
    nextData.demographicConsentAt = Date.now();
  }
  if (typeof patch.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(patch.dateOfBirth)) {
    const ageTier = ageTierFromDob(patch.dateOfBirth, today);
    if (ageTier) {
      nextData.dateOfBirth = patch.dateOfBirth;
      nextData.ageTier = ageTier;
    }
  }
  if (headers && !text(data.geoCountry)) {
    const geo = coarseGeo(headers);
    if (geo.country) nextData.geoCountry = geo.country;
    if (geo.region) nextData.geoRegion = geo.region;
    if (geo.city) nextData.geoCity = geo.city;
  }
  const merged = { ...data, ...nextData };
  if (!text(merged.gender) && text(merged.institutionId)) {
    const invite = await db().doc(`institutions/${text(merged.institutionId)}/invites/${text(merged.email).toLowerCase()}`).get();
    const row = invite.data() ?? {};
    if (!text(merged.gender) && text(row.gender)) nextData.gender = row.gender;
    if (!text(merged.level) && text(row.level)) nextData.level = row.level;
    if (!text(merged.country) && text(row.country)) nextData.country = row.country;
    if (!text(merged.region) && text(row.state)) nextData.region = row.state;
    if (!text(merged.dateOfBirth) && text(row.dateOfBirth)) {
      const ageTier = ageTierFromDob(text(row.dateOfBirth), today);
      if (ageTier) {
        nextData.dateOfBirth = text(row.dateOfBirth);
        nextData.ageTier = ageTier;
      }
    }
  }
  if (patch.pendingChild && typeof patch.pendingChild === 'object') {
    nextData.pendingChild = patch.pendingChild;
  }
  const facet = facetFromUser({ ...merged, ...nextData }, today);
  if (facet.schoolKind === 'verified' && facet.institutionId && !facet.schoolName) {
    const academy = await db().doc(`institutions/${facet.institutionId}`).get();
    const branding = academy.data()?.branding as { displayName?: string } | undefined;
    facet.schoolName = text(branding?.displayName) || text(academy.data()?.name) || facet.institutionId;
  }
  const previous = storedFacet(data.insightFacet);
  if (previous && !sameFacet(previous, facet)) await shiftPeople(previous, -1);
  if (!previous || !sameFacet(previous, facet)) await shiftPeople(facet, 1);
  const events: Record<string, unknown> = {};
  if (!text(data.insightCohort)) {
    Object.assign(events, eventPatch(day, { signups: 1, cohort: monthKey(day) }));
    nextData.insightCohort = monthKey(day);
  }
  if (Object.keys(events).length) await shiftEvents(facet, day, events);
  nextData.insightFacet = facet;
  nextData.updatedAt = FieldValue.serverTimestamp();
  await ref.set(nextData, { merge: true });
}

export async function pulseUser(uid: string, now = new Date()): Promise<void> {
  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() ?? {};
  const facet = storedFacet(data.insightFacet) ?? facetFromUser(data, now);
  const day = dayKey(now);
  const week = weekKey(day);
  const month = monthKey(day);
  const patch = eventPatch(day, {
    active: text(data.insightSeenDay) !== day,
    week: text(data.insightSeenWeek) !== week,
    month: text(data.insightSeenMonth) !== month,
    cohort: text(data.insightCohort) || undefined,
    retain: text(data.insightRetainedMonth) !== month ? month : undefined,
  });
  if (!Object.keys(patch).length) return;
  if (text(data.insightSeenDay) === day && text(data.insightSeenWeek) === week && text(data.insightSeenMonth) === month) return;
  await shiftEvents(facet, day, patch);
  await ref.set({
    insightSeenDay: day,
    insightSeenWeek: week,
    insightSeenMonth: month,
    insightRetainedMonth: month,
    insightFacet: facet,
    lastActiveAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function recordLearning(uid: string, input: { enrolments?: number; sparks?: number }): Promise<void> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) return;
  const data = snap.data() ?? {};
  const facet = storedFacet(data.insightFacet) ?? facetFromUser(data, new Date());
  const day = dayKey(new Date());
  const spent = input.sparks && input.sparks < 0 ? Math.abs(input.sparks) : 0;
  const issued = input.sparks && input.sparks > 0 ? input.sparks : 0;
  const patch = eventPatch(day, { enrolments: input.enrolments, sparksSpent: spent, sparksIssued: issued });
  if (!Object.keys(patch).length) return;
  await shiftEvents(facet, day, patch);
}

function asCell(id: string, data: FirebaseFirestore.DocumentData): CensusCell {
  const days: CensusCell['days'] = {};
  const rawDays = data.days && typeof data.days === 'object' ? data.days as Record<string, Partial<CensusCell['days'][string]>> : {};
  for (const [day, metrics] of Object.entries(rawDays)) days[day] = metrics ?? {};
  return {
    scope: text(data.scope) || id.split('__')[0] || 'platform',
    country: text(data.country) || 'unset',
    state: text(data.state) || 'unset',
    gender: data.gender === 'male' || data.gender === 'female' ? data.gender : 'unset',
    level: text(data.level) || 'unset',
    count: Math.max(0, Math.round(Number(data.count ?? 0))),
    roles: (data.roles ?? {}) as CensusCell['roles'],
    ageBands: (data.ageBands ?? {}) as CensusCell['ageBands'],
    membership: (data.membership ?? {}) as CensusCell['membership'],
    days,
    weeks: (data.weeks ?? {}) as Record<string, number>,
    months: (data.months ?? {}) as Record<string, number>,
    cohorts: (data.cohorts ?? {}) as CensusCell['cohorts'],
  };
}

export async function readInsights(input: {
  scope: string;
  country?: string;
  state?: string;
  gender?: string;
  level?: string;
  from: string;
  to: string;
  today: string;
  includeLeads: boolean;
}): Promise<InsightsView> {
  const { query, rest } = indexedCellFilters({
    scope: input.scope,
    country: input.country,
    state: input.state,
    gender: input.gender,
    level: input.level,
  });
  let request: FirebaseFirestore.Query = db().collection('insight_cells');
  for (const [field, value] of Object.entries(query)) request = request.where(field, '==', value);
  const [cellsSnap, schoolsSnap, geoSnap] = await Promise.all([
    request.limit(400).get(),
    db().collection('insight_schools').where('scope', '==', input.scope).limit(300).get(),
    input.gender || input.level
      ? Promise.resolve(null)
      : db().collection('insight_geo').where('scope', '==', input.scope).limit(40).get(),
  ]);
  const cells = cellsSnap.docs
    .map((row) => asCell(row.id, row.data()))
    .filter((cell) => Object.entries(rest).every(([field, value]) => String(cell[field as keyof CensusCell] ?? '') === value));
  const folded = foldCells(cells);
  const schools: SchoolRank[] = schoolsSnap.docs.map((row) => {
    const data = row.data();
    const school: SchoolRank = {
      id: text(data.schoolKey),
      name: text(data.name),
      kind: data.kind === 'verified' ? 'verified' : 'unregistered',
      count: Math.max(0, Math.round(Number(data.count ?? 0))),
      country: text(data.country),
      state: text(data.state),
    };
    return school;
  }).filter((school) => (input.includeLeads || school.kind === 'verified')
    && (!input.country || school.country === input.country)
    && (!input.state || school.state === input.state));
  const institutions: Record<string, number> = {};
  for (const school of schools) {
    if (school.kind === 'verified') institutions[school.country] = (institutions[school.country] ?? 0) + 1;
  }
  const places: GeoPlace[] = placesFromFold(folded.places, institutions);
  const cities: { name: string; count: number }[] = [];
  if (geoSnap) {
    for (const row of geoSnap.docs) {
      const data = row.data();
      if (input.country && text(data.country) !== input.country) continue;
      const counts = data.cities && typeof data.cities === 'object' ? data.cities as Record<string, number> : {};
      const labels = data.cityLabels && typeof data.cityLabels === 'object' ? data.cityLabels as Record<string, string> : {};
      for (const [token, count] of Object.entries(counts)) cities.push({ name: labels[token] || token, count: Number(count) || 0 });
    }
  }
  return presentInsights({ folded, places, schools, from: input.from, to: input.to, today: input.today, cities });
}

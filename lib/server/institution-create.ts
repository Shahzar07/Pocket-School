import { FieldValue } from 'firebase-admin/firestore';
import { blankProfile } from '@/lib/enterprise';
import { adminDb } from '@/lib/firebase-admin';
import { rememberAdminTask } from '@/lib/server/admin-tasks';
import { ROCHFORD_SCHOOL, type RochfordFixture } from '@/lib/institutions/rochford';

export interface InstitutionDraft {
  name: string;
  type: 'school' | 'university' | 'corporate' | 'government';
  plan: 'starter' | 'team' | 'enterprise' | 'oem';
  country: string;
  state: string;
  city: string;
  group: string;
  campuses: string[];
  website: string;
  levels: string;
  seats: number;
  test: boolean;
  slug: string;
  adminId: string;
}

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return slug || 'institution';
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof value === 'string') {
    return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  }
  return [];
}

export function draftFromBody(body: Record<string, unknown>, adminId: string): { ok: true; value: InstitutionDraft } | { ok: false; error: string } {
  if (body.fixture === 'rochford') return { ok: true, value: draftFromRochford(adminId) };
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  if (name.length < 2) return { ok: false, error: 'Add the institution name.' };
  const type = body.type === 'university' || body.type === 'corporate' || body.type === 'government' ? body.type : 'school';
  const plan = body.plan === 'starter' || body.plan === 'enterprise' || body.plan === 'oem' ? body.plan : 'team';
  const country = typeof body.country === 'string' ? body.country.trim().toUpperCase().slice(0, 2) : '';
  const seats = typeof body.seats === 'number' ? body.seats : Number(body.seats);
  return {
    ok: true,
    value: {
      name,
      type,
      plan,
      country,
      state: typeof body.state === 'string' ? body.state.trim().slice(0, 80) : '',
      city: typeof body.city === 'string' ? body.city.trim().slice(0, 80) : '',
      group: typeof body.group === 'string' ? body.group.trim().slice(0, 120) : '',
      campuses: list(body.campuses),
      website: typeof body.website === 'string' ? body.website.trim().slice(0, 200) : '',
      levels: typeof body.levels === 'string' ? body.levels.trim().slice(0, 160) : '',
      seats: Number.isFinite(seats) && seats > 0 ? Math.min(100000, Math.round(seats)) : 0,
      test: body.test === true,
      slug: slugify(name),
      adminId,
    },
  };
}

export function draftFromRochford(adminId: string): InstitutionDraft {
  const school: RochfordFixture = ROCHFORD_SCHOOL;
  return {
    name: school.name,
    type: school.type,
    plan: school.plan,
    country: school.country,
    state: school.state,
    city: school.city,
    group: school.group,
    campuses: [...school.campuses],
    website: school.website,
    levels: school.levels,
    seats: 0,
    test: true,
    slug: school.slug,
    adminId,
  };
}

export async function createPlatformInstitution(draft: InstitutionDraft): Promise<{ id: string; created: boolean }> {
  const existing = await adminDb().collection('institutions').where('slug', '==', draft.slug).limit(1).get();
  const found = existing.docs[0];
  if (found) return { id: found.id, created: false };
  const profile = blankProfile({
    type: draft.type,
    country: draft.country,
    state: draft.state,
    plan: draft.plan,
    seatCount: draft.seats,
    address: { line1: '', line2: '', city: draft.city, region: draft.state, postalCode: '' },
  });
  const ref = adminDb().collection('institutions').doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    name: draft.name,
    adminId: draft.adminId,
    studentCount: 0,
    teacherCount: 0,
    status: 'pending',
    type: draft.type,
    country: draft.country,
    state: draft.state,
    city: draft.city,
    group: draft.group,
    campuses: draft.campuses,
    website: draft.website,
    levels: draft.levels,
    plan: draft.plan,
    listedForSelfJoin: false,
    test: draft.test,
    slug: draft.slug,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(adminDb().doc(`institutions/${ref.id}/settings/profile`), profile);
  await batch.commit();
  await rememberAdminTask({
    type: 'institution_verification',
    entityType: 'institutions',
    entityPath: `institutions/${ref.id}`,
    title: draft.name,
    summary: `Institution approval is waiting for ${draft.name}`,
    priority: 'medium',
    scope: draft.state ? { region: draft.state } : {},
    now: Date.now(),
  });
  return { id: ref.id, created: true };
}

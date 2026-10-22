import { ActionError } from '@/lib/server/actions';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { loadUser, type AuthedUser } from '@/lib/api-guard';
import { FUNNEL_COPY } from './copy';
import {
  funnelAdminAllowed,
  isFunnelTemplate,
  nextCopySlug,
  normalizeSlug,
  parseSections,
  summarize,
  templateSections,
  templateTitle,
  toPublic,
  validLeadEmail,
  validSlug,
  type FunnelLead,
  type FunnelRecord,
  type FunnelStatus,
  type FunnelSummary,
  type FunnelTemplate,
  type PublicFunnel,
} from './model';

const FUNNELS = 'funnels';
const LEADS = 'funnelLeads';

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function asStatus(value: unknown): FunnelStatus {
  return value === 'published' ? 'published' : 'draft';
}

function asTemplate(value: unknown): FunnelTemplate {
  return typeof value === 'string' && isFunnelTemplate(value) ? value : 'blank';
}

function asTime(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseFunnel(id: string, data: Record<string, unknown>): FunnelRecord {
  return {
    id,
    title: asText(data.title, 80) || 'Landing page',
    slug: validSlug(asText(data.slug, 48)) ? asText(data.slug, 48) : '',
    status: asStatus(data.status),
    template: asTemplate(data.template),
    sections: parseSections(data.sections),
    createdBy: asText(data.createdBy, 128),
    createdAt: asTime(data.createdAt),
    updatedAt: asTime(data.updatedAt),
    publishedAt: typeof data.publishedAt === 'number' ? data.publishedAt : null,
  };
}

async function assertFunnelAdmin(user: AuthedUser): Promise<void> {
  if (!isAdminConfigured()) throw new ActionError('SETUP_NEEDED', FUNNEL_COPY.setup);
  const profile = await loadUser(user.uid);
  const allowed = funnelAdminAllowed({
    email: user.email,
    tokenRole: user.role,
    tokenAdminRole: user.adminRole,
    profileRole: typeof profile?.role === 'string' ? profile.role : null,
    profileAdminRole: typeof profile?.adminRole === 'string' ? profile.adminRole : null,
  });
  if (!allowed) throw new ActionError('FORBIDDEN', FUNNEL_COPY.adminOnly);
}

async function readFunnel(id: string): Promise<FunnelRecord> {
  const snap = await adminDb().collection(FUNNELS).doc(id).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Landing page not found.');
  return parseFunnel(snap.id, snap.data() ?? {});
}

async function bySlug(slug: string): Promise<FunnelRecord[]> {
  if (!validSlug(slug)) return [];
  const snap = await adminDb().collection(FUNNELS).where('slug', '==', slug).limit(5).get();
  return snap.docs.map((doc) => parseFunnel(doc.id, doc.data() ?? {}));
}

export async function listFunnels(user: AuthedUser): Promise<{ funnels: FunnelSummary[] }> {
  await assertFunnelAdmin(user);
  const snap = await adminDb().collection(FUNNELS).limit(100).get();
  const funnels = snap.docs
    .map((doc) => summarize(parseFunnel(doc.id, doc.data())))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return { funnels };
}

export async function readFunnelDesk(user: AuthedUser, id: string): Promise<{ funnel: FunnelRecord; leads: FunnelLead[] }> {
  await assertFunnelAdmin(user);
  const funnel = await readFunnel(id);
  const leadSnap = await adminDb().collection(LEADS).where('funnelId', '==', id).limit(100).get();
  const leads = leadSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        funnelId: id,
        slug: asText(data.slug, 48),
        name: asText(data.name, 80),
        email: asText(data.email, 120),
        note: asText(data.note, 500),
        createdAt: asTime(data.createdAt),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return { funnel, leads };
}

export async function createFunnel(user: AuthedUser, template: FunnelTemplate): Promise<{ funnel: FunnelRecord }> {
  await assertFunnelAdmin(user);
  const now = Date.now();
  const ref = adminDb().collection(FUNNELS).doc();
  const funnel = parseFunnel(ref.id, {
    title: templateTitle(template),
    slug: '',
    status: 'draft',
    template,
    sections: templateSections(template),
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  });
  await ref.set(funnel);
  return { funnel };
}

export async function saveFunnel(
  user: AuthedUser,
  input: { id: string; title: string; slug: string; sections: unknown },
): Promise<{ funnel: FunnelRecord }> {
  await assertFunnelAdmin(user);
  const current = await readFunnel(input.id);
  const slug = normalizeSlug(input.slug);
  if (slug && !validSlug(slug)) throw new ActionError('BAD_REQUEST', FUNNEL_COPY.slugInvalid);
  if (slug) {
    const owner = (await bySlug(slug)).find((row) => row.id !== current.id);
    if (owner) throw new ActionError('BAD_REQUEST', FUNNEL_COPY.slugTaken);
  }
  const funnel: FunnelRecord = {
    ...current,
    title: asText(input.title, 80) || current.title,
    slug,
    sections: parseSections(input.sections),
    updatedAt: Date.now(),
  };
  await adminDb().collection(FUNNELS).doc(current.id).set(funnel);
  return { funnel };
}

export async function applyFunnelTemplate(user: AuthedUser, id: string, template: FunnelTemplate): Promise<{ funnel: FunnelRecord }> {
  await assertFunnelAdmin(user);
  const current = await readFunnel(id);
  const funnel: FunnelRecord = {
    ...current,
    template,
    title: current.title || templateTitle(template),
    sections: templateSections(template),
    status: 'draft',
    publishedAt: null,
    updatedAt: Date.now(),
  };
  await adminDb().collection(FUNNELS).doc(id).set(funnel);
  return { funnel };
}

export async function duplicateFunnel(user: AuthedUser, id: string): Promise<{ funnel: FunnelRecord }> {
  await assertFunnelAdmin(user);
  const current = await readFunnel(id);
  const snap = await adminDb().collection(FUNNELS).limit(200).get();
  const taken = new Set(snap.docs.map((doc) => asText(doc.get('slug'), 48)).filter(Boolean));
  const now = Date.now();
  const ref = adminDb().collection(FUNNELS).doc();
  const funnel = parseFunnel(ref.id, {
    title: `${current.title} copy`.slice(0, 80),
    slug: nextCopySlug(current.slug, taken),
    status: 'draft',
    template: current.template,
    sections: current.sections,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  });
  await ref.set(funnel);
  return { funnel };
}

export async function publishFunnel(user: AuthedUser, id: string, rawSlug: string): Promise<{ funnel: FunnelRecord }> {
  await assertFunnelAdmin(user);
  const current = await readFunnel(id);
  const slug = normalizeSlug(rawSlug || current.slug);
  if (!validSlug(slug)) throw new ActionError('BAD_REQUEST', FUNNEL_COPY.slugInvalid);
  const owner = (await bySlug(slug)).find((row) => row.id !== current.id);
  if (owner) throw new ActionError('BAD_REQUEST', FUNNEL_COPY.slugTaken);
  const now = Date.now();
  const funnel: FunnelRecord = {
    ...current,
    slug,
    status: 'published',
    publishedAt: now,
    updatedAt: now,
  };
  await adminDb().collection(FUNNELS).doc(id).set(funnel);
  return { funnel };
}

export async function unpublishFunnel(user: AuthedUser, id: string): Promise<{ funnel: FunnelRecord }> {
  await assertFunnelAdmin(user);
  const current = await readFunnel(id);
  const funnel: FunnelRecord = { ...current, status: 'draft', publishedAt: null, updatedAt: Date.now() };
  await adminDb().collection(FUNNELS).doc(id).set(funnel);
  return { funnel };
}

export async function publicFunnel(raw: string): Promise<
  | { state: 'none' }
  | { state: 'draft' }
  | { state: 'published'; funnel: PublicFunnel }
> {
  const slug = normalizeSlug(raw);
  if (!validSlug(slug) || !isAdminConfigured()) return { state: 'none' };
  try {
    const rows = await bySlug(slug);
    const published = rows.find((row) => row.status === 'published' && row.slug === slug);
    if (published) return { state: 'published', funnel: toPublic(published) };
    if (rows.length > 0) return { state: 'draft' };
    return { state: 'none' };
  } catch {
    return { state: 'none' };
  }
}

export async function submitFunnelLead(input: { slug: string; name: string; email: string; note: string }): Promise<{ ok: true }> {
  if (!isAdminConfigured()) throw new ActionError('SETUP_NEEDED', FUNNEL_COPY.setup);
  const slug = normalizeSlug(input.slug);
  const found = await publicFunnel(slug);
  if (found.state !== 'published') throw new ActionError('NOT_FOUND', FUNNEL_COPY.notPublished);
  const name = asText(input.name, 80);
  const email = asText(input.email, 120).toLowerCase();
  const note = asText(input.note, 500);
  if (name.length < 1) throw new ActionError('BAD_REQUEST', FUNNEL_COPY.leadNameMissing);
  if (!validLeadEmail(email)) throw new ActionError('BAD_REQUEST', FUNNEL_COPY.leadEmailMissing);
  const owner = (await bySlug(slug)).find((row) => row.status === 'published');
  if (!owner) throw new ActionError('NOT_FOUND', FUNNEL_COPY.notPublished);
  await adminDb().collection(LEADS).doc().set({
    funnelId: owner.id,
    slug,
    name,
    email,
    note,
    createdAt: Date.now(),
  });
  return { ok: true };
}

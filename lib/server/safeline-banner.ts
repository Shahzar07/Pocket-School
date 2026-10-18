import { adminDb } from '@/lib/firebase-admin';
import {
  OPEN_EMERGENCY,
  OPEN_HOTLINE,
  itemInScope,
  summariseBanner,
  type BannerActor,
  type BannerItem,
  type BannerSnapshot,
} from '@/lib/safety/banner';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function regionOf(data: Record<string, unknown>): { region: string; country: string } {
  const region = data.region && typeof data.region === 'object' ? data.region as Record<string, unknown> : {};
  return {
    region: text(data.state) || text(region.state),
    country: text(data.country) || text(region.country),
  };
}

export async function loadSafeLineBanner(actor: BannerActor, now = Date.now()): Promise<BannerSnapshot> {
  const href = actor.staff === 'super_admin' || actor.role === 'admin' || actor.staff === 'admin'
    ? '/dashboard/admin/hotline'
    : actor.role === 'institution_admin'
      ? '/dashboard/institution/hotline'
      : actor.role === 'teacher'
        ? '/dashboard/teacher/hotline'
        : actor.role === 'parent'
          ? '/dashboard/parent/hotline'
          : '';
  if (!href) return { show: false, count: 0, oldestLabel: '', href: '' };
  const [hotline, active, updated] = await Promise.all([
    adminDb().collection('hotline_tickets').where('priority', '==', 'high').limit(80).get(),
    adminDb().collection('emergency_alerts').where('status', '==', 'active').limit(40).get(),
    adminDb().collection('emergency_alerts').where('status', '==', 'updated').limit(40).get(),
  ]);
  const items: BannerItem[] = [];
  for (const doc of hotline.docs) {
    const data = doc.data() as Record<string, unknown>;
    const status = text(data.status);
    if (!(OPEN_HOTLINE as readonly string[]).includes(status)) continue;
    const place = regionOf(data);
    items.push({
      kind: 'hotline',
      institutionId: text(data.institutionId),
      region: place.region,
      country: place.country,
      parentUid: text(data.parentUid),
      dueAt: typeof data.slaDueAt === 'number' ? data.slaDueAt : 0,
    });
  }
  for (const doc of [...active.docs, ...updated.docs]) {
    const data = doc.data() as Record<string, unknown>;
    const status = text(data.status);
    if (!(OPEN_EMERGENCY as readonly string[]).includes(status)) continue;
    const place = regionOf(data);
    items.push({
      kind: 'emergency',
      institutionId: text(data.institutionId),
      region: place.region,
      country: place.country,
      parentUid: '',
      dueAt: typeof data.reviewDueAt === 'number' ? data.reviewDueAt : 0,
    });
  }
  const visible = items.filter((item) => itemInScope(actor, item));
  return summariseBanner(visible, href, now);
}

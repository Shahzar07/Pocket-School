import { slaRemaining } from '@/lib/admin/desk';

export const OPEN_HOTLINE = ['pending', 'in_progress', 'kiv'] as const;
export const OPEN_EMERGENCY = ['active', 'updated'] as const;

export interface BannerActor {
  uid: string;
  role: string;
  staff: string | null;
  institutionId: string;
  region: string;
  country: string;
}

export interface BannerItem {
  kind: 'hotline' | 'emergency';
  institutionId: string;
  region: string;
  country: string;
  parentUid: string;
  dueAt: number;
}

export interface BannerSnapshot {
  show: boolean;
  count: number;
  oldestLabel: string;
  href: string;
  comingSoon?: boolean;
}

export function bannerHref(actor: Pick<BannerActor, 'role' | 'staff'>): string | null {
  if (actor.role === 'partner_merchant' || actor.role === 'student') return null;
  if (actor.staff === 'super_admin' || actor.staff === 'admin' || actor.role === 'admin') return '/dashboard/admin/hotline';
  if (actor.role === 'institution_admin') return '/dashboard/institution/hotline';
  if (actor.role === 'teacher') return '/dashboard/teacher/hotline';
  if (actor.role === 'parent') return '/dashboard/parent/hotline';
  return null;
}

export function itemInScope(actor: BannerActor, item: BannerItem): boolean {
  if (!bannerHref(actor)) return false;
  if (actor.staff === 'super_admin') return true;
  if (actor.role === 'parent') return item.kind === 'hotline' && item.parentUid === actor.uid;
  if (actor.institutionId) return item.institutionId === actor.institutionId;
  if (actor.staff === 'admin' || actor.role === 'admin') {
    if (actor.region) return item.region === actor.region;
    if (actor.country) return item.country === actor.country;
    return false;
  }
  return false;
}

export function summariseBanner(items: readonly BannerItem[], href: string, now: number): BannerSnapshot {
  if (!href || items.length === 0) return { show: false, count: 0, oldestLabel: '', href };
  const due = items.map((item) => item.dueAt).filter((value) => Number.isFinite(value) && value > 0);
  const oldest = due.length ? Math.min(...due) : 0;
  return {
    show: true,
    count: items.length,
    oldestLabel: slaRemaining(oldest, now).label,
    href,
  };
}

/**
 * Who may download a lesson asset.
 * An admin toggle on the product overrides the tier rule in either direction.
 * With no toggle, a student needs tier 1 or an allocation for that product.
 */

export interface DownloadViewer {
  role?: string | null;
  tier?: number | null;
  permissions?: string[] | null;
  courseId?: string | null;
  /** true forces downloads on, false forces them off, absent follows the tier. */
  downloadsEnabled?: boolean | null;
}

export interface DownloadDecision {
  allowed: boolean;
  reason: string;
}

function allocated(permissions: string[], courseId: string): boolean {
  return permissions.some(permission =>
    permission === `alloc:free:${courseId}`
    || permission === `alloc:paid:${courseId}`
    || permission === `alloc:marketplace:${courseId}`
    || permission === `alloc:book:${courseId}`
    || permission.startsWith(`alloc:coupon:${courseId}:`)
    || new RegExp(`^alloc:institution:[^:]+:${courseId}$`).test(permission)
    || permission === `alloc:download:${courseId}`,
  );
}

export function canDownload(viewer: DownloadViewer): DownloadDecision {
  const role = viewer.role ?? 'student';
  if (role === 'admin') return { allowed: true, reason: 'Admin' };
  if (viewer.downloadsEnabled === false) return { allowed: false, reason: 'Downloads are turned off for this product' };
  if (role === 'teacher' || role === 'institution_admin') return { allowed: true, reason: 'Staff' };
  if (viewer.downloadsEnabled === true) return { allowed: true, reason: 'Downloads are turned on for this product' };
  const courseId = viewer.courseId ?? '';
  const permissions = viewer.permissions ?? [];
  if (courseId && allocated(permissions, courseId)) return { allowed: true, reason: 'Allocated' };
  if ((viewer.tier ?? 0) >= 1) return { allowed: true, reason: 'Included in this tier' };
  return { allowed: false, reason: 'Downloads need a paid tier or an allocation' };
}

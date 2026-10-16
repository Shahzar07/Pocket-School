export const VIEW_AS_KEY = 'poket-view-as';
export const ADMIN_ACTIVITY_KEY = 'poket-admin-active';

export interface ViewAsTarget {
  id: string;
  name: string;
  email: string;
}

export function readViewAs(): ViewAsTarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(VIEW_AS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewAsTarget;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeViewAs(target: ViewAsTarget) {
  sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(target));
  window.dispatchEvent(new Event('poket-view-as'));
  void import('@/lib/audit/report').then((mod) => mod.reportActivity({
    action: 'impersonation.start',
    targetType: 'user',
    targetId: target.id,
    targetLabel: target.email,
    after: { name: target.name, email: target.email },
  }));
}

export function clearViewAs() {
  const current = readViewAs();
  sessionStorage.removeItem(VIEW_AS_KEY);
  window.dispatchEvent(new Event('poket-view-as'));
  if (!current) return;
  void import('@/lib/audit/report').then((mod) => mod.reportActivity({
    action: 'impersonation.stop',
    targetType: 'user',
    targetId: current.id,
    targetLabel: current.email,
  }));
}

export function touchAdminActivity() {
  sessionStorage.setItem(ADMIN_ACTIVITY_KEY, String(Date.now()));
}

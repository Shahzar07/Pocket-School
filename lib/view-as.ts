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
}

export function clearViewAs() {
  sessionStorage.removeItem(VIEW_AS_KEY);
  window.dispatchEvent(new Event('poket-view-as'));
}

export function touchAdminActivity() {
  sessionStorage.setItem(ADMIN_ACTIVITY_KEY, String(Date.now()));
}

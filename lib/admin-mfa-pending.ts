/** Set while an admin password has been accepted and the second factor is still open. */
export const ADMIN_MFA_PENDING_KEY = 'poket-admin-mfa-pending';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function markAdminMfaPending(uid: string): void {
  storage()?.setItem(ADMIN_MFA_PENDING_KEY, uid);
}

export function clearAdminMfaPending(): void {
  storage()?.removeItem(ADMIN_MFA_PENDING_KEY);
}

export function adminMfaPending(uid: string | null | undefined): boolean {
  if (!uid) return false;
  return storage()?.getItem(ADMIN_MFA_PENDING_KEY) === uid;
}

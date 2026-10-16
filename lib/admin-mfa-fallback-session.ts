/** Remembers the password-accepted admin so the Google and authenticator actions survive a reload. No password is stored. */

const KEY = 'poket-admin-fallback-session';

export interface FallbackSession {
  uid: string;
  email: string;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveFallbackSession(session: FallbackSession): void {
  const uid = session.uid.trim();
  const email = session.email.trim().toLowerCase();
  if (!uid || !email.includes('@')) return;
  storage()?.setItem(KEY, JSON.stringify({ uid, email }));
}

export function readFallbackSession(): FallbackSession | null {
  const raw = storage()?.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const uid = 'uid' in parsed && typeof parsed.uid === 'string' ? parsed.uid.trim() : '';
    const email = 'email' in parsed && typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
    if (!uid || !email.includes('@')) return null;
    return { uid, email };
  } catch {
    return null;
  }
}

export function clearFallbackSession(): void {
  storage()?.removeItem(KEY);
}

import { auth } from './firebase';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Fetch with the signed-in user's Firebase ID token. */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ApiError('Sign in required.', 'UNAUTHENTICATED', 401);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof data.code === 'string' ? data.code : typeof data.error === 'string' ? data.error : 'REQUEST_FAILED';
    const message = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
    throw new ApiError(message, code, res.status);
  }
  return data;
}

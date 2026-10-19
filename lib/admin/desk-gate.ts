/** Admin desk availability. Auth is decided before any stub payload. */

export const ADMIN_SETUP_MESSAGE =
  'Setup needed: FIREBASE_SERVICE_ACCOUNT not set, so live data is unavailable.';

export interface DeskGateInput {
  authenticated: boolean;
  admin: boolean;
  configured: boolean;
}

export type DeskGate =
  | { status: 401; body: { error: string; code: 'UNAUTHENTICATED' } }
  | { status: 403; body: { error: string; code: 'FORBIDDEN' } }
  | { status: 200; body: { configured: false; setupNeeded: true; message: string } }
  | { status: 200; body: { configured: true } };

/** Anonymous callers get 401. A signed-in admin without the server account gets the setup state, never fake zeros. */
export function deskGate(input: DeskGateInput): DeskGate {
  if (!input.authenticated) {
    return { status: 401, body: { error: 'Sign in required.', code: 'UNAUTHENTICATED' } };
  }
  if (!input.admin) {
    return { status: 403, body: { error: 'Admin access required.', code: 'FORBIDDEN' } };
  }
  if (!input.configured) {
    return { status: 200, body: { configured: false, setupNeeded: true, message: ADMIN_SETUP_MESSAGE } };
  }
  return { status: 200, body: { configured: true } };
}

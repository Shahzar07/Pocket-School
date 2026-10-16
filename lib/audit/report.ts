import { auth } from '@/lib/firebase';
import type { ActivityDraft } from './model';

export type ReportInput = Pick<ActivityDraft, 'action' | 'targetType' | 'targetId' | 'targetLabel' | 'before' | 'after'>;

/** Asks the server to append an activity row. The server stamps actor, time, and IP. */
export async function reportActivity(input: ReportInput): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch('/api/audit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    /* The product action already finished. A missing log line is not shown as an error. */
  }
}

/** Failed sign-in has no session. The server stores the attempt, not a password. */
export async function reportFailedLogin(email: string, action: 'auth.login_failed' | 'auth.two_factor_failed' = 'auth.login_failed'): Promise<void> {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, email: email.trim().toLowerCase() }),
    });
  } catch {
    /* Ignore. Sign-in still shows its own message. */
  }
}

export function reportContentChange(input: ReportInput): void {
  void reportActivity(input);
}

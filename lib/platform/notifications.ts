import { authedFetch } from '@/lib/authed-fetch';
import type { PushReport } from '@/lib/push';
import { readingGoalMessage } from './push';

/**
 * Continue-reading rows for the parent notifications page, and the same
 * rows sent as category `goals` through `POST /api/push`.
 */
export interface ShelfNotice {
  id: string;
  title: string;
  message: string;
  href: string;
}

export function readingNotices(progress: Record<string, { percent: number }>): ShelfNotice[] {
  return Object.entries(progress)
    .filter(([, item]) => item.percent > 0 && item.percent < 100)
    .slice(0, 4)
    .map(([id, item]) => ({
      id: `read:${id}`,
      title: 'Continue',
      message: `${Math.round(item.percent)}% of the way through`,
      href: id.startsWith('seed:') ? `/courses/catalogue/${id.slice(5)}` : `/reads/read/${id}`,
    }));
}

/**
 * Post one reading notice for a signed-in parent or student.
 * Returns null when there is no recipient or the push route refuses the call.
 * Sample shelf profiles have no Firebase uid, so the page skips them.
 */
export async function postReadingNotice(recipientUid: string, notice: ShelfNotice): Promise<PushReport | null> {
  const uid = recipientUid.trim();
  if (!uid) return null;
  const message = readingGoalMessage(uid, notice);
  const res = await authedFetch('/api/push', {
    method: 'POST',
    body: JSON.stringify(message),
  });
  if (!res.ok) return null;
  return res.json() as Promise<PushReport>;
}

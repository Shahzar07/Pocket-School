import {
  isPushCategory,
  PUSH_CATEGORIES,
  sendGoalParentAlert,
  type PushCategory,
  type PushDeps,
  type PushMessage,
  type PushReport,
} from '@/lib/push';

export type { PushCategory };
export type PushRequest = PushMessage;

/** Check a push body before it is sent. Categories are the shared list in `lib/push`. */
export function parsePushRequest(raw: unknown): PushMessage | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'A push body is required.' };
  const body = raw as Record<string, unknown>;
  const recipientUid = typeof body.recipientUid === 'string' ? body.recipientUid.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.body === 'string' ? body.body.trim() : '';
  const link = typeof body.link === 'string' ? body.link.trim() : undefined;
  if (!recipientUid) return { error: 'recipientUid is required.' };
  if (!isPushCategory(category)) {
    const names = [...PUSH_CATEGORIES];
    const last = names.pop();
    return { error: `category must be ${names.join(', ')}, or ${last}.` };
  }
  if (!title || !message) return { error: 'title and body are required.' };
  return { recipientUid, category, title, body: message, link: link || undefined };
}

/** A continue-reading notice. Delivery always uses the goals category. */
export function readingGoalMessage(
  recipientUid: string,
  notice: { title: string; message: string; href: string },
): PushMessage {
  return {
    recipientUid,
    category: 'goals',
    title: notice.title,
    body: notice.message,
    link: notice.href,
  };
}

/** Send a reading notice through `sendGoalParentAlert`. */
export function deliverReadingGoal(message: PushMessage, deps: PushDeps): Promise<PushReport> {
  return sendGoalParentAlert(message, deps);
}

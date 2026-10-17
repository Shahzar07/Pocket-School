/** Categories the shared push sender accepts. Reading notices use `goals`. */
export const PUSH_CATEGORIES = ['goals', 'flags', 'attendance', 'digests', 'grades', 'assignments', 'general', 'alumni', 'institution', 'achievements'] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];

export interface PushRequest {
  recipientUid: string;
  category: PushCategory;
  title: string;
  body: string;
  link?: string;
}

export function parsePushRequest(raw: unknown): PushRequest | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'A push body is required.' };
  const body = raw as Record<string, unknown>;
  const recipientUid = typeof body.recipientUid === 'string' ? body.recipientUid.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.body === 'string' ? body.body.trim() : '';
  const link = typeof body.link === 'string' ? body.link.trim() : undefined;
  if (!recipientUid) return { error: 'recipientUid is required.' };
  if (!(PUSH_CATEGORIES as readonly string[]).includes(category)) {
    const names = [...PUSH_CATEGORIES];
    const last = names.pop();
    return { error: `category must be ${names.join(', ')}, or ${last}.` };
  }
  if (!title || !message) return { error: 'title and body are required.' };
  return { recipientUid, category: category as PushCategory, title, body: message, link: link || undefined };
}

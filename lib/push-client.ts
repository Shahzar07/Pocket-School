/**
 * Browser fan-out. The inbox write stays on the client. Delivery runs on
 * the server, which is the only place allowed to read deviceTokens.
 */
import { auth } from './firebase';
import type { PushCategory } from './push';

export interface PushRequest {
  recipientUid: string;
  category: PushCategory;
  title: string;
  body: string;
  link?: string;
}

export async function requestPush(input: PushRequest): Promise<void> {
  if (typeof window === 'undefined') return;
  const user = auth.currentUser;
  if (!user) return;
  const idToken = await user.getIdToken();
  await fetch('/api/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

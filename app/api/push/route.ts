import { NextResponse } from 'next/server';
import {
  isPushCategory,
  sendAttendanceAlert,
  sendDigest,
  sendFlagAlert,
  sendGoalParentAlert,
  sendPush,
  type PushCategory,
  type PushMessage,
} from '@/lib/push';
import { adminPushStore } from '@/lib/push-store';
import { sendToDevice } from '@/lib/push-transport';
import firebaseConfig from '@/firebase-applet-config.json';

async function callerUid(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return null;
  const body = await response.json() as { users?: Array<{ localId?: string }> };
  return body.users?.[0]?.localId ?? null;
}

export async function POST(request: Request) {
  const caller = await callerUid(request);
  if (!caller) return NextResponse.json({ error: 'Sign in to send a notification.' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    recipientUid?: string;
    category?: string;
    title?: string;
    body?: string;
    link?: string;
  } | null;
  if (!body?.recipientUid || !body.title || !body.body || !body.category || !isPushCategory(body.category)) {
    return NextResponse.json({ error: 'A recipient, category, title and body are required.' }, { status: 400 });
  }

  const message: PushMessage = {
    recipientUid: body.recipientUid,
    category: body.category,
    title: body.title.slice(0, 120),
    body: body.body.slice(0, 500),
    link: body.link,
  };
  const deps = { store: adminPushStore(), send: sendToDevice };
  try {
    const report = await dispatch(message.category, message, deps);
    return NextResponse.json(report);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Push store unavailable';
    return NextResponse.json({ error: messageText, sent: 0, pruned: [] }, { status: 503 });
  }
}

function dispatch(
  category: PushCategory,
  message: PushMessage,
  deps: Parameters<typeof sendPush>[1],
) {
  if (category === 'goals') return sendGoalParentAlert(message, deps);
  if (category === 'flags') return sendFlagAlert(message, deps);
  if (category === 'attendance') return sendAttendanceAlert(message, deps);
  if (category === 'digests') return sendDigest(message, deps);
  return sendPush(message, deps);
}

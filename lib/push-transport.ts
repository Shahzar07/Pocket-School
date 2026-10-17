/**
 * Expo, Web Push, and FCM HTTP v1. Invalid subscriptions are marked for pruning.
 * Web Push needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
 * FCM v1 needs FCM_SERVICE_ACCOUNT (service account JSON). It is optional.
 */
import { createSign } from 'node:crypto';
import type { DeviceToken, PushMessage, SendOutcome } from './push';
import { expoShouldPrune, webPushShouldPrune } from './push';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendExpo(token: DeviceToken, message: PushMessage): Promise<SendOutcome> {
  try {
  const response = await fetch(EXPO_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token.token,
      title: message.title,
      body: message.body,
      data: { url: message.link ?? '', category: message.category },
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (expoShouldPrune(body)) return { ok: false, prune: true };
  return { ok: response.ok, prune: false };
  } catch {
    return { ok: false, prune: false };
  }
}

export async function sendWebPush(token: DeviceToken, message: PushMessage): Promise<SendOutcome> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@poketschool.ai';
  const p256dh = token.keys?.p256dh;
  const auth = token.keys?.auth;
  if (!publicKey || !privateKey || !p256dh || !auth || !token.token.startsWith('https://')) {
    return { ok: false, prune: false };
  }

  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  try {
    await webpush.sendNotification(
      { endpoint: token.token, keys: { p256dh, auth } },
      JSON.stringify({
        title: message.title,
        body: message.body,
        link: message.link ?? '',
        category: message.category,
      }),
    );
    return { ok: true, prune: false };
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 0;
    return { ok: false, prune: webPushShouldPrune(status) };
  }
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let fcmToken: { value: string; exp: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT?.trim();
  if (!raw || !raw.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key, project_id: parsed.project_id };
  } catch {
    return null;
  }
}

function b64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

async function fcmAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmToken && fcmToken.exp > now + 60) return fcmToken.value;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key);
  const assertion = `${unsigned}.${b64url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new Error(`FCM token ${response.status}`);
  const json = await response.json() as { access_token?: string };
  if (!json.access_token) throw new Error('FCM token was empty.');
  fcmToken = { value: json.access_token, exp: now + 3500 };
  return json.access_token;
}

/**
 * FCM HTTP v1 when FCM_SERVICE_ACCOUNT is set. A legacy FCM_SERVER_KEY still
 * sends if the service account is absent. Missing credentials return quietly.
 */
export async function sendFcm(token: DeviceToken, message: PushMessage): Promise<SendOutcome> {
  if (!token.token) return { ok: false, prune: false };
  const account = serviceAccount();
  try {
    if (account) {
      const access = await fcmAccessToken(account);
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: token.token,
            notification: { title: message.title, body: message.body },
            data: { link: message.link ?? '', category: message.category },
          },
        }),
      });
      if (response.status === 404) return { ok: false, prune: true };
      return { ok: response.ok, prune: false };
    }
    const serverKey = process.env.FCM_SERVER_KEY?.trim();
    if (!serverKey || serverKey.startsWith('{')) return { ok: false, prune: false };
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${serverKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token.token,
        notification: { title: message.title, body: message.body },
        data: { link: message.link ?? '', category: message.category },
      }),
    });
    return { ok: response.ok, prune: false };
  } catch {
    return { ok: false, prune: false };
  }
}

export async function sendToDevice(token: DeviceToken, message: PushMessage): Promise<SendOutcome> {
  if (token.provider === 'expo') return sendExpo(token, message);
  if (token.provider === 'webpush') return sendWebPush(token, message);
  if (token.provider === 'fcm') return sendFcm(token, message);
  return { ok: false, prune: false };
}

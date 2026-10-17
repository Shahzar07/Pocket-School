/**
 * Expo and Web Push transports. Invalid subscriptions are marked for pruning.
 * Web Push needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
 */
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
      ...(message.sound ? { sound: message.sound, channelId: message.category } : {}),
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

/**
 * FCM web push. Without FCM_SERVER_KEY this returns quietly so a missing
 * key never throws. Expo tokens stay on the expo provider. A service-account
 * JSON in FCM_SERVICE_ACCOUNT is recognised and still no-ops here: sending
 * with that credential needs the Admin SDK messaging client, which this
 * process does not initialise.
 */
export async function sendFcm(token: DeviceToken, message: PushMessage): Promise<SendOutcome> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || serverKey.trim().startsWith('{') || !token.token) {
    return { ok: false, prune: false };
  }
  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
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

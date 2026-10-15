/**
 * Shared push delivery. Every sender loads `deviceTokens` where
 * `userId == recipientUid`, then sends through Expo or Web Push from
 * `provider`. A token whose prefs set the category to false is skipped.
 * Invalid tokens are deleted.
 *
 * Clients cannot read this collection. Callers pass a store that uses
 * the Admin SDK.
 */

export const PUSH_CATEGORIES = [
  'goals',
  'flags',
  'attendance',
  'digests',
  'grades',
  'assignments',
  'general',
] as const;

export type PushCategory = (typeof PUSH_CATEGORIES)[number];

export type PushProvider = 'expo' | 'webpush';

/** Document shape the Poketschool app writes at deviceTokens/{deviceId}. */
export interface DeviceToken {
  userId: string;
  token: string;
  platform: string;
  provider: PushProvider | string;
  deviceId: string;
  keys?: { p256dh?: string; auth?: string } | null;
  prefs?: Partial<Record<PushCategory, boolean>> | null;
  app?: string | null;
  updatedAt?: unknown;
}

export interface PushMessage {
  recipientUid: string;
  category: PushCategory;
  title: string;
  body: string;
  link?: string;
}

export interface PushStore {
  listForUser(userId: string): Promise<DeviceToken[]>;
  deleteToken(deviceId: string): Promise<void>;
}

export interface SendOutcome {
  ok: boolean;
  prune: boolean;
}

export interface PushDeps {
  store: PushStore;
  send: (token: DeviceToken, message: PushMessage) => Promise<SendOutcome>;
}

export interface PushReport {
  recipientUid: string;
  category: PushCategory;
  sent: number;
  skipped: number;
  pruned: string[];
}

export function isPushCategory(value: string): value is PushCategory {
  return (PUSH_CATEGORIES as readonly string[]).includes(value);
}

/** Missing prefs stay on. An explicit false opts that device out. */
export function wantsCategory(token: DeviceToken, category: PushCategory): boolean {
  return token.prefs?.[category] !== false;
}

export function tokensForRecipient(tokens: readonly DeviceToken[], userId: string): DeviceToken[] {
  return tokens.filter(token => token.userId === userId && token.token.trim().length > 0);
}

async function deliver(message: PushMessage, deps: PushDeps): Promise<PushReport> {
  const listed = await deps.store.listForUser(message.recipientUid);
  const tokens = tokensForRecipient(listed, message.recipientUid);
  const pruned: string[] = [];
  let sent = 0;
  let skipped = 0;

  for (const token of tokens) {
    if (!wantsCategory(token, message.category)) {
      skipped += 1;
      continue;
    }
    if (token.provider !== 'expo' && token.provider !== 'webpush') {
      skipped += 1;
      continue;
    }
    const outcome = await deps.send(token, message);
    if (outcome.prune && token.deviceId) {
      await deps.store.deleteToken(token.deviceId);
      pruned.push(token.deviceId);
      continue;
    }
    if (outcome.ok) sent += 1;
    else skipped += 1;
  }

  return { recipientUid: message.recipientUid, category: message.category, sent, skipped, pruned };
}

export function sendGoalParentAlert(message: PushMessage, deps: PushDeps): Promise<PushReport> {
  return deliver({ ...message, category: 'goals' }, deps);
}

export function sendFlagAlert(message: PushMessage, deps: PushDeps): Promise<PushReport> {
  return deliver({ ...message, category: 'flags' }, deps);
}

export function sendAttendanceAlert(message: PushMessage, deps: PushDeps): Promise<PushReport> {
  return deliver({ ...message, category: 'attendance' }, deps);
}

export function sendDigest(message: PushMessage, deps: PushDeps): Promise<PushReport> {
  return deliver({ ...message, category: 'digests' }, deps);
}

export function sendPush(message: PushMessage, deps: PushDeps): Promise<PushReport> {
  return deliver(message, deps);
}

const EXPO_PRUNE = new Set(['DeviceNotRegistered', 'InvalidCredentials', 'MismatchSenderId']);

export function expoShouldPrune(body: unknown): boolean {
  const data = (body as { data?: unknown } | null)?.data;
  const ticket = Array.isArray(data) ? data[0] : data;
  const error = (ticket as { details?: { error?: string } } | null)?.details?.error;
  return typeof error === 'string' && EXPO_PRUNE.has(error);
}

export function webPushShouldPrune(status: number): boolean {
  return status === 404 || status === 410;
}

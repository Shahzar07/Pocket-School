import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, isAdminConfigured } from '../../firebase-admin';
import { resolveFlags } from '../../feature-flags';
import { SECRET_SLOTS, describeSecret, isPlaceholder, maskSecret, type SecretView } from '../secrets';
import { DEFAULT_TAX, type TaxConfig } from '../tax';
import type { GatewayVendor } from '../providers';

export interface PaymentsSettings {
  gateway: GatewayVendor;
  gatewayExplicit: string | null;
  sstRate: number;
  tin: string;
  brn: string;
  classification: string;
  teacherShareBps: number;
  affiliateShareBps: number;
  flags: Record<string, boolean>;
  openrouterCapUsd: number | null;
  geminiCapUsd: number | null;
  openrouterSpentUsd: number;
  geminiSpentUsd: number;
}

function db() {
  return adminDb();
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function loadSettings(): Promise<PaymentsSettings> {
  const [payments, flags, spend] = await Promise.all([
    db().doc('platform_settings/payments').get(),
    db().doc('platform_settings/feature_flags').get(),
    db().doc('platform_settings/ai_spend').get(),
  ]);
  const pay = payments.data() ?? {};
  const flagDoc = flags.data() ?? {};
  const spendDoc = spend.data() ?? {};
  const overrides = flagDoc.overrides && typeof flagDoc.overrides === 'object'
    ? flagDoc.overrides as Record<string, boolean>
    : null;
  const gateway = str(pay.gateway);
  return {
    gateway: gateway === 'ipay88' || gateway === 'rms' ? gateway : 'billplz',
    gatewayExplicit: str(pay.gatewayMode) || null,
    sstRate: num(pay.sstRate, DEFAULT_TAX.sstRate),
    tin: str(pay.tin),
    brn: str(pay.brn),
    classification: str(pay.classification) || DEFAULT_TAX.classification,
    teacherShareBps: num(pay.teacherShareBps, 7000),
    affiliateShareBps: num(pay.affiliateShareBps, 1000),
    flags: resolveFlags(overrides, process.env.FEATURE_FLAGS),
    openrouterCapUsd: typeof spendDoc.openrouterCapUsd === 'number' ? spendDoc.openrouterCapUsd : null,
    geminiCapUsd: typeof spendDoc.geminiCapUsd === 'number' ? spendDoc.geminiCapUsd : null,
    openrouterSpentUsd: num(spendDoc.openrouterSpentUsd, 0),
    geminiSpentUsd: num(spendDoc.geminiSpentUsd, 0),
  };
}

export function taxFrom(settings: PaymentsSettings): TaxConfig {
  return {
    sstRate: settings.sstRate,
    countries: DEFAULT_TAX.countries,
    supplierName: DEFAULT_TAX.supplierName,
    tin: settings.tin || null,
    brn: settings.brn || null,
    classification: settings.classification,
  };
}

export async function savePaymentsPatch(patch: Record<string, unknown>): Promise<void> {
  await db().doc('platform_settings/payments').set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function saveFlagOverrides(overrides: Record<string, boolean>): Promise<void> {
  const snap = await db().doc('platform_settings/feature_flags').get();
  const current = (snap.data()?.overrides ?? {}) as Record<string, boolean>;
  await db().doc('platform_settings/feature_flags').set({
    overrides: { ...current, ...overrides },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function saveSpendCap(provider: 'openrouter' | 'gemini', monthlyUsd: number | null): Promise<void> {
  const field = provider === 'openrouter' ? 'openrouterCapUsd' : 'geminiCapUsd';
  await db().doc('platform_settings/ai_spend').set({
    [field]: monthlyUsd,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/** Records a small estimate so a cap can stop a runaway. Real invoices replace this later. */
export async function recordAiEstimate(provider: 'openrouter' | 'gemini', usd = 0.02): Promise<void> {
  const field = provider === 'openrouter' ? 'openrouterSpentUsd' : 'geminiSpentUsd';
  await db().doc('platform_settings/ai_spend').set({
    [field]: FieldValue.increment(usd),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function secretViews(): Promise<SecretView[]> {
  const stored = await db().collection('platform_secrets').get();
  const masked = new Map<string, string>();
  for (const doc of stored.docs) {
    const value = doc.data().masked;
    if (typeof value === 'string') masked.set(doc.id, value);
  }
  return SECRET_SLOTS.map((slot) => describeSecret(slot, process.env[slot.envVar], masked.get(slot.id) ?? null));
}

export async function secretValue(slotId: string): Promise<string | undefined> {
  const slot = SECRET_SLOTS.find((item) => item.id === slotId);
  if (!slot) return undefined;
  const fromEnv = process.env[slot.envVar];
  if (!isPlaceholder(fromEnv)) return fromEnv?.trim();
  const snap = await db().doc(`platform_secrets/${slotId}`).get();
  const value = snap.data()?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function writeSecret(slotId: string, value: string): Promise<void> {
  const slot = SECRET_SLOTS.find((item) => item.id === slotId);
  if (!slot) throw new Error('Unknown secret.');
  const trimmed = value.trim();
  if (trimmed.length < 8) throw new Error('That value is too short to be a key.');
  await db().doc(`platform_secrets/${slotId}`).set({
    value: trimmed,
    masked: maskSecret(trimmed),
    envVar: slot.envVar,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function clearSecret(slotId: string): Promise<void> {
  await db().doc(`platform_secrets/${slotId}`).delete();
}

/** Returns a message when the cap is already spent. A missing cap or a missing Admin SDK does not block AI. */
export async function gateAiSpend(provider: 'openrouter' | 'gemini'): Promise<string | null> {
  try {
    if (!isAdminConfigured()) return null;
    const settings = await loadSettings();
    const cap = provider === 'openrouter' ? settings.openrouterCapUsd : settings.geminiCapUsd;
    const spent = provider === 'openrouter' ? settings.openrouterSpentUsd : settings.geminiSpentUsd;
    if (cap == null) return null;
    if (spent >= cap) return 'The monthly AI spend cap has been reached. An admin can raise it under Integrations.';
    await recordAiEstimate(provider);
    return null;
  } catch {
    return null;
  }
}

export async function noteWebhook(provider: 'stripe' | 'gateway', ok: boolean, detail: string): Promise<void> {
  const prefix = provider === 'stripe' ? 'stripe' : 'gateway';
  await db().doc('platform_settings/webhook_health').set({
    [`${prefix}LastAt`]: new Date().toISOString(),
    [`${prefix}LastOk`]: ok,
    [`${prefix}LastDetail`]: detail.slice(0, 300),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function webhookHealth(): Promise<Record<string, unknown>> {
  const snap = await db().doc('platform_settings/webhook_health').get();
  return snap.data() ?? {};
}

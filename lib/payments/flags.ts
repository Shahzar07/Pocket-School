/**
 * Feature flags shared by payments and integrations.
 *
 * Overrides live in Firestore `platform_settings/feature_flags` and are written
 * only through the admin API. `FEATURE_FLAGS` env entries force a flag on
 * (`payments.stripe`) or off (`!payments.stripe`). Anything not mentioned keeps
 * its default. This module does not talk to Firestore, so the admin shell and
 * unit tests can share one decision.
 */

export interface FeatureFlag {
  id: string;
  label: string;
  group: 'payments' | 'integrations';
  defaultEnabled: boolean;
}

export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  { id: 'payments.stripe', label: 'Stripe', group: 'payments', defaultEnabled: true },
  { id: 'payments.stripe_connect', label: 'Stripe Connect payouts', group: 'payments', defaultEnabled: true },
  { id: 'payments.my_gateway', label: 'Malaysian gateway', group: 'payments', defaultEnabled: true },
  { id: 'payments.wallet', label: 'Poket wallet', group: 'payments', defaultEnabled: true },
  { id: 'payments.affiliates', label: 'Affiliates and referrals', group: 'payments', defaultEnabled: true },
  { id: 'payments.myinvois', label: 'MyInvois submission', group: 'payments', defaultEnabled: false },
  { id: 'integrations.zoom', label: 'Zoom', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.meet', label: 'Google Meet', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.teams', label: 'Microsoft Teams', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.whatsapp', label: 'WhatsApp Business', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.smtp', label: 'SMTP', group: 'integrations', defaultEnabled: true },
  { id: 'integrations.saml', label: 'SSO / SAML', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.lti', label: 'LTI', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.domains', label: 'Custom domains', group: 'integrations', defaultEnabled: true },
  { id: 'integrations.fcm', label: 'Firebase Cloud Messaging', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.expo', label: 'Expo push', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.openrouter', label: 'OpenRouter', group: 'integrations', defaultEnabled: true },
  { id: 'integrations.gemini', label: 'Gemini', group: 'integrations', defaultEnabled: true },
  { id: 'integrations.ocr', label: 'OCR', group: 'integrations', defaultEnabled: false },
  { id: 'integrations.speech', label: 'Speech', group: 'integrations', defaultEnabled: false },
];

export function flagDefinition(id: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((flag) => flag.id === id);
}

/**
 * Resolve one flag. Stored overrides win, then env force-on / force-off, then
 * the catalogue default. Unknown ids stay off.
 */
export function isFlagEnabled(
  id: string,
  overrides?: Record<string, boolean> | null,
  envList?: string | null,
): boolean {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, id)) {
    return overrides[id] === true;
  }
  if (envList) {
    const tokens = envList.split(',').map((part) => part.trim()).filter(Boolean);
    if (tokens.includes(`!${id}`)) return false;
    if (tokens.includes(id)) return true;
  }
  return flagDefinition(id)?.defaultEnabled ?? false;
}

export function resolveFlags(
  overrides?: Record<string, boolean> | null,
  envList?: string | null,
): Record<string, boolean> {
  const resolved: Record<string, boolean> = {};
  for (const flag of FEATURE_FLAGS) {
    resolved[flag.id] = isFlagEnabled(flag.id, overrides, envList);
  }
  return resolved;
}

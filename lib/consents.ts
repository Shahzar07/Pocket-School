/** Optional consents and the detected timezone. Versioned so a later wording change is visible. */

export const CONSENT_VERSION = '2026-10-19';

export function detectTimezone(fallback = 'Asia/Kuala_Lumpur'): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone.length > 1 ? zone : fallback;
  } catch {
    return fallback;
  }
}

export function consentStamp(accepted: boolean, now = Date.now()) {
  return {
    accepted,
    at: now,
    version: CONSENT_VERSION,
  };
}

export function signupConsentFields(input: {
  demographic: boolean;
  timezone: string;
  timezoneOn: boolean;
  amber: boolean;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const demographic = consentStamp(input.demographic, now);
  const amber = consentStamp(input.amber, now);
  return {
    demographicConsent: demographic.accepted,
    demographicConsentAt: demographic.at,
    demographicConsentVersion: demographic.version,
    timezone: input.timezoneOn ? input.timezone : '',
    timezoneAuto: input.timezoneOn,
    timezoneSetAt: now,
    timezoneVersion: CONSENT_VERSION,
    amberOptInAt: amber.at,
    amberOptInVersion: amber.version,
  };
}

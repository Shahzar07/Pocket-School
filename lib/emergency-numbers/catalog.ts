/**
 * Country emergency numbers cited from official pages on 17 October 2026.
 * A row with needsReview is stored so an editor can confirm it. The help page
 * labels those rows instead of presenting them as checked.
 */

export interface EmergencyNumbers {
  countryCode: string;
  countryName: string;
  police: string;
  ambulance: string;
  fire: string;
  general: string;
  childHelpline: string;
  childHelplineName: string;
  mentalHealth: string;
  mentalHealthName: string;
  childAlertName: string;
  childAlertUrl: string;
  sourceUrl: string;
  lastVerified: string;
  needsReview: boolean;
}

export const SEEDED_EMERGENCY_NUMBERS: readonly EmergencyNumbers[] = [
  {
    countryCode: 'MY',
    countryName: 'Malaysia',
    police: '999',
    ambulance: '999',
    fire: '999',
    general: '999',
    childHelpline: '15999',
    childHelplineName: 'Talian Kasih',
    mentalHealth: '',
    mentalHealthName: '',
    childAlertName: 'NUR Alert',
    childAlertUrl: 'https://rmp2u.rmp.gov.my/nur-alert',
    sourceUrl: 'https://www.malaysia.gov.my/en/topics/mers-999-emergency-line',
    lastVerified: '2026-10-17',
    needsReview: false,
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    police: '911',
    ambulance: '911',
    fire: '911',
    general: '911',
    childHelpline: '1-800-422-4453',
    childHelplineName: 'Childhelp National Child Abuse Hotline',
    mentalHealth: '988',
    mentalHealthName: '988 Suicide and Crisis Lifeline',
    childAlertName: 'AMBER Alert',
    childAlertUrl: 'https://amberalert.ojp.gov/',
    sourceUrl: 'https://www.usa.gov/report-crime',
    lastVerified: '2026-10-17',
    needsReview: false,
  },
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    police: '999',
    ambulance: '999',
    fire: '999',
    general: '999',
    childHelpline: '0800 1111',
    childHelplineName: 'Childline',
    mentalHealth: '116 123',
    mentalHealthName: 'Samaritans',
    childAlertName: 'Child Rescue Alert',
    childAlertUrl: 'https://missingpersons.police.uk/en-gb/child-rescue-alert',
    sourceUrl: 'https://www.gov.uk/report-child-abuse',
    lastVerified: '2026-10-17',
    needsReview: false,
  },
];

const ALIASES: Record<string, string> = {
  MY: 'MY',
  MALAYSIA: 'MY',
  US: 'US',
  USA: 'US',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  GB: 'GB',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
};

export function countryCodeOf(value: string): string {
  const key = value.trim().toUpperCase();
  return ALIASES[key] ?? (key.length === 2 ? key : '');
}

export function sameCountry(left: string, right: string): boolean {
  const a = countryCodeOf(left);
  const b = countryCodeOf(right);
  if (!a || !b) return false;
  return a === b;
}

/** Values a profile may store for one country. Targeting queries each of them. */
export function homeCountryQueries(country: string): string[] {
  const code = countryCodeOf(country);
  const names = code === 'MY'
    ? ['Malaysia']
    : code === 'US'
      ? ['United States', 'USA']
      : code === 'GB'
        ? ['United Kingdom', 'UK']
        : [];
  return [...new Set([country.trim(), code, ...names].filter(value => value.length > 0))];
}

export function numbersFor(country: string, rows: readonly EmergencyNumbers[] = SEEDED_EMERGENCY_NUMBERS): EmergencyNumbers | null {
  const code = countryCodeOf(country);
  return rows.find(row => row.countryCode === code) ?? null;
}

export function cleanEmergencyNumbers(value: unknown): EmergencyNumbers | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<EmergencyNumbers>;
  const countryCode = countryCodeOf(typeof row.countryCode === 'string' ? row.countryCode : '');
  if (!countryCode) return null;
  const text = (field: unknown) => (typeof field === 'string' ? field.trim().slice(0, 160) : '');
  const sourceUrl = text(row.sourceUrl);
  const lastVerified = text(row.lastVerified);
  const cited = sourceUrl.startsWith('https://') && /^\d{4}-\d{2}-\d{2}$/.test(lastVerified);
  return {
    countryCode,
    countryName: text(row.countryName) || countryCode,
    police: text(row.police),
    ambulance: text(row.ambulance),
    fire: text(row.fire),
    general: text(row.general),
    childHelpline: text(row.childHelpline),
    childHelplineName: text(row.childHelplineName),
    mentalHealth: text(row.mentalHealth),
    mentalHealthName: text(row.mentalHealthName),
    childAlertName: text(row.childAlertName),
    childAlertUrl: text(row.childAlertUrl),
    sourceUrl,
    lastVerified,
    needsReview: row.needsReview === true || !cited,
  };
}

export function mapsSearchUrl(query: 'police station' | 'hospital', location?: { lat: number; lng: number } | null): string {
  const place = location && Number.isFinite(location.lat) && Number.isFinite(location.lng)
    ? `${query} ${location.lat.toFixed(5)},${location.lng.toFixed(5)}`
    : query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

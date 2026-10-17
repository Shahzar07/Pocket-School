/**
 * Emergency-number catalogue. The seed is the offline copy.
 * A super admin edits the Firestore rows. Clients cannot write them.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  SEEDED_EMERGENCY_NUMBERS,
  cleanEmergencyNumbers,
  countryCodeOf,
  numbersFor,
  type EmergencyNumbers,
} from '../emergency-numbers/catalog';
import { ActionError } from './actions';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function listEmergencyNumbers(): Promise<EmergencyNumbers[]> {
  const stored = new Map<string, EmergencyNumbers>();
  try {
    const snap = await db().collection('platform_settings/emergency_numbers/catalog').limit(80).get();
    for (const doc of snap.docs) {
      const row = cleanEmergencyNumbers({ ...doc.data(), countryCode: doc.id });
      if (row) stored.set(row.countryCode, row);
    }
  } catch {
    return [...SEEDED_EMERGENCY_NUMBERS];
  }
  const merged = SEEDED_EMERGENCY_NUMBERS.map(row => stored.get(row.countryCode) ?? row);
  for (const [code, row] of stored) {
    if (!merged.some(item => item.countryCode === code)) merged.push(row);
  }
  return merged;
}

export async function emergencyNumbersFor(country: string): Promise<EmergencyNumbers | null> {
  const code = countryCodeOf(country);
  if (!code) return numbersFor(country);
  try {
    const snap = await db().doc(`platform_settings/emergency_numbers/catalog/${code}`).get();
    if (snap.exists) return cleanEmergencyNumbers({ ...snap.data(), countryCode: code });
  } catch {
    return numbersFor(country);
  }
  return numbersFor(country);
}

export async function saveEmergencyNumbers(actorUid: string, input: unknown) {
  const snap = await db().doc(`users/${actorUid}`).get();
  if (str(snap.data()?.role) !== 'admin') throw new ActionError('FORBIDDEN', 'A super admin edits emergency numbers.');
  const row = cleanEmergencyNumbers(input);
  if (!row) throw new ActionError('BAD_REQUEST', 'Choose a country code.');
  if (!row.general) throw new ActionError('BAD_REQUEST', 'Add the general emergency number.');
  await db().doc(`platform_settings/emergency_numbers/catalog/${row.countryCode}`).set({
    ...row,
    updatedBy: actorUid,
    updatedAt: Date.now(),
  });
  return row;
}

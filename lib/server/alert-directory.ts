/**
 * Loads the people the recipient resolver scores. The resolver decides
 * who is included. This file only reads accounts.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { alertPerson, type AlertPerson } from '../alerts/recipients';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function tierOf(data: FirebaseFirestore.DocumentData | undefined): number {
  const verification = data?.verification;
  if (!verification || typeof verification !== 'object') return 0;
  const tier = (verification as { tier?: unknown }).tier;
  return typeof tier === 'number' && Number.isFinite(tier) ? tier : 0;
}

export interface DirectoryPerson extends AlertPerson {
  email: string;
  name: string;
  language: string;
}

export function toDirectoryPerson(id: string, data: FirebaseFirestore.DocumentData | undefined): DirectoryPerson {
  const base = alertPerson({
    uid: id,
    role: str(data?.role),
    staffPost: str(data?.staffPost),
    institutionId: str(data?.institutionId),
    country: str(data?.country),
    state: str(data?.state),
    city: str(data?.city),
    homeCountry: str(data?.homeCountry),
    emergencyOptIn: data?.emergencyOptIn === true,
    verificationTier: tierOf(data),
  });
  return {
    ...base,
    email: str(data?.email),
    name: str(data?.name),
    language: str(data?.language) || str(data?.locale),
  };
}

export async function peopleAtInstitution(institutionId: string): Promise<DirectoryPerson[]> {
  if (!institutionId) return [];
  const snap = await db().collection('users').where('institutionId', '==', institutionId).limit(200).get();
  return snap.docs.map(doc => toDirectoryPerson(doc.id, doc.data()));
}

export async function peopleOptedIn(): Promise<DirectoryPerson[]> {
  const snap = await db().collection('users').where('emergencyOptIn', '==', true).limit(200).get();
  return snap.docs.map(doc => toDirectoryPerson(doc.id, doc.data()));
}

export async function superAdmins(): Promise<DirectoryPerson[]> {
  const snap = await db().collection('users').where('role', '==', 'admin').limit(20).get();
  return snap.docs.map(doc => toDirectoryPerson(doc.id, doc.data()));
}

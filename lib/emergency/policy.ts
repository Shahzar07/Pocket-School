/**
 * Amber and emergency alerts. Severity comes from lib/alerts/model.ts.
 * Publishing is two-person and server-only.
 */

import { type AlertSeverity } from '../alerts/model';
import { authorityShareReady, type AuthorityDecision } from '../authorities/policy';

export const EMERGENCY_TYPES = ['missing_child', 'lockdown', 'weather', 'medical', 'general'] as const;
export type EmergencyType = (typeof EMERGENCY_TYPES)[number];

export const EMERGENCY_STATUSES = ['draft', 'active', 'updated', 'resolved', 'closed', 'retracted'] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

export const DAILY_PUBLISH_CAP = 3;

export interface Region {
  country: string;
  state: string;
  city: string;
}

export interface AuthorityNotice {
  agency: string;
  referenceNumber: string;
  informedAt: number;
}

export interface EmergencyRecord {
  id: string;
  institutionId: string;
  type: EmergencyType;
  title: string;
  description: string;
  subjectName: string;
  region: Region;
  photoUrl: string;
  guardianConsent: boolean;
  consentId: string;
  /** Public views hide the name and photo. The stored document keeps both. */
  consentWithdrawn?: boolean;
  publicRedacted?: boolean;
  authoritiesInformed: AuthorityNotice | null;
  authorities: AuthorityDecision;
  status: EmergencyStatus;
  publishedBy: string;
  publishedAt: number | null;
  confirmedBy: string;
  confirmedAt: number | null;
  resolved: { by: string; at: number; outcome: string; authoritiesClosed: boolean } | null;
  publicShareEnabled: boolean;
  sharePaused: boolean;
  reviewEveryMs: number;
  reviewDueAt: number | null;
  retractedReason: string;
  ogVersion: number;
  counts: { views: number; shares: number };
}

export interface PublicEmergency {
  id: string;
  type: EmergencyType;
  title: string;
  description: string;
  subjectName: string;
  region: Region;
  photoUrl: string;
  status: EmergencyStatus;
  publishedAt: number | null;
  agency: string;
  referenceNumber: string;
  shareEnabled: boolean;
  noindex: boolean;
  emergencyNumber: string;
  disclaimer: string;
  ogVersion: number;
}

const NUMBERS: Record<string, string> = {
  MY: '999',
  MALAYSIA: '999',
  SG: '999',
  SINGAPORE: '999',
  GB: '999',
  UK: '999',
  US: '911',
  USA: '911',
  AU: '000',
  AUSTRALIA: '000',
};

export function isEmergencyType(value: string): value is EmergencyType {
  return (EMERGENCY_TYPES as readonly string[]).includes(value);
}

export function emergencySeverity(type: EmergencyType): AlertSeverity {
  if (type === 'missing_child' || type === 'lockdown' || type === 'medical') return 'critical';
  if (type === 'weather') return 'high';
  return 'medium';
}

/** Every live emergency alert bypasses quiet hours, including a general notice. */
export function bypassesQuietHours(_type: EmergencyType): boolean {
  return true;
}

export function emergencyNumber(country: string): string {
  const key = country.trim().toUpperCase();
  return NUMBERS[key] ?? '999';
}

export function disclaimerFor(country: string): string {
  const number = emergencyNumber(country);
  return `This page is not a replacement for emergency services. If someone is in danger, call ${number}.`;
}

export function canCreate(role: string, staffPost: string, verifiedStaff: boolean): boolean {
  if (role === 'admin') return true;
  if (!verifiedStaff) return false;
  return role === 'institution_admin' || staffPost === 'principal';
}

export function canConfirm(input: {
  publisherId: string;
  confirmerId: string;
  confirmerVerified: boolean;
  type: EmergencyType;
  authorities: boolean;
  consentOnFile: boolean;
}): string | null {
  if (!input.confirmerVerified) return 'A verified staff member confirms an alert.';
  if (!input.publisherId || input.publisherId === input.confirmerId) {
    return 'A second staff member has to confirm this alert.';
  }
  if (input.type === 'missing_child' && !input.authorities) {
    return 'Tell the authorities before a missing child alert is published.';
  }
  if (input.type === 'missing_child' && !input.consentOnFile) {
    return 'A guardian consent record is required before this alert is published.';
  }
  if (!input.authorities) return 'Inform the authorities before this alert is shared.';
  return null;
}

export function shareAllowed(input: {
  authorityStatus: string;
  enabled: boolean;
  paused: boolean;
  status: string;
}): boolean {
  if (!input.enabled || input.paused) return false;
  if (input.status === 'draft' || input.status === 'resolved' || input.status === 'closed' || input.status === 'retracted') {
    return false;
  }
  return authorityShareReady(input.authorityStatus);
}

export function regionMatch(profile: Region, region: Region): boolean {
  const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();
  if (!region.country || !same(profile.country, region.country)) return false;
  if (region.state && !same(profile.state, region.state)) return false;
  if (region.city && !same(profile.city, region.city)) return false;
  return true;
}

export function publicView(record: EmergencyRecord): PublicEmergency | null {
  if (record.status === 'draft') return null;
  const closed = record.status === 'resolved' || record.status === 'closed';
  const retracted = record.status === 'retracted';
  const heldBack = record.consentWithdrawn === true || record.publicRedacted === true;
  const redacted = closed || retracted || heldBack;
  const country = record.region.country;
  const notice = record.authorities.informed;
  let description = record.description;
  if (retracted) description = 'This alert was retracted. A correction has been posted.';
  else if (closed) description = 'This alert has been closed. Personal details have been removed.';
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    description,
    subjectName: redacted ? '' : record.subjectName,
    region: record.region,
    photoUrl: !redacted && record.guardianConsent ? record.photoUrl : '',
    status: record.status,
    publishedAt: record.publishedAt,
    agency: notice?.agency || record.authoritiesInformed?.agency || '',
    referenceNumber: notice?.reference || record.authoritiesInformed?.referenceNumber || '',
    shareEnabled: shareAllowed({
      authorityStatus: record.authorities.status,
      enabled: record.publicShareEnabled,
      paused: record.sharePaused || redacted,
      status: record.status,
    }),
    noindex: redacted,
    emergencyNumber: emergencyNumber(country),
    disclaimer: disclaimerFor(country),
    ogVersion: record.ogVersion,
  };
}

export function typeLabel(type: EmergencyType): string {
  if (type === 'missing_child') return 'Missing child';
  if (type === 'lockdown') return 'Lockdown';
  if (type === 'weather') return 'Weather';
  if (type === 'medical') return 'Medical';
  return 'General';
}

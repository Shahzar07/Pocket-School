/**
 * Amber alerts are free to receive and share.
 * Publishing stays with a tier-3 principal or a tier-4 partner.
 * The public page never includes a reporter, a hotline ticket, or an
 * unapproved detail about someone under 18.
 */

import { BRAND } from '../brand';
import {
  disclaimerFor,
  emergencyNumber,
  type EmergencyRecord,
  type Region,
} from '../emergency/policy';

export const AMBER_JOIN_CTA = 'Get free Amber alerts on Poket School';

/** Sample code for /amber/sample. Stored the same way as a real referrals/{code} doc. */
export const SAMPLE_AMBER_CODE = 'POKETAMBER';

export interface PublicApproval {
  name: boolean;
  photo: boolean;
  description: boolean;
}

export interface AmberPage {
  id: string;
  resolved: boolean;
  title: string;
  description: string;
  subjectName: string;
  photoUrl: string;
  city: string;
  state: string;
  country: string;
  agency: string;
  referenceNumber: string;
  publishedAt: number | null;
  shareEnabled: boolean;
  noindex: boolean;
  emergencyNumber: string;
  disclaimer: string;
  joinCta: string;
  referralCode: string;
  joinPath: string;
}

const EMPTY_APPROVAL: PublicApproval = { name: false, photo: false, description: false };

export function readApproval(value: Partial<PublicApproval> | null | undefined): PublicApproval {
  return {
    name: value?.name === true,
    photo: value?.photo === true,
    description: value?.description === true,
  };
}

/** Tier 3 principals and tier 4 partners. A missing tier is 0. Role admin is not enough. */
export function canPublishAmber(input: { tier: number; staffPost: string }): boolean {
  if (input.tier >= 4) return true;
  return input.tier >= 3 && input.staffPost === 'principal';
}

export function amberPublishRefusal(input: { tier: number; staffPost: string }): string | null {
  if (canPublishAmber(input)) return null;
  return 'An Amber alert is published by a tier 3 principal or a tier 4 partner.';
}

/**
 * Receiving, viewing, and sharing never consult a subscription or an access tier.
 * The argument is accepted so a caller cannot quietly add a gate later.
 */
export function amberReceiveAllowed(_accessTier?: number): true {
  return true;
}

export function amberJoinPath(code: string, country = ''): string {
  const params = new URLSearchParams();
  params.set('amber', '1');
  const clean = code.trim();
  if (clean) params.set('ref', clean);
  const place = country.trim();
  if (place) params.set('country', place);
  return `/signup?${params.toString()}`;
}

/** Firestore path the free card and the Amber card both use. */
export function amberReferralPath(code: string): string {
  const clean = code.trim();
  return clean ? `referrals/${clean}` : '';
}

export function amberSignupFields(input: {
  optIn: boolean;
  country: string;
  state?: string;
  referral?: string;
}): Record<string, string | boolean> {
  const fields: Record<string, string | boolean> = {};
  const code = (input.referral ?? '').trim().slice(0, 32);
  if (code) fields.referredBy = code;
  if (!input.optIn) return fields;
  const country = input.country.trim();
  if (country.length < 2) return fields;
  fields.emergencyOptIn = true;
  fields.homeCountry = country;
  const state = (input.state ?? '').trim();
  if (state) fields.state = state;
  return fields;
}

export function amberOptInPatch(input: {
  country: string;
  state?: string;
  city?: string;
  homeCountry?: string;
}): { ok: true; patch: { emergencyOptIn: true; homeCountry: string; country: string; state: string; city: string } } | { ok: false; error: string } {
  const country = input.country.trim();
  if (country.length < 2) return { ok: false, error: 'Choose a country for Amber alerts.' };
  const home = (input.homeCountry ?? '').trim() || country;
  return {
    ok: true,
    patch: {
      emergencyOptIn: true,
      country,
      homeCountry: home,
      state: (input.state ?? '').trim(),
      city: (input.city ?? '').trim(),
    },
  };
}

function closed(record: EmergencyRecord): boolean {
  return record.status === 'resolved'
    || record.status === 'closed'
    || record.status === 'retracted'
    || record.publicRedacted === true
    || record.consentWithdrawn === true;
}

/** Public Amber projection. Drafts and other emergency types are not this page. */
export function amberPage(record: EmergencyRecord): AmberPage | null {
  if (record.type !== 'missing_child') return null;
  if (record.status === 'draft') return null;
  const code = (record.referralCode ?? '').trim();
  const joinPath = amberJoinPath(code);
  const base = {
    id: record.id,
    joinCta: AMBER_JOIN_CTA,
    referralCode: code,
    joinPath,
    emergencyNumber: emergencyNumber(record.region.country),
    disclaimer: disclaimerFor(record.region.country),
  };
  if (closed(record)) {
    return {
      ...base,
      resolved: true,
      title: 'resolved',
      description: '',
      subjectName: '',
      photoUrl: '',
      city: '',
      state: '',
      country: '',
      agency: '',
      referenceNumber: '',
      publishedAt: null,
      shareEnabled: false,
      noindex: true,
    };
  }
  const approval = readApproval(record.publicApproval);
  const notice = record.authorities.informed;
  const photo = approval.photo && record.guardianConsent ? record.photoUrl : '';
  const description = approval.description
    ? (record.publicDescription || record.description).trim()
    : '';
  return {
    ...base,
    resolved: false,
    title: 'Missing child',
    description,
    subjectName: approval.name ? record.subjectName : '',
    photoUrl: photo,
    city: record.region.city,
    state: record.region.state,
    country: record.region.country,
    agency: notice?.agency || record.authoritiesInformed?.agency || '',
    referenceNumber: notice?.reference || record.authoritiesInformed?.referenceNumber || '',
    publishedAt: record.publishedAt,
    shareEnabled: record.publicShareEnabled === true && record.sharePaused !== true,
    noindex: false,
  };
}

export function amberPushBody(page: AmberPage, region: Region): string {
  if (page.resolved) return 'resolved';
  if (page.description) return page.description;
  const place = region.city || region.country;
  return place ? `Missing child alert in ${place}` : 'Missing child alert';
}

export function amberShareAccent(): string {
  return BRAND.cyan;
}

/**
 * Old public URLs permanently move to /amber/{id}.
 * Image routes move with the page so a cached share card resolves to the same id.
 */
export function amberCanonicalPath(pathname: string): string | null {
  const path = pathname.split('?')[0] ?? '';
  const match = path.match(/^\/alerts\/([^/]+)(\/(?:opengraph-image|twitter-image))?\/?$/);
  const id = match?.[1];
  if (!id || id === '.' || id === '..') return null;
  return `/amber/${id}${match[2] ?? ''}`;
}

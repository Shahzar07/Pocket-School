/**
 * Anti-bullying is free for every account, including one with no school.
 * Routing goes through resolveRecipients. This file holds the rules the
 * server and the tests share. It does not invent helpline numbers.
 */

import { createHash } from 'node:crypto';
import { parentsExcluded } from '../safety/policy';

export const BULLYING_JOIN_CTA = 'Get free anti-bullying help on Poket School';
export const SAMPLE_BULLYING_CODE = 'POKETSTAND';
export const NOT_A_COUNSELLOR = 'ET AI support is not a counsellor.';

/** Receiving help never consults a subscription or an access tier. */
export function bullyingReceiveAllowed(_accessTier?: number): true {
  return true;
}

export function bullyingJoinPath(code: string): string {
  const params = new URLSearchParams();
  params.set('help', 'bullying');
  const clean = code.trim();
  if (clean) params.set('ref', clean);
  return `/signup?${params.toString()}`;
}

export const DESK_SLA_MS = {
  critical: 15 * 60 * 1000,
  high: 60 * 60 * 1000,
  medium: 24 * 60 * 60 * 1000,
  low: 72 * 60 * 60 * 1000,
} as const;

export type DeskSeverity = keyof typeof DESK_SLA_MS;

export const DESK_HOURS = {
  timezone: 'Asia/Kuala_Lumpur',
  startMinutes: 8 * 60,
  endMinutes: 22 * 60,
} as const;

export const CHECK_IN_DELAYS_MS = [24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000] as const;
export const REPEATED_REPORT_LIMIT = 3;

export function isDeskSeverity(value: string): value is DeskSeverity {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low';
}

export function deskDueAt(now: number, severity: DeskSeverity): number {
  return now + DESK_SLA_MS[severity];
}

/** Critical and unacknowledged past the SLA goes to the backup and super admins. */
export function criticalNeedsEscalation(createdAt: number, staffAckAt: number, escalatedAt: number, now: number): boolean {
  if (staffAckAt > 0 || escalatedAt > 0) return false;
  return now - createdAt >= DESK_SLA_MS.critical;
}

export function checkInTimes(createdAt: number): number[] {
  return CHECK_IN_DELAYS_MS.map(delay => createdAt + delay);
}

export function checkInDue(dueAt: number, sentAt: number, now: number): boolean {
  return sentAt <= 0 && now >= dueAt;
}

/**
 * Desk hours are a config clock, not a helpline. Outside these hours a
 * risk screen shows helplines and Get help near me without waiting.
 */
export function deskOpen(now: number, timeZone = DESK_HOURS.timezone): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? '0');
  const minutes = hour * 60 + minute;
  return minutes >= DESK_HOURS.startMinutes && minutes < DESK_HOURS.endMinutes;
}

export interface OfficialHelpline {
  country: string;
  name: string;
  number: string;
  note: string;
  sourceUrl: string;
}

/**
 * Numbers below were read from the publisher's own page.
 * Other countries stay empty until a source URL is checked.
 * TODO: add a country only after its official page is opened and the number matches.
 */
export const OFFICIAL_HELPLINES: OfficialHelpline[] = [
  {
    country: 'Malaysia',
    name: 'Talian Kasih',
    number: '15999',
    note: '24 hours. Women, children, and family crises.',
    sourceUrl: 'https://www.malaysia.gov.my/en/topics/talian-kasih-15999',
  },
  {
    country: 'Malaysia',
    name: 'Befrienders KL',
    number: '+603-7627 2929',
    note: '24 hours, free and confidential.',
    sourceUrl: 'https://befrienders.org.my/',
  },
  {
    country: 'Malaysia',
    name: 'Talian HEAL',
    number: '15555',
    note: 'Mental-health crisis line, 8am to midnight.',
    sourceUrl: 'https://sites.google.com/moh.gov.my/ncemh/talian-sokongan-psikososial',
  },
];

export const PLATFORM_REPORT_LINKS = [
  { id: 'whatsapp', name: 'WhatsApp', href: 'https://www.whatsapp.com/safety' },
  { id: 'instagram', name: 'Instagram', href: 'https://help.instagram.com/' },
  { id: 'tiktok', name: 'TikTok', href: 'https://www.tiktok.com/safety' },
] as const;

export const OFF_PLATFORM_STEPS = [
  'Save the messages or photos in your evidence locker before they disappear.',
  'Tell a trusted adult, unless the concern is about that adult.',
  'Use the platform’s own report page. Poket School does not file it for you.',
  'If you are in danger now, call the emergency number for your country.',
] as const;

export function helplinesForCountry(country: string, lines = OFFICIAL_HELPLINES): OfficialHelpline[] {
  const key = country.trim().toLowerCase();
  const match = lines.filter(line => line.country.trim().toLowerCase() === key || (key === 'my' && line.country === 'Malaysia'));
  return match.filter(line => line.number.trim().length >= 3 && line.sourceUrl.startsWith('https://'));
}

export function helpNearMe(country: string): { emergencyNumber: string; directoryUrl: string; directoryName: string } | null {
  const key = country.trim().toLowerCase();
  if (key === 'malaysia' || key === 'my') {
    return {
      emergencyNumber: '999',
      directoryName: 'Befrienders KL',
      directoryUrl: 'https://befrienders.org.my/get-help/i-need-help-right-now/',
    };
  }
  return null;
}

const RISK_PATTERNS = [
  /\b(kill myself|end my life|want to die|suicide|self[- ]harm|cut myself)\b/i,
  /\b(tak nak hidup|nak mati|bunuh diri)\b/i,
];

export function riskSeverity(text: string): 'critical' | 'none' {
  const body = text.trim();
  if (!body) return 'none';
  return RISK_PATTERNS.some(pattern => pattern.test(body)) ? 'critical' : 'none';
}

export function supportResponse(text: string, country: string, now: number): {
  severity: 'critical' | 'none';
  showHelplines: boolean;
  showHelpNearMe: boolean;
  label: string;
} {
  const severity = riskSeverity(text);
  const open = deskOpen(now);
  return {
    severity,
    showHelplines: severity === 'critical' || !open,
    showHelpNearMe: severity === 'critical' || !open,
    label: NOT_A_COUNSELLOR,
  };
}

/** Over the cap flags the report for review. It is still accepted. */
export function reportRateFlag(countToday: number): { flagged: boolean; refused: false } {
  return { flagged: countToday >= 3, refused: false };
}

/** Repeated false reports are reviewed. They never restrict or mute the reporter. */
export function falseReportReview(previousFalse: number): { review: boolean; punish: false } {
  return { review: previousFalse >= 2, punish: false };
}

/** Repeated reports about one account limit new DMs and connection requests. */
export function repeatedReportLimits(openReports: number): { dmLimited: boolean; connectionLimited: boolean; review: boolean } {
  const over = openReports >= REPEATED_REPORT_LIMIT;
  return { dmLimited: over, connectionLimited: over, review: over };
}

export function outreachPaused(limits: { dmLimited?: boolean; connectionLimited?: boolean }, channel: 'dm' | 'connection'): { ok: boolean; reason: string } {
  if (channel === 'dm' && limits.dmLimited) {
    return { ok: false, reason: 'New messages are limited while reports about this account are reviewed.' };
  }
  if (channel === 'connection' && limits.connectionLimited) {
    return { ok: false, reason: 'New connection requests are limited while reports about this account are reviewed.' };
  }
  return { ok: true, reason: '' };
}

/**
 * Restrict hides the bully's comment from everyone except the bully.
 * The post owner and a Desk lead still need to moderate, so they can see it.
 */
export function commentVisible(input: {
  viewerId: string;
  authorId: string;
  postAuthorId: string;
  restrictedByPostAuthor: boolean;
  deskLead: boolean;
}): boolean {
  if (!input.restrictedByPostAuthor) return true;
  if (input.viewerId === input.authorId) return true;
  if (input.deskLead) return true;
  if (input.viewerId === input.postAuthorId) return true;
  return false;
}

export function evidenceHash(note: string, bytes: Uint8Array, at: number): string {
  const hash = createHash('sha256');
  hash.update(String(at));
  hash.update('\n');
  hash.update(note);
  hash.update(bytes);
  return hash.digest('hex');
}

export function canSeeEvidence(viewer: { id: string; role: string; staffPost: string }, item: {
  ownerId: string;
  guardianIds: string[];
  parentsExcluded: boolean;
}): boolean {
  if (viewer.role === 'admin' || viewer.staffPost === 'safety_desk') return true;
  if (viewer.id === item.ownerId) return true;
  if (!item.parentsExcluded && item.guardianIds.includes(viewer.id)) return true;
  return false;
}

export function guardianIdsFor(input: {
  under18: boolean;
  links: readonly { parentId: string; status: string; tier: number }[];
  exclusion: { type: string; who: string; concernRole: string; dontTellParents: boolean };
}): { ids: string[]; excluded: boolean } {
  const excluded = parentsExcluded(input.exclusion);
  if (!input.under18 || excluded) return { ids: [], excluded };
  return {
    ids: input.links.filter(link => link.status === 'approved' && link.tier >= 2 && link.parentId).map(link => link.parentId),
    excluded: false,
  };
}

/** The school sees a referral without the reporter's name or id. */
export function schoolReferralPayload(input: {
  bullySchoolId: string;
  consent: boolean;
  where: string;
  summary: string;
}): { ok: true; payload: { bullySchoolId: string; where: string; summary: string; reporterHidden: true } } | { ok: false; error: string } {
  if (!input.consent) return { ok: false, error: 'The person who reported this has to agree before a school is told.' };
  const school = input.bullySchoolId.trim();
  if (!school) return { ok: false, error: 'Choose the school that is on Poket School.' };
  const summary = input.summary.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (summary.length < 3) return { ok: false, error: 'Write a short account with no names.' };
  return {
    ok: true,
    payload: {
      bullySchoolId: school,
      where: input.where.slice(0, 40),
      summary,
      reporterHidden: true,
    },
  };
}

export function severityForSafetyType(type: string): DeskSeverity {
  if (type === 'self_harm_concern' || type === 'abuse') return 'critical';
  if (type === 'bullying' || type === 'cyberbullying' || type === 'harassment') return 'high';
  if (type === 'discrimination') return 'medium';
  return 'low';
}

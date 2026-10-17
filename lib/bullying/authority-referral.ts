/**
 * Authority referrals for high and critical safety cases.
 * Official channels are copied from pages that were opened.
 * A country with no checked page stays empty. Do not invent a number or an email.
 */

import type { AuthorityDecision } from '../authorities/policy';
import { originFromUrl, safetyMessageFooter } from '../safety/disclaimer';

export const REFERRED_TO_AUTHORITIES = 'Referred to authorities';
export const DESK_NOT_EMERGENCY = 'The Safety Desk does not replace emergency services.';
export const AUTHORITY_DECISION_REQUIRED = 'Record whether to refer this case to the authorities, or why it is not needed, before closing.';
export const AUTHORITY_SEND_REQUIRED = 'Send the authority referral, with an agency and a reference, before closing.';

export const REFERRAL_STATUSES = ['draft', 'sent', 'acknowledged', 'closed'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

const HIGH = new Set(['high', 'critical', 'bullying', 'cyberbullying', 'harassment', 'abuse', 'self_harm_concern']);

const HARMS: { id: string; pattern: RegExp }[] = [
  { id: 'violence', pattern: /\b(assault|beat(?:en|ing)?|threat(?:ened)? to hurt|kill you|weapon)\b/i },
  { id: 'sexual', pattern: /\b(sexual|nude photos|nudes|exploitation|child porn)\b/i },
  { id: 'extortion', pattern: /\b(extort|blackmail|sextortion)\b/i },
  { id: 'self_harm', pattern: /\b(self[- ]harm|suicide|kill myself|want to die)\b/i },
  { id: 'hate', pattern: /\b(hate crime|racial abuse)\b/i },
];

export interface OfficialChannel {
  id: string;
  country: string;
  kind: 'police' | 'helpline' | 'scam';
  agency: string;
  how: string;
  sourceUrl: string;
  phone: string;
}

/**
 * Checked pages:
 * - PDRM FAQ: a crime report is made at a police station. e-Reporting is not for crime.
 * - Talian Kasih 15999 on malaysia.gov.my.
 * - NSRC 997 on the National Anti-Financial Crime Centre page, for scams.
 * TODO: add another country only after its official page is opened.
 * TODO: add MCMC Cyber999 only after the official reporting URL is opened and the address matches.
 */
export const OFFICIAL_AUTHORITY_CHANNELS: OfficialChannel[] = [
  {
    id: 'my-police-station',
    country: 'Malaysia',
    kind: 'police',
    agency: 'Royal Malaysia Police',
    how: 'Make the report in person at a police station. The PDRM e-Reporting site is for a lost item that is not a crime, so it is not used here.',
    sourceUrl: 'https://rmp2u.rmp.gov.my/faq',
    phone: '',
  },
  {
    id: 'my-talian-kasih',
    country: 'Malaysia',
    kind: 'helpline',
    agency: 'Talian Kasih',
    how: 'Child and family line, 24 hours.',
    sourceUrl: 'https://www.malaysia.gov.my/en/topics/talian-kasih-15999',
    phone: '15999',
  },
  {
    id: 'my-nsrc',
    country: 'Malaysia',
    kind: 'scam',
    agency: 'National Scam Response Centre',
    how: 'For a financial scam or extortion that took money. A police report at a station is still required.',
    sourceUrl: 'https://nfcc.jpm.gov.my/index.php/en/about-nsrc',
    phone: '997',
  },
];

const MALAYSIA_SEXUAL_NOTE = 'For suspected child sexual abuse, Malaysian guidance says to tell the police or Talian Kasih 15999. The note cites sections 27 to 29A of the Child Act 2001 and section 19 of the Sexual Offences Against Children Act 2017.';
const MALAYSIA_SEXUAL_SOURCE = 'https://petari.bheuu.gov.my/wp-content/uploads/2025/10/UNICEF-Child-Sexual-Abuse-Report-Final-FA_Digital-Version-Interactive-pdf-compressed.pdf';

export function harmIds(text: string): string[] {
  return HARMS.filter(row => row.pattern.test(text)).map(row => row.id);
}

export function authorityCaseRequired(input: { deskSeverity: string; safetyType: string; text: string }): boolean {
  if (HIGH.has(input.deskSeverity) || HIGH.has(input.safetyType)) return true;
  return harmIds(input.text).length > 0;
}

export function authorityCloseMessage(input: {
  source: string;
  safetyType: string;
  deskSeverity: string;
  text: string;
  required: string;
  status: string;
  closing: boolean;
}): string | null {
  if (!input.closing) return null;
  if (input.source !== 'student_safety_report' && input.source !== 'danger_now') return null;
  if (!authorityCaseRequired(input)) return null;
  if (input.required === 'no' && input.status === 'not_required') return null;
  if (input.required === 'yes' && (input.status === 'informed' || input.status === 'acknowledged' || input.status === 'closed_by_authority')) {
    return null;
  }
  if (input.required === 'yes') return AUTHORITY_SEND_REQUIRED;
  return AUTHORITY_DECISION_REQUIRED;
}

export function channelsFor(country: string, text: string, channels = OFFICIAL_AUTHORITY_CHANNELS): OfficialChannel[] {
  const key = country.trim().toLowerCase();
  const malaysia = key === 'malaysia' || key === 'my';
  const harms = harmIds(text);
  return channels.filter(row => {
    if (!row.sourceUrl.startsWith('https://')) return false;
    if (row.how.includes('@')) return false;
    const same = malaysia ? row.country === 'Malaysia' : row.country.trim().toLowerCase() === key;
    if (!same) return false;
    if (row.kind === 'scam') return harms.includes('extortion');
    return true;
  });
}

export function mandatoryReportingNote(country: string, text: string): { note: string; sourceUrl: string } {
  const key = country.trim().toLowerCase();
  const malaysia = key === 'malaysia' || key === 'my';
  if (malaysia && harmIds(text).includes('sexual')) {
    return { note: MALAYSIA_SEXUAL_NOTE, sourceUrl: MALAYSIA_SEXUAL_SOURCE };
  }
  return { note: '', sourceUrl: '' };
}

export function referralFamily(input: {
  parentsExcluded: boolean;
  abuseByParent: boolean;
  withholdStudent: boolean;
  withholdReason: string;
}): { ok: true; tellStudent: boolean; tellGuardians: boolean; trackerVisible: boolean } | { ok: false; error: string } {
  const reason = input.withholdReason.replace(/\s+/g, ' ').trim();
  if (input.withholdStudent && reason.length < 8) {
    return { ok: false, error: 'Write why telling the student would put them at risk.' };
  }
  const tellGuardians = !input.parentsExcluded && !input.abuseByParent;
  const tellStudent = !input.withholdStudent;
  return { ok: true, tellStudent, tellGuardians, trackerVisible: tellStudent };
}

export function referralSummary(summary: string, reporterName: string): { ok: true; summary: string } | { ok: false; error: string } {
  const text = summary.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (text.length < 3) return { ok: false, error: 'Write a short account with no names.' };
  const name = reporterName.trim().toLowerCase();
  if (name.length >= 2 && text.toLowerCase().includes(name)) {
    return { ok: false, error: 'Take the reporter’s name out of the summary.' };
  }
  return { ok: true, summary: text };
}

export function partnerEligible(input: {
  tier: number;
  partnerKind: string;
  country: string;
  region: string;
  wantedCountry: string;
  wantedRegion: string;
}): boolean {
  if (input.tier < 4) return false;
  if (input.partnerKind !== 'police' && input.partnerKind !== 'child_protection') return false;
  const country = input.country.trim().toLowerCase();
  const wanted = input.wantedCountry.trim().toLowerCase();
  const malaysia = (value: string) => value === 'malaysia' || value === 'my';
  if (!(malaysia(country) && malaysia(wanted)) && country !== wanted) return false;
  if (input.wantedRegion.trim() && input.region.trim()) {
    return input.region.trim().toLowerCase() === input.wantedRegion.trim().toLowerCase();
  }
  return true;
}

export function authorityCaseMessage(input: {
  agency: string;
  incidentType: string;
  dates: string;
  summary: string;
  caseUrl: string;
}): { subject: string; text: string } {
  const lines = [
    'Confidential case for a verified partner',
    `Agency: ${input.agency}`,
    `Incident type: ${input.incidentType}`,
    `Dates: ${input.dates}`,
    `Summary: ${input.summary}`,
    `Open the case: ${input.caseUrl}`,
    'The reporter is not named in this message.',
    DESK_NOT_EMERGENCY,
  ];
  return {
    subject: `Confidential case for ${input.agency}`,
    text: `${lines.join('\n')}\n\n${safetyMessageFooter('999', originFromUrl(input.caseUrl))}`,
  };
}

export function referredForTracker(visible: boolean, sentAt: number): boolean {
  return visible && sentAt > 0;
}

export function decisionFromTicket(value: unknown): Pick<AuthorityDecision, 'required' | 'status'> {
  const raw = (value ?? {}) as { required?: unknown; status?: unknown };
  return {
    required: typeof raw.required === 'string' ? raw.required as AuthorityDecision['required'] : 'unsure',
    status: typeof raw.status === 'string' ? raw.status as AuthorityDecision['status'] : 'to_be_informed',
  };
}

/**
 * Student safety reports and the one-tap danger alert.
 * Fan-out and identity rules live here so the server and the tests share them.
 */

export const SAFETY_TYPES = [
  'bullying',
  'cyberbullying',
  'harassment',
  'abuse',
  'self_harm_concern',
  'discrimination',
  'unsafe_other',
] as const;
export type SafetyType = (typeof SAFETY_TYPES)[number];

export const TRACKER_STAGES = ['received', 'being_looked_at', 'action_taken', 'closed'] as const;
export type TrackerStage = (typeof TRACKER_STAGES)[number];

export const SAFETY_SOURCES = ['student_safety_report', 'danger_now'] as const;

export const DANGER_ACK_MS = 5 * 60 * 1000;

export const RATE_SOFT_CAP = 3;

export interface Helpline {
  country: string;
  name: string;
  number: string;
  note: string;
}

export const WHERE_PLACES = ['in_school', 'online', 'transport', 'other'] as const;
export type WherePlace = (typeof WHERE_PLACES)[number];

export const DEFAULT_HELPLINES: Helpline[] = [
  { country: 'Malaysia', name: 'Talian Kasih', number: '15999', note: '24 hours' },
  { country: 'Malaysia', name: 'Befrienders KL', number: '+603-7627 2929', note: '24 hours, free and confidential' },
];

export function isSafetyType(value: string): value is SafetyType {
  return (SAFETY_TYPES as readonly string[]).includes(value);
}

export function isSafetySource(value: string): boolean {
  return (SAFETY_SOURCES as readonly string[]).includes(value);
}

/** Principal, safeguarding lead, or super admin. Peers and other staff are not included. */
export function canSeeReporter(role: string, staffPost: string): boolean {
  return role === 'admin' || staffPost === 'principal' || staffPost === 'safeguarding_lead';
}

export function trackerFor(status: string): TrackerStage {
  if (status === 'closed') return 'closed';
  if (status === 'solved') return 'action_taken';
  if (status === 'in_progress' || status === 'kiv') return 'being_looked_at';
  return 'received';
}

export function needsUrgentLeadNotice(ageTier: string): boolean {
  return ageTier === 'under13';
}

/** Over the soft cap flags and throttles the report. It never refuses it. */
export function safetyRateFlag(countToday: number): { throttled: boolean; flagged: boolean } {
  const over = countToday >= RATE_SOFT_CAP;
  return { throttled: over, flagged: over };
}

/** Repeat false danger triggers are flagged. A new alert is still sent. */
export function dangerRepeatFlag(previousFalse: number): boolean {
  return previousFalse >= 2;
}

export function namesParentOrGuardian(who: string, concernRole: string): boolean {
  if (concernRole === 'parent' || concernRole === 'guardian') return true;
  return /\b(parent|parents|guardian|guardians|mum|mom|dad|mother|father)\b/i.test(who);
}

/** Abuse, a named parent or guardian, or the student's own tick keeps parents off the alert. */
export function parentsExcluded(input: { type: string; who: string; concernRole: string; dontTellParents: boolean }): boolean {
  if (input.dontTellParents) return true;
  if (input.type === 'abuse') return true;
  return namesParentOrGuardian(input.who, input.concernRole);
}

/** Staff always stay. Parent links are added only when the exclusion is off. */
export function dangerAudience(input: { excluded: boolean; parentUids: string[]; staffUids: string[] }): string[] {
  const staff = [...new Set(input.staffUids.filter(Boolean))];
  if (input.excluded) return staff;
  return [...new Set([...input.parentUids.filter(Boolean), ...staff])];
}

export function isWherePlace(value: string): value is WherePlace {
  return (WHERE_PLACES as readonly string[]).includes(value);
}

/** One typed place. There is no GPS and no continuous tracking. */
export function placeOnce(share: boolean, place: unknown, at: number): { place: string; at: number } | null {
  if (!share) return null;
  if (typeof place !== 'string') return null;
  const text = place.trim().slice(0, 160);
  if (text.length < 2) return null;
  return { place: text, at };
}

export function familyContactChoice(value: string): 'now' | 'later' | 'not_now' | null {
  if (value === 'now' || value === 'contact') return 'now';
  if (value === 'later') return 'later';
  if (value === 'not_now' || value === 'do_not_contact') return 'not_now';
  return null;
}

export function dangerNeedsEscalation(createdAt: number, staffAckAt: number, escalatedAt: number, now: number): boolean {
  if (staffAckAt > 0 || escalatedAt > 0) return false;
  return now - createdAt > DANGER_ACK_MS;
}

export function helplinesFor(country: string, lines: Helpline[]): Helpline[] {
  const key = country.trim().toLowerCase();
  const match = lines.filter(line => line.country.trim().toLowerCase() === key);
  if (match.length) return match;
  if (key === 'my') return helplinesFor('Malaysia', lines);
  return DEFAULT_HELPLINES.filter(line => line.country.toLowerCase() === 'malaysia');
}

export function cleanHelplines(input: unknown): Helpline[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) return null;
  const lines: Helpline[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') return null;
    const record = row as Record<string, unknown>;
    const country = typeof record.country === 'string' ? record.country.trim().slice(0, 60) : '';
    const name = typeof record.name === 'string' ? record.name.trim().slice(0, 80) : '';
    const number = typeof record.number === 'string' ? record.number.trim().slice(0, 40) : '';
    const note = typeof record.note === 'string' ? record.note.trim().slice(0, 120) : '';
    if (country.length < 2 || name.length < 2 || number.length < 3) return null;
    lines.push({ country, name, number, note });
  }
  return lines;
}

export interface ParentLinkRef {
  parentId: string;
  status: string;
}

export function parentUidsFromLinks(links: readonly ParentLinkRef[]): string[] {
  return links.filter(link => link.status === 'approved' && link.parentId.trim()).map(link => link.parentId.trim());
}

/**
 * The only fan-out list. When parents are excluded, every parent link is dropped
 * before the result is returned.
 */
export function dangerFanOut(input: {
  type: string;
  who: string;
  concernRole: string;
  dontTellParents: boolean;
  links: readonly ParentLinkRef[];
  staffUids: readonly string[];
}): { excluded: boolean; recipients: string[]; parentUids: string[] } {
  const excluded = parentsExcluded({
    type: input.type,
    who: input.who,
    concernRole: input.concernRole,
    dontTellParents: input.dontTellParents,
  });
  const parentUids = parentUidsFromLinks(input.links);
  return {
    excluded,
    parentUids: excluded ? [] : parentUids,
    recipients: dangerAudience({ excluded, parentUids, staffUids: [...input.staffUids] }),
  };
}

export type SafetyView = 'full' | 'tracker' | 'notice' | 'hidden';

export function safetyView(viewer: { id: string; role: string; staffPost: string; staffRole?: string; institutionId?: string }, ticket: {
  source: string;
  reporterUid: string;
  formTeacherUid: string;
  institutionId: string;
  parentsExcluded: boolean;
  notifiedParentUids: string[];
  anonymous?: boolean;
}): SafetyView {
  if (!isSafetySource(ticket.source)) return 'hidden';
  if (ticket.anonymous === true) {
    if (viewer.role === 'admin' || viewer.staffPost === 'safety_desk') return 'full';
    if (viewer.id && viewer.id === ticket.reporterUid) return 'tracker';
    return 'hidden';
  }
  if (viewer.role === 'admin') return 'full';
  const lead = viewer.staffPost === 'principal' || viewer.staffPost === 'safeguarding_lead';
  if (lead && viewer.institutionId && viewer.institutionId === ticket.institutionId) return 'full';
  if (viewer.id && viewer.id === ticket.reporterUid) return 'tracker';
  if (ticket.source === 'danger_now' && viewer.id && viewer.id === ticket.formTeacherUid) return 'notice';
  if (!ticket.parentsExcluded && viewer.id && ticket.notifiedParentUids.includes(viewer.id)) return 'notice';
  return 'hidden';
}

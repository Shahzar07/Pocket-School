/**
 * Alumni notes, class networks, and mentorship rules.
 * Pure decisions. The store and the pages call these.
 * A class link never occupies a seat.
 */

import { publicName } from './alumni';
import { asAgeTier, isMinorTier, type AgeTier } from './age-tier';
import { moderateText, type ModerationDecision } from './community/moderation';

export const MESSAGE_KINDS = ['reunion', 'newsletter', 'event', 'fundraising', 'survey'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MESSAGE_TEMPLATES: Record<MessageKind, { label: string; subject: string; body: string }> = {
  reunion: {
    label: 'Reunion',
    subject: 'A reunion at {academy}',
    body: '{academy} is gathering alumni. The details are in Poket School, and you can reply there.',
  },
  newsletter: {
    label: 'Newsletter',
    subject: 'News from {academy}',
    body: 'Here is a short note from {academy}. Reply in Poket School if you want to write back.',
  },
  event: {
    label: 'Event invite',
    subject: 'An invitation from {academy}',
    body: '{academy} invited you to an alumni event. Open the note in Poket School for the time and place.',
  },
  fundraising: {
    label: 'Fundraising',
    subject: 'A fundraising note from {academy}',
    body: '{academy} is raising support for students. This note is optional, and you can unsubscribe below.',
  },
  survey: {
    label: 'Survey',
    subject: 'A short survey from {academy}',
    body: '{academy} asked alumni for a short survey. You can answer by replying in Poket School.',
  },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AudienceFilter {
  year: string;
  level: string;
  programme: string;
  className: string;
  country: string;
  destination: string;
}

export interface AudiencePerson {
  leftOn: string;
  level: string;
  programme: string;
  className: string;
  country: string;
  destination: string;
}

export interface AlumniConsent {
  email: boolean;
  inbox: boolean;
  push: boolean;
  directory: boolean;
  messages: boolean;
  mentor: boolean;
  unsubscribed: boolean;
}

export interface ScreenedPost {
  decision: ModerationDecision;
  reasons: string[];
  visible: boolean;
  queued: boolean;
}

export interface NetworkStats {
  reached: number;
  opened: number;
  clicked: number;
  replies: number;
  events: number;
  rsvps: number;
  mentorships: number;
  pendingMentors: number;
}

export const SEAT_NOTE = 'Alumni stay linked after they become Individual accounts. The link costs this academy no seat.';

export function emptyAudience(): AudienceFilter {
  return { year: '', level: '', programme: '', className: '', country: '', destination: '' };
}

export function emptyNetworkStats(): NetworkStats {
  return { reached: 0, opened: 0, clicked: 0, replies: 0, events: 0, rsvps: 0, mentorships: 0, pendingMentors: 0 };
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function same(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function readAudience(data: unknown): AudienceFilter {
  const raw = data && typeof data === 'object' ? data as Partial<AudienceFilter> : {};
  const year = clip(raw.year, 4);
  return {
    year: /^\d{4}$/.test(year) ? year : '',
    level: clip(raw.level, 40),
    programme: clip(raw.programme, 80),
    className: clip(raw.className, 60),
    country: clip(raw.country, 60),
    destination: clip(raw.destination, 80),
  };
}

export function readMessageKind(value: unknown): MessageKind | null {
  return MESSAGE_KINDS.find((kind) => kind === value) ?? null;
}

/** An empty filter field means every alumnus. Cohort is the calendar year they left. */
export function matchesAudience(person: AudiencePerson, filter: AudienceFilter): boolean {
  if (filter.year && person.leftOn.slice(0, 4) !== filter.year) return false;
  if (filter.level && !same(person.level, filter.level)) return false;
  if (filter.programme && !same(person.programme, filter.programme)) return false;
  if (filter.className && !same(person.className, filter.className)) return false;
  if (filter.country && !same(person.country, filter.country)) return false;
  if (filter.destination && !person.destination.toLowerCase().includes(filter.destination.trim().toLowerCase())) return false;
  return true;
}

export function defaultConsent(): AlumniConsent {
  return {
    email: false,
    inbox: true,
    push: false,
    directory: false,
    messages: false,
    mentor: false,
    unsubscribed: false,
  };
}

export function readConsent(data: unknown): AlumniConsent {
  const base = defaultConsent();
  if (!data || typeof data !== 'object') return base;
  const raw = data as Partial<AlumniConsent>;
  return {
    email: raw.email === true,
    inbox: raw.inbox !== false,
    push: raw.push === true,
    directory: raw.directory === true,
    messages: raw.messages === true,
    mentor: raw.mentor === true,
    unsubscribed: raw.unsubscribed === true,
  };
}

/** Email and push are marketing. Unsubscribe stops both. The inbox flag is separate. */
export function channelOpen(consent: AlumniConsent, channel: 'email' | 'inbox' | 'push'): boolean {
  if (channel === 'inbox') return consent.inbox;
  if (consent.unsubscribed) return false;
  return channel === 'email' ? consent.email : consent.push;
}

export function renderTemplate(kind: MessageKind, academy: string, note = ''): { subject: string; body: string } {
  const template = MESSAGE_TEMPLATES[kind];
  const name = academy.trim() || 'your academy';
  const extra = note.replace(/\s+/g, ' ').trim().slice(0, 2000);
  return {
    subject: template.subject.replaceAll('{academy}', name).slice(0, 140),
    body: `${template.body.replaceAll('{academy}', name)}${extra ? `\n\n${extra}` : ''}`.slice(0, 4000),
  };
}

export function campaignMail(input: {
  academy: string;
  subject: string;
  body: string;
  viewUrl: string;
  eventUrl: string;
  unsubscribeUrl: string;
}): { subject: string; text: string } {
  return {
    subject: input.subject.slice(0, 140),
    text: [
      input.body.trim(),
      '',
      `View this note in Poket School: ${input.viewUrl}`,
      `Event link: ${input.eventUrl}`,
      '',
      `Unsubscribe from ${input.academy.trim() || 'this academy'}: ${input.unsubscribeUrl}`,
      'Unsubscribing stops email and push from this academy. Your class history stays on your account.',
    ].join('\n'),
  };
}

export const ALUMNI_SITE = 'https://poketschool.ai';

export function campaignUrls(campaignId: string, token: string): { view: string; event: string; unsubscribe: string } {
  const query = `campaign=${encodeURIComponent(campaignId)}&token=${encodeURIComponent(token)}`;
  return {
    view: `${ALUMNI_SITE}/api/alumni/open?${query}&kind=open`,
    event: `${ALUMNI_SITE}/api/alumni/open?${query}&kind=click`,
    unsubscribe: `${ALUMNI_SITE}/api/alumni/unsubscribe?token=${encodeURIComponent(token)}`,
  };
}

export function scheduleReady(sendOn: string, today: string): boolean {
  return DATE.test(sendOn) && DATE.test(today) && sendOn <= today;
}

/** History of attendance. This document never occupies a licence. */
export function attendanceLink(): { seatCounted: false; holdsSeat: false } {
  return { seatCounted: false, holdsSeat: false };
}

export function groupIdFor(input: { className: string; level: string; year: string }): { id: string; kind: 'class' | 'cohort'; name: string } {
  const year = /^\d{4}$/.test(input.year) ? input.year : 'open';
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const label = year === 'open' ? '' : year;
  if (input.className.trim()) {
    const className = input.className.trim().slice(0, 60);
    return { id: `class-${slug(className) || 'group'}-${year}`, kind: 'class', name: `${className} ${label}`.trim() };
  }
  const level = input.level.trim().slice(0, 60) || 'Cohort';
  return { id: `cohort-${slug(level) || 'group'}-${year}`, kind: 'cohort', name: `${level} ${label}`.trim() };
}

export interface DirectGate {
  id: string;
  ageTier: AgeTier;
  messages: boolean;
}

/** 1:1 notes only when both people are adults, both opted in, and neither has blocked the other. */
export function canDirectMessage(a: DirectGate, b: DirectGate, blocked: boolean): boolean {
  if (!a.id || a.id === b.id) return false;
  if (isMinorTier(asAgeTier(a.ageTier)) || isMinorTier(asAgeTier(b.ageTier))) return false;
  if (!a.messages || !b.messages) return false;
  if (blocked) return false;
  return true;
}

/** ET safety filter. Minors can post to the class group, and an academy moderator releases the post. */
export function screenPost(text: string, ageTier: AgeTier): ScreenedPost {
  const result = moderateText(text);
  if (result.decision === 'block') {
    return { decision: 'block', reasons: result.reasons, visible: false, queued: false };
  }
  if (isMinorTier(asAgeTier(ageTier))) {
    const reasons = result.reasons.includes('minor_moderated') ? result.reasons : [...result.reasons, 'minor_moderated'];
    return { decision: 'hold', reasons, visible: false, queued: true };
  }
  if (result.decision === 'hold') return { decision: 'hold', reasons: result.reasons, visible: false, queued: true };
  return { decision: 'allow', reasons: result.reasons, visible: true, queued: false };
}

export function mentorDecision(input: {
  mentorAdult: boolean;
  mentorOptIn: boolean;
  studentOptIn: boolean;
  institutionApproved: boolean;
  studentMinor: boolean;
}): { open: boolean; moderated: boolean; pending: boolean; reason: string } {
  if (!input.mentorAdult) return { open: false, moderated: false, pending: false, reason: 'A mentor is an adult.' };
  if (!input.mentorOptIn || !input.studentOptIn) {
    return { open: false, moderated: false, pending: false, reason: 'Both people opt in before a match.' };
  }
  if (!input.institutionApproved) {
    return { open: false, moderated: input.studentMinor, pending: true, reason: 'The academy approves the match.' };
  }
  return {
    open: true,
    moderated: input.studentMinor,
    pending: false,
    reason: input.studentMinor ? 'The academy can read this thread.' : 'The match is open.',
  };
}

export function directoryEntry(input: {
  directory: boolean;
  name: string;
  level: string;
  className: string;
  destination: string;
}): { name: string; level: string; className: string; destination: string } | null {
  if (!input.directory) return null;
  if (input.name.includes('@')) return null;
  return {
    name: publicName(input.name),
    level: input.level.trim().slice(0, 40),
    className: input.className.trim().slice(0, 60),
    destination: input.destination.trim().slice(0, 80),
  };
}

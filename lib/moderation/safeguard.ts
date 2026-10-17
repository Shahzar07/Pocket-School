/**
 * Who is told, what they see, and when a pattern becomes a case.
 * Parents never see another child's name. Schools see the case file.
 */

import type { SafetyCategory, SafetySeverity } from './screen';
import { inQuietHours } from '../insights/concerns';

export type ParentSafetyLevel = 'all' | 'medium' | 'high';

export type AlertAudience = 'safeguarding_lead' | 'teacher' | 'author_parent' | 'victim_parent' | 'admin' | 'moderator';

export type AlertTiming = 'digest' | 'same_day' | 'immediate';

export interface SafetyEvent {
  authorId: string;
  targetIds: string[];
  category: SafetyCategory;
  severity: SafetySeverity;
  atMs: number;
  surface: string;
}

export interface PatternHit {
  kind: 'repeat_target' | 'pile_on' | 'mood_change';
  severity: SafetySeverity;
  studentIds: string[];
  detail: string;
}

export interface RoutingInput {
  ageTier: 'under13' | 'teen' | 'adult';
  severity: SafetySeverity;
  category: SafetyCategory;
  parentLevel: ParentSafetyLevel;
  tellTeacher: boolean;
  now: Date;
  quietStart: string;
  quietEnd: string;
}

export interface RoutePlan {
  timing: AlertTiming;
  audiences: AlertAudience[];
  bypassQuietHours: boolean;
  email: boolean;
  push: boolean;
  inbox: boolean;
  escalateIfUnackedMs: number | null;
}

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export function alertTiming(severity: SafetySeverity): AlertTiming {
  if (severity === 'low') return 'digest';
  if (severity === 'medium') return 'same_day';
  return 'immediate';
}

export function parentReceives(level: ParentSafetyLevel, severity: SafetySeverity, minor: boolean): boolean {
  if (!minor) return false;
  if (severity === 'high' || severity === 'critical') return true;
  if (severity === 'none') return false;
  if (level === 'high') return false;
  if (level === 'medium') return severity === 'medium';
  return severity === 'low' || severity === 'medium';
}

export function planAlert(input: RoutingInput): RoutePlan {
  const minor = input.ageTier !== 'adult';
  const timing = alertTiming(input.severity);
  const critical = input.severity === 'critical';
  const quiet = inQuietHours(input.now, input.quietStart, input.quietEnd);
  const audiences: AlertAudience[] = [];
  if (minor) {
    audiences.push('safeguarding_lead');
    if (input.tellTeacher && input.severity !== 'low') audiences.push('teacher');
    if (parentReceives(input.parentLevel, input.severity, true) && timing !== 'digest') {
      audiences.push('author_parent', 'victim_parent');
    }
  } else if (input.severity === 'high' || input.severity === 'critical') {
    audiences.push('admin', 'moderator');
  } else if (input.severity === 'medium') {
    audiences.push('moderator');
  }
  return {
    timing,
    audiences,
    bypassQuietHours: critical,
    email: input.severity === 'high' || input.severity === 'critical',
    push: timing !== 'digest' && (critical || !quiet),
    inbox: true,
    escalateIfUnackedMs: critical ? 15 * 60 * 1000 : null,
  };
}

export function detectPatterns(events: SafetyEvent[], now: number): PatternHit[] {
  const hits: PatternHit[] = [];
  const byPair = new Map<string, number>();
  const pile = new Map<string, Set<string>>();
  let lowMood = 0;
  for (const event of events) {
    if (now - event.atMs > TWO_WEEKS) continue;
    for (const target of event.targetIds) {
      if (!target || target === event.authorId) continue;
      const key = `${event.authorId}:${target}`;
      byPair.set(key, (byPair.get(key) ?? 0) + 1);
      if (now - event.atMs <= DAY) {
        const authors = pile.get(target) ?? new Set<string>();
        authors.add(event.authorId);
        pile.set(target, authors);
      }
    }
    if (event.category === 'borderline' || event.category === 'self_harm') lowMood += 1;
  }
  for (const [key, count] of byPair) {
    if (count < 3) continue;
    const studentId = key.split(':')[1] ?? '';
    hits.push({
      kind: 'repeat_target',
      severity: 'medium',
      studentIds: studentId ? [studentId] : [],
      detail: 'The same student was targeted repeatedly.',
    });
  }
  for (const [studentId, authors] of pile) {
    if (authors.size < 3) continue;
    hits.push({
      kind: 'pile_on',
      severity: 'high',
      studentIds: [studentId],
      detail: 'Several people posted about the same student in a short time.',
    });
  }
  if (lowMood >= 3) {
    hits.push({
      kind: 'mood_change',
      severity: 'high',
      studentIds: [],
      detail: 'Recent posts show a sudden drop in mood.',
    });
  }
  return hits;
}

export interface AlertCopyInput {
  audience: AlertAudience;
  childFirstName: string;
  otherLabel: string;
  category: SafetyCategory;
  severity: SafetySeverity;
  space: string;
  actionTaken: string;
}

/** Push and parent copy stay short and non-graphic. */
export function alertCopy(input: AlertCopyInput): { title: string; body: string } {
  const what = categoryLabel(input.category);
  if (input.audience === 'author_parent') {
    return {
      title: 'A note about your child',
      body: `${input.childFirstName}'s post in ${input.space} was ${what}. ${input.actionTaken} The other student's name is not included.`,
    };
  }
  if (input.audience === 'victim_parent') {
    return {
      title: 'A note about your child',
      body: `${input.childFirstName} was mentioned in ${input.space}. The school has the details. ${input.actionTaken}`,
    };
  }
  return {
    title: `Safeguarding: ${input.severity}`,
    body: `${what} in ${input.space}. ${input.actionTaken} Open the case file for the full record.`,
  };
}

export function redactExcerpt(text: string): string {
  const cleaned = text
    .replace(/\b(kill myself|kill yourself|kys|suicide|nude|naked|porn)\b/gi, '[removed]')
    .replace(/(\+?\d[\d\s()-]{8,}\d)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '[contact removed]')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 80);
}

export function conversationGuide(input: { audience: 'parent' | 'teacher'; category: SafetyCategory }): string {
  const who = input.audience === 'parent' ? 'your child' : 'the student';
  return [
    'ET AI conversation guide',
    `Start with care. Ask ${who} how they are before you talk about the post.`,
    `Name the category (${categoryLabel(input.category)}) without reading graphic words aloud.`,
    'Say what the school already did, and what happens next.',
    'If anyone is in immediate danger, contact local emergency services.',
    'Poket School does not use flagged content to train AI models.',
  ].join(' ');
}

export function categoryLabel(category: SafetyCategory): string {
  const labels: Record<SafetyCategory, string> = {
    ok: 'ordinary content',
    empty: 'an empty post',
    hate: 'a possible hate or discrimination concern',
    harassment: 'a possible bullying concern',
    sexual: 'a sexual-content concern',
    sexual_minor: 'a sexual-content concern involving a young person',
    violence: 'a threat or violence concern',
    self_harm: 'a self-harm concern',
    scam: 'a possible scam',
    spam: 'possible spam',
    personal_data: 'personal data in a post',
    grooming: 'a possible grooming concern',
    investment_solicitation: 'an unsolicited investment pitch',
    image_unseen: 'an image waiting for review',
    borderline: 'a borderline tone concern',
  };
  return labels[category];
}

export function shouldEscalate(ackAtMs: number | null, createdAtMs: number, waitMs: number, now: number): boolean {
  if (ackAtMs != null) return false;
  return now - createdAtMs >= waitMs;
}

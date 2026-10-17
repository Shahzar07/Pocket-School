/**
 * ET AI text screen. Patterns run even when no model key is set.
 * A model may only make the result stricter.
 */

import { isMinorTier, type AgeTier } from '../age-tier';

export const GUIDELINES_PATH = '/community-guidelines';

export const MODERATION_SURFACES = [
  'class_space',
  'alumni_wall',
  'yearbook',
  'community_post',
  'community_comment',
  'channel_message',
  'lesson_qa',
  'network_post',
  'network_comment',
  'network_dm',
  'network_profile',
  'founder_profile',
  'founder_message',
  'startup_post',
  'group_post',
  'group_chat',
  'group_profile',
] as const;

export type ModerationSurface = (typeof MODERATION_SURFACES)[number];

export type ModerationDecision = 'allow' | 'hold' | 'block';

export type SafetySeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type SafetyCategory =
  | 'ok'
  | 'empty'
  | 'hate'
  | 'harassment'
  | 'sexual'
  | 'sexual_minor'
  | 'violence'
  | 'self_harm'
  | 'scam'
  | 'spam'
  | 'personal_data'
  | 'grooming'
  | 'investment_solicitation'
  | 'image_unseen'
  | 'borderline';

export interface ModerationThresholds {
  /** Mild insults in adult spaces. Minors always hold or block. */
  adultMildInsult: 'hold' | 'block';
  /** Clear phone numbers and email addresses. */
  personalData: 'hold' | 'block';
  /** An image the model did not see. */
  imageWithoutVision: 'hold' | 'block';
}

export const DEFAULT_THRESHOLDS: ModerationThresholds = {
  adultMildInsult: 'hold',
  personalData: 'block',
  imageWithoutVision: 'hold',
};

/** Under-18 spaces stay at least this strict. Admins cannot loosen them. */
export const MINOR_FLOOR: ModerationThresholds = {
  adultMildInsult: 'block',
  personalData: 'block',
  imageWithoutVision: 'hold',
};

export interface ScreenInput {
  text: string;
  surface: ModerationSurface;
  ageTier: AgeTier;
  hasImage?: boolean;
  /** Set when a vision model actually looked at the image bytes. */
  imageSeen?: boolean;
  thresholds?: Partial<ModerationThresholds>;
}

export interface ScreenResult {
  decision: ModerationDecision;
  reasons: string[];
  category: SafetyCategory;
  severity: SafetySeverity;
  authorMessage: string;
  supportiveMessage: string | null;
  /** Tell a school safeguarding lead, or show an adult helpline. */
  safeguarding: boolean;
}

const RANK: Record<ModerationDecision, number> = { allow: 0, hold: 1, block: 2 };
const SEVERITY_RANK: Record<SafetySeverity, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

const BLOCKS: { category: SafetyCategory; severity: SafetySeverity; pattern: RegExp }[] = [
  { category: 'sexual_minor', severity: 'high', pattern: /\b(child|underage|minor|kid|pupil)s?\b.{0,40}\b(nude|naked|sex|porn)\b|\b(nude|naked|sex|porn)\b.{0,40}\b(child|underage|minor|kid|pupil)s?\b/i },
  { category: 'self_harm', severity: 'critical', pattern: /\b(kill myself|kill yourself|kys|suicide|end my life|want to die|self[- ]harm|how to cut)\b/i },
  { category: 'violence', severity: 'critical', pattern: /\b(i will kill|going to kill|shoot (you|them|the school)|bring a (gun|weapon|knife)|bomb the)\b/i },
  { category: 'grooming', severity: 'high', pattern: /\b(don'?t tell (your )?(parents|mum|mom|dad|teacher)|keep (this|it) (a )?secret|send (me )?(a |your )?(nude|pic|photo|picture)|what are you wearing)\b/i },
  { category: 'hate', severity: 'high', pattern: /\b(i hate all|go back to your country|racial slur|you people are (animals|vermin))\b|\b(nigger|faggot|retard)s?\b/i },
  { category: 'sexual', severity: 'high', pattern: /\b(send nudes|porn|sexual favou?r|hook ?up tonight)\b/i },
  { category: 'violence', severity: 'high', pattern: /\b(i will (hurt|beat|stab) you|watch your back|you('re| are) dead)\b/i },
  { category: 'scam', severity: 'medium', pattern: /\b(wire (me )?money|send (bitcoin|crypto|gift cards)|you have won|account (is )?suspended click)\b/i },
  { category: 'spam', severity: 'low', pattern: /(https?:\/\/\S+\s*){3,}|\b(buy followers|click here now|work from home \$)\b/i },
  { category: 'investment_solicitation', severity: 'medium', pattern: /\b(guaranteed returns|invest in my|send (a )?wire|seed round just for you|double your money)\b/i },
];

const HOLDS: { category: SafetyCategory; severity: SafetySeverity; pattern: RegExp }[] = [
  { category: 'harassment', severity: 'low', pattern: /\b(stupid|idiot|loser|shut up|hate you|nobody likes you)\b/i },
  { category: 'harassment', severity: 'medium', pattern: /\b(kill yourself energy|you should disappear|we don'?t want you here|exclude (him|her|them))\b/i },
  { category: 'grooming', severity: 'high', pattern: /\b(whatsapp|telegram|snapchat|discord|signal me)\b/i },
  { category: 'personal_data', severity: 'medium', pattern: /(\+?\d[\d\s()-]{8,}\d)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i },
  { category: 'borderline', severity: 'low', pattern: /\b(i hate myself|i am worthless|i can'?t do anything right)\b/i },
];

const MINOR_SURFACES = new Set<ModerationSurface>(['class_space', 'yearbook', 'group_chat']);

export function isMinorSpace(surface: ModerationSurface, ageTier: AgeTier): boolean {
  return isMinorTier(ageTier) || MINOR_SURFACES.has(surface);
}

export function resolveThresholds(
  ageTier: AgeTier,
  surface: ModerationSurface,
  override?: Partial<ModerationThresholds>,
): ModerationThresholds {
  const base = { ...DEFAULT_THRESHOLDS, ...override };
  if (!isMinorSpace(surface, ageTier)) return base;
  return {
    adultMildInsult: 'block',
    personalData: 'block',
    imageWithoutVision: stricterImage(base.imageWithoutVision, MINOR_FLOOR.imageWithoutVision),
  };
}

function stricterImage(a: 'hold' | 'block', b: 'hold' | 'block'): 'hold' | 'block' {
  return a === 'block' || b === 'block' ? 'block' : 'hold';
}

function bump(current: ModerationDecision, next: ModerationDecision): ModerationDecision {
  return RANK[next] > RANK[current] ? next : current;
}

function bumpSeverity(current: SafetySeverity, next: SafetySeverity): SafetySeverity {
  return SEVERITY_RANK[next] > SEVERITY_RANK[current] ? next : current;
}

export function authorNotice(category: SafetyCategory, decision: ModerationDecision): string {
  if (decision === 'allow') return '';
  const held = decision === 'hold';
  const lead = held
    ? 'ET AI held this for a person to review. It is not published yet.'
    : 'ET AI did not publish this.';
  const why: Record<SafetyCategory, string> = {
    ok: '',
    empty: 'Add a few words so people know what you mean.',
    hate: 'It reads as an attack on a group of people.',
    harassment: 'It reads as harassment or bullying.',
    sexual: 'It includes sexual content.',
    sexual_minor: 'It includes sexual content involving a young person.',
    violence: 'It includes a threat or violent content.',
    self_harm: 'It includes a self-harm or suicide signal.',
    scam: 'It reads as a scam.',
    spam: 'It reads as spam.',
    personal_data: 'It includes a phone number, email, or other personal data.',
    grooming: 'It asks someone to keep a secret, move off Poket School, or share a photo.',
    investment_solicitation: 'Unsolicited investment pitches are not allowed. Poket School does not vet investments.',
    image_unseen: 'An image needs a person to look at it before it goes up.',
    borderline: 'It needs a person to check the tone.',
  };
  return `${lead} ${why[category]} Read the community guidelines: ${GUIDELINES_PATH}`;
}

export function supportiveNote(ageTier: AgeTier): string {
  if (isMinorTier(ageTier)) {
    return 'If you are hurting, you are not alone. Please tell a trusted adult at school. Your school safeguarding contact has been told, and this was not published.';
  }
  return 'If you are hurting, you are not alone. A local helpline such as Befrienders can listen. This was not published.';
}

export function screenContent(input: ScreenInput): ScreenResult {
  const text = input.text.trim();
  const thresholds = resolveThresholds(input.ageTier, input.surface, input.thresholds);
  const minor = isMinorSpace(input.surface, input.ageTier);
  let decision: ModerationDecision = 'allow';
  let category: SafetyCategory = 'ok';
  let severity: SafetySeverity = 'none';
  const reasons: string[] = [];

  if (!text && !input.hasImage) {
    return finish('block', 'empty', 'low', ['empty'], input, false);
  }
  if (text.length > 4000) {
    return finish('block', 'spam', 'low', ['too_long'], input, false);
  }

  for (const rule of BLOCKS) {
    if (!rule.pattern.test(text)) continue;
    if (rule.category === 'investment_solicitation' && !isPitchSurface(input.surface)) continue;
    if (rule.category === 'grooming' && !minor && input.surface !== 'network_dm') continue;
    reasons.push(rule.category);
    decision = 'block';
    category = rule.category;
    severity = bumpSeverity(severity, rule.severity);
  }

  if (decision !== 'block') {
    for (const rule of HOLDS) {
      if (!rule.pattern.test(text)) continue;
      if (rule.category === 'grooming' && !minor) continue;
      reasons.push(rule.category);
      if (rule.category === 'grooming' && minor) {
        decision = 'block';
        category = 'grooming';
        severity = 'high';
        continue;
      }
      const next = rule.category === 'harassment' && rule.severity === 'low'
        ? (minor ? 'block' : thresholds.adultMildInsult)
        : rule.category === 'personal_data'
          ? thresholds.personalData
          : 'hold';
      decision = bump(decision, next);
      if (RANK[next] >= RANK[decision] || category === 'ok') category = rule.category;
      severity = bumpSeverity(severity, rule.category === 'harassment' && minor ? 'medium' : rule.severity);
    }
  }

  if (input.hasImage && !input.imageSeen) {
    reasons.push('image_unseen');
    decision = bump(decision, thresholds.imageWithoutVision);
    if (category === 'ok') category = 'image_unseen';
    severity = bumpSeverity(severity, 'low');
  }

  if (decision === 'block' && severity === 'none') severity = 'low';
  if (decision === 'hold' && severity === 'none') severity = 'low';
  const safeguarding = severity === 'critical' || severity === 'high' || (minor && (severity === 'medium' || category === 'self_harm'));
  return finish(decision, category, severity, reasons, input, safeguarding);
}

function isPitchSurface(surface: ModerationSurface): boolean {
  return surface === 'founder_profile' || surface === 'founder_message'
    || surface === 'startup_post' || surface === 'network_post' || surface === 'network_dm' || surface === 'group_post';
}

function finish(
  decision: ModerationDecision,
  category: SafetyCategory,
  severity: SafetySeverity,
  reasons: string[],
  input: ScreenInput,
  safeguarding: boolean,
): ScreenResult {
  const selfHarm = category === 'self_harm' || reasons.includes('self_harm');
  return {
    decision,
    reasons: [...new Set(reasons)],
    category: selfHarm ? 'self_harm' : category,
    severity: selfHarm ? 'critical' : severity,
    authorMessage: selfHarm ? supportiveNote(input.ageTier) : authorNotice(selfHarm ? 'self_harm' : category, decision),
    supportiveMessage: selfHarm ? supportiveNote(input.ageTier) : null,
    safeguarding: safeguarding || selfHarm,
  };
}

/** The stricter result wins. Patterns are never loosened by a model. */
export function mergeScreen(local: ScreenResult, ai: { decision?: string; reasons?: string[] } | null): ScreenResult {
  if (!ai) return local;
  const decision: ModerationDecision = ai.decision === 'block' || ai.decision === 'hold' || ai.decision === 'allow'
    ? ai.decision
    : 'allow';
  const next = bump(local.decision, decision);
  const reasons = [...new Set([...local.reasons, ...(ai.reasons ?? []).filter(reason => typeof reason === 'string')])];
  if (next === local.decision && reasons.length === local.reasons.length) return local;
  return {
    ...local,
    decision: next,
    reasons,
    severity: next === 'block' && local.severity === 'none' ? 'low' : local.severity,
    authorMessage: local.authorMessage || authorNotice(local.category, next),
  };
}

export function parseModelScreen(raw: string): { decision: ModerationDecision; reasons: string[] } | null {
  try {
    const parsed = JSON.parse(raw) as { decision?: unknown; reasons?: unknown };
    if (parsed.decision !== 'allow' && parsed.decision !== 'hold' && parsed.decision !== 'block') return null;
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 8)
      : [];
    return { decision: parsed.decision, reasons };
  } catch {
    return null;
  }
}

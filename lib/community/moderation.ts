export type ModerationDecision = 'allow' | 'hold' | 'block';

export interface ModerationResult {
  decision: ModerationDecision;
  reasons: string[];
}

const RANK: Record<ModerationDecision, number> = { allow: 0, hold: 1, block: 2 };

const BLOCK_PATTERNS: { reason: string; pattern: RegExp }[] = [
  { reason: 'sexual_minor', pattern: /\b(child|underage|minor|kid)s?\b.{0,24}\b(nude|sex|porn)\b|\b(nude|sex|porn)\b.{0,24}\b(child|underage|minor|kid)s?\b/i },
  { reason: 'self_harm', pattern: /\b(kill yourself|kys|suicide method|how to cut)\b/i },
  { reason: 'violence_threat', pattern: /\b(i will kill|going to hurt you|bring a weapon)\b/i },
];

const HOLD_PATTERNS: { reason: string; pattern: RegExp }[] = [
  { reason: 'harassment', pattern: /\b(stupid|idiot|hate you|shut up|loser)\b/i },
  { reason: 'contact_info', pattern: /(\+?\d[\d\s-]{8,}\d)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i },
  { reason: 'off_platform', pattern: /\b(whatsapp|telegram|snapchat|discord)\b/i },
];

export function moderateText(text: string): ModerationResult {
  const body = text.trim();
  if (!body) return { decision: 'block', reasons: ['empty'] };
  if (body.length > 4000) return { decision: 'block', reasons: ['too_long'] };

  const reasons: string[] = [];
  let decision: ModerationDecision = 'allow';
  for (const rule of BLOCK_PATTERNS) {
    if (rule.pattern.test(body)) {
      reasons.push(rule.reason);
      decision = 'block';
    }
  }
  if (decision !== 'block') {
    for (const rule of HOLD_PATTERNS) {
      if (rule.pattern.test(body)) {
        reasons.push(rule.reason);
        decision = 'hold';
      }
    }
  }
  return { decision, reasons };
}

export function parseAiModeration(raw: string): ModerationResult | null {
  try {
    const parsed = JSON.parse(raw) as { decision?: unknown; reasons?: unknown };
    if (parsed.decision !== 'allow' && parsed.decision !== 'hold' && parsed.decision !== 'block') return null;
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r): r is string => typeof r === 'string').slice(0, 8)
      : [];
    return { decision: parsed.decision, reasons };
  } catch {
    return null;
  }
}

/** The stricter result wins. A local block is never downgraded by the model. */
export function mergeModeration(local: ModerationResult, ai: ModerationResult | null): ModerationResult {
  if (!ai) return local;
  const decision = RANK[ai.decision] > RANK[local.decision] ? ai.decision : local.decision;
  return { decision, reasons: [...new Set([...local.reasons, ...ai.reasons])] };
}

export function queueStatusFor(decision: ModerationDecision): 'open' | null {
  return decision === 'allow' ? null : 'open';
}

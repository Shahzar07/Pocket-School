/**
 * Poket School design tokens.
 *
 * Colour, type, space, radius, shadow, and motion live in `app/globals.css`
 * as CSS variables. This module is the named contract those variables follow,
 * plus the copy helpers every screen should use instead of raw errors.
 */

export const TOKENS = {
  color: {
    ink: '#203337',
    /** Light text primary. #2786A4 is only 4.2:1 on white. */
    teal: '#1E6A83',
    /** Dark text primary. Light enough for 4.5:1 on #0B1417 and #121E22. */
    tealOnDark: '#6FBBCE',
    tealDeep: '#1E6A83',
    page: '#F4F6F6',
    card: '#FFFFFF',
    line: '#E7EDED',
    muted: '#3E5257',
    danger: '#B23B2E',
  },
  type: {
    xs: '0.6875rem',
    sm: '0.8125rem',
    md: '0.875rem',
    lg: '1.0625rem',
    xl: '1.75rem',
    '2xl': '2.125rem',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '24px',
    6: '32px',
    7: '48px',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  motion: {
    fast: '120ms',
    base: '220ms',
    slow: '420ms',
  },
} as const;

/** Plain sentence for a Sparks price, including why a control is locked. */
export function sparksCostLine(cost: number, balance?: number): string {
  if (cost <= 0) return 'This does not spend Sparks.';
  const price = `This uses ${cost} Spark${cost === 1 ? '' : 's'}.`;
  if (balance == null) return price;
  if (balance < cost) {
    return `${price} You have ${balance}, so this stays locked until you have enough.`;
  }
  return `${price} You have ${balance}.`;
}

/**
 * Turn a thrown value into a sentence a learner can act on.
 * Firestore and Firebase codes stay off the screen.
 */
export function friendlyError(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  if (/permission-denied|PERMISSION_DENIED|insufficient permissions|Missing or insufficient/i.test(raw)) {
    return 'You do not have access to this. Ask a teacher or the school if you should.';
  }
  if (/unavailable|network|failed to fetch|offline|deadline-exceeded/i.test(raw)) {
    return 'We could not reach Poket School just now. Check your connection and try again.';
  }
  if (/not-found|NOT_FOUND/i.test(raw)) {
    return 'That item is no longer here.';
  }
  if (/resource-exhausted|quota/i.test(raw)) {
    return 'Poket School is busy right now. Wait a moment and try again.';
  }
  if (!raw || /firebase|firestore|internal|index/i.test(raw)) {
    return 'Something went wrong on our side. Try again in a moment.';
  }
  return raw.length > 180 ? 'Something went wrong. Try again.' : raw;
}

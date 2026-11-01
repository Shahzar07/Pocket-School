/**
 * Premium marketing scale. Colour still comes from lib/design/tokens.ts.
 * Cyan is a fill, a glow, or a button. Text on light surfaces stays ink or blue.
 */

export const premiumType = {
  display: 'clamp(2.55rem, 6.2vw, 4.75rem)',
  title: 'clamp(1.85rem, 3.2vw, 2.85rem)',
  body: '1.0625rem',
  small: '0.875rem',
  pill: '0.75rem',
} as const;

export const premiumSpace = {
  section: '5.5rem',
  tight: '1.25rem',
  card: '1.35rem',
} as const;

export const premiumRadius = {
  card: 28,
  control: 999,
  mock: 22,
} as const;

export const premiumShadow = {
  card: '0 18px 50px rgba(32, 51, 55, 0.08)',
  float: '0 28px 70px rgba(30, 106, 131, 0.16)',
  pill: '0 10px 30px rgba(32, 51, 55, 0.08)',
} as const;

/** Text that is allowed on a light card. Cyan is absent on purpose. */
export const premiumLightText = {
  ink: '#203337',
  blue: '#1E6A83',
  mist: '#E7F4F2',
} as const;

export const premiumFill = {
  cyan: '#3FE0D0',
  ink: '#203337',
  canvas: '#F7FBFA',
  night: '#0B1417',
  cardNight: '#122226',
} as const;

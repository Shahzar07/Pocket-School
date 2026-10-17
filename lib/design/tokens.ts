/**
 * Poket School brand tokens. This is the web copy of the mobile
 * `src/theme/tokens.ts` palette: one light theme, one dark theme.
 *
 * Rochford forest `#1A3C34` and gold `#C8922A` are that school's colours.
 * They stay off the Poket School brand. A white-label academy may set its
 * own `branding.primaryColor`.
 *
 * Cyan is the accent fill. It is not a text colour on white (1.64:1).
 * Text and links on light backgrounds use brand blue `#1E6A83`.
 */

export interface RoleWash {
  teacher: string;
  parent: string;
  admin: string;
}

/** Shared cyan accent. PoketBooks and Reads should use these instead of hexes. */
export const CYAN = {
  /** Fills, glows, buttons, and accents on dark or blue. */
  fill: '#3FE0D0',
  /** Fills and icons on dark backgrounds only. 2.49:1 on white. */
  strong: '#14B8A6',
  /** Text and links on light backgrounds. Brand blue, 6.10:1 on white. */
  text: '#1E6A83',
  /** Chips. 15% of the cyan fill. */
  soft: 'rgba(63, 224, 208, 0.15)',
  /** Label on a cyan fill. */
  ink: '#203337',
  /** 1px edge. The fill alone is 1.64:1 against white. */
  border: '#1E6A83',
} as const;

export interface Palette {
  bg: string;
  wash: string;
  mist: string;
  card: string;
  line: string;
  ink: string;
  muted: string;
  faint: string;
  primary: string;
  blueDeep: string;
  blueBright: string;
  onPrimary: string;
  cyan: string;
  cyanStrong: string;
  cyanText: string;
  cyanSoft: string;
  cyanInk: string;
  cyanBorder: string;
  coral: string;
  coralSoft: string;
  good: string;
  mint: string;
  mintInk: string;
  role: RoleWash;
}

export const light: Palette = {
  bg: '#F4F6F6',
  wash: '#E9F7FA',
  mist: '#E9F7FA',
  card: '#FFFFFF',
  line: '#E7EDED',
  ink: '#203337',
  muted: '#5F7074',
  faint: '#8AA0A6',
  primary: '#2786A4',
  blueDeep: '#1E6A83',
  blueBright: '#6FBBCE',
  onPrimary: '#FFFFFF',
  cyan: CYAN.fill,
  cyanStrong: CYAN.strong,
  cyanText: CYAN.text,
  cyanSoft: CYAN.soft,
  cyanInk: CYAN.ink,
  cyanBorder: CYAN.border,
  coral: '#D0553F',
  coralSoft: '#FDECEA',
  good: '#1F8A70',
  mint: '#E5F6EF',
  mintInk: '#0E7A62',
  role: {
    teacher: '#E9F7FA',
    parent: '#E5F6EF',
    admin: '#F0F5F4',
  },
};

export const dark: Palette = {
  bg: '#0B1417',
  wash: '#102028',
  mist: '#17282D',
  card: '#121E22',
  line: '#1E3238',
  ink: '#E8EFEF',
  muted: '#93A7AB',
  faint: '#6E848A',
  primary: '#6FBBCE',
  blueDeep: '#8ED0DE',
  blueBright: '#6FBBCE',
  onPrimary: '#0B1417',
  cyan: CYAN.fill,
  cyanStrong: CYAN.strong,
  /** `#1E6A83` is 3.06:1 on the dark canvas, so dark text uses the cyan fill. */
  cyanText: CYAN.fill,
  cyanSoft: CYAN.soft,
  cyanInk: CYAN.ink,
  cyanBorder: CYAN.border,
  coral: '#E88976',
  coralSoft: '#2C1C1A',
  good: '#8ED9C4',
  mint: '#142824',
  mintInk: '#8ED9C4',
  role: {
    teacher: '#121E22',
    parent: '#101C18',
    admin: '#10181E',
  },
};

/** 135deg hero. Light runs deep teal through brand primary into bright blue. */
export const hero = {
  angle: 135,
  light: [light.blueDeep, light.primary, light.blueBright] as const,
  dark: [dark.bg, dark.mist, light.blueDeep] as const,
};

export function heroGradient(stops: readonly string[]): string {
  return `linear-gradient(${hero.angle}deg, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)`;
}

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const font = {
  body: 'Plus Jakarta Sans',
  display: 'Instrument Sans',
} as const;

/** Rochford's International School. Not the Poket School brand. */
export const ROCHFORD = {
  forest: '#1A3C34',
  gold: '#C8922A',
} as const;

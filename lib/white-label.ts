/**
 * White-label host handling.
 *
 * An institution can be served from its own subdomain — kolej-utama.poketschool.ai —
 * from `/a/kolej-utama` until wildcard DNS is live, or from a hostname it owns.
 * Resolving the label to an institution is a Firestore read.
 */

import { tenantFromRequest } from './tenant-host';

/**
 * The Poket School subdomain label, or null for the platform, a custom domain,
 * a preview deployment, or an IP.
 *
 * kolej-utama.poketschool.ai → "kolej-utama"
 * poketschool.ai             → null
 * learn.school.example       → null  (custom domains are resolved by hostname)
 * anything.vercel.app        → null
 */
export function subdomainFromHost(host: string | null | undefined): string | null {
  const tenant = tenantFromRequest(host, '/');
  return tenant.kind === 'subdomain' ? tenant.slug : null;
}

export interface Branding {
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tagline?: string;
  hidePoweredBy: boolean;
  emailFromName?: string;
  certificateIssuer?: string;
  certificateFooter?: string;
  fontId?: string;
  faviconUrl?: string;
  loginHeadline?: string;
  loginBody?: string;
  mobileAppName?: string;
  splashColor?: string;
  /** True when an institution's branding is in effect rather than the default. */
  isWhiteLabel: boolean;
}

export const DEFAULT_BRANDING: Branding = {
  displayName: 'Poket School',
  tagline: 'Learning, personalised.',
  hidePoweredBy: false,
  isWhiteLabel: false,
};

/** Merge an institution's branding over the platform default. */
export function brandingFor(
  institution: {
    name?: string;
    branding?: {
      displayName?: string;
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      tagline?: string;
      hidePoweredBy?: boolean;
      emailFromName?: string;
      certificateIssuer?: string;
      certificateFooter?: string;
      fontId?: string;
      faviconUrl?: string;
      loginHeadline?: string;
      loginBody?: string;
      mobileAppName?: string;
      splashColor?: string;
    };
  } | null | undefined,
): Branding {
  if (!institution) return DEFAULT_BRANDING;
  const b = institution.branding ?? {};
  const displayName = b.displayName || institution.name || DEFAULT_BRANDING.displayName;
  return {
    displayName,
    logoUrl: b.logoUrl,
    primaryColor: b.primaryColor,
    secondaryColor: b.secondaryColor,
    tagline: b.tagline ?? DEFAULT_BRANDING.tagline,
    hidePoweredBy: !!b.hidePoweredBy,
    emailFromName: b.emailFromName || displayName,
    certificateIssuer: b.certificateIssuer || displayName,
    certificateFooter: b.certificateFooter,
    fontId: b.fontId,
    faviconUrl: b.faviconUrl,
    loginHeadline: b.loginHeadline,
    loginBody: b.loginBody,
    mobileAppName: b.mobileAppName,
    splashColor: b.splashColor,
    isWhiteLabel: true,
  };
}

/** Full origin an institution is reachable at, for links and invitations. */
export function institutionOrigin(subdomain: string, rootDomain = 'poketschool.ai'): string {
  return `https://${subdomain}.${rootDomain}`;
}

/** Text colour that stays readable on an academy accent. */
export function accentInk(hex: string): string {
  const value = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return '#ffffff';
  const n = Number.parseInt(value.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#102027' : '#ffffff';
}

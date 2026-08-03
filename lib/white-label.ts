/**
 * White-label host handling.
 *
 * An institution can be served from its own subdomain — kolej-utama.poketschool.ai —
 * and the app then wears that institution's name, logo and accent colour.
 * This module only answers "which host label are we on"; resolving the label to
 * an institution is a Firestore read (getInstitutionBySubdomain).
 */

/** Hosts that are the platform itself rather than a tenant. */
const PLATFORM_HOSTS = new Set([
  'poketschool.ai',
  'www.poketschool.ai',
  'localhost',
]);

/**
 * The tenant label in a hostname, or null when the host is the platform, a
 * preview deployment or an IP.
 *
 * kolej-utama.poketschool.ai → "kolej-utama"
 * poketschool.ai             → null
 * anything.vercel.app        → null  (preview builds are not tenants)
 */
export function subdomainFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  // Strip port and normalise.
  const hostname = host.split(':')[0].trim().toLowerCase();
  if (!hostname || PLATFORM_HOSTS.has(hostname)) return null;
  // Bare IPs are never tenants.
  if (/^[\d.]+$/.test(hostname)) return null;
  // Preview and platform-provider hosts carry deployment ids, not tenants.
  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.local')) return null;

  const parts = hostname.split('.');
  // Need at least sub.domain.tld; localhost subdomains (sub.localhost) count too.
  if (parts.length === 2 && parts[1] === 'localhost') return parts[0];
  if (parts.length < 3) return null;

  const label = parts[0];
  return label === 'www' ? null : label;
}

export interface Branding {
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  tagline?: string;
  hidePoweredBy: boolean;
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
      tagline?: string;
      hidePoweredBy?: boolean;
    };
  } | null | undefined,
): Branding {
  if (!institution) return DEFAULT_BRANDING;
  const b = institution.branding ?? {};
  return {
    displayName: b.displayName || institution.name || DEFAULT_BRANDING.displayName,
    logoUrl: b.logoUrl,
    primaryColor: b.primaryColor,
    tagline: b.tagline ?? DEFAULT_BRANDING.tagline,
    hidePoweredBy: !!b.hidePoweredBy,
    isWhiteLabel: true,
  };
}

/** Full origin an institution is reachable at, for links and invitations. */
export function institutionOrigin(subdomain: string, rootDomain = 'poketschool.ai'): string {
  return `https://${subdomain}.${rootDomain}`;
}

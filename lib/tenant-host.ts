/**
 * OEM hostnames for an academy.
 *
 * `{slug}.poketschool.ai` is the address. Until that wildcard DNS exists,
 * `/a/{slug}` is the same academy. A school-owned hostname is a custom domain,
 * resolved separately so it is never mistaken for a Poket School subdomain.
 * This module does not read Firestore.
 */

export const PLATFORM_ROOT = 'poketschool.ai';
export const TENANT_HEADER = 'x-poket-tenant';
export const CNAME_TARGET = 'cname.vercel-dns.com';

/** Host labels Poket School keeps for itself. One list for saves and for routing. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'mail', 'staging', 'dev', 'test', 'preview',
  'login', 'signup', 'billing', 'payments', 'courses', 'reads', 'a', 'assets', 'cdn',
  'status', 'support', 'help', 'docs', 'blog', 'auth', 'account', 'static', 'files',
  'media', 'webhook', 'webhooks', 'cron', 'ftp', 'smtp', 'ns', 'ns1', 'ns2', 'mx',
  'email', 'portal', 'academy', 'school', 'poket', 'pocket', 'beta', 'demo', 'sandbox',
  'edge', 'img', 'images', 'fonts', 'public', 'private', 'internal', 'root', 'join',
  'verify', 'legal', 'pricing', 'onboarding', 'null', 'undefined', 'localhost',
  'teacher-studio', 'ai-teachers', 'ai-studio', 'mode-preview',
]);

const PLATFORM_HOSTS = new Set([PLATFORM_ROOT, `www.${PLATFORM_ROOT}`, 'localhost']);

function cleanSlug(input: string): string {
  return input.trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** A host label an academy may claim, or null when it is reserved or unusable. */
export function normaliseSubdomain(input: string): string | null {
  const slug = cleanSlug(input);
  if (slug.length < 3 || slug.length > 63) return null;
  if (RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

export function isReservedSubdomain(input: string): boolean {
  return RESERVED_SUBDOMAINS.has(cleanSlug(input));
}

/** Why a typed slug cannot be saved. Null means the cleaned slug is usable. */
export function slugBlockReason(input: string): string | null {
  if (!input.trim()) return null;
  const slug = cleanSlug(input);
  if (RESERVED_SUBDOMAINS.has(slug)) return 'That address is reserved for Poket School.';
  if (slug.length < 3 || slug.length > 63) return 'Use 3–63 letters, numbers, or hyphens.';
  return null;
}

export type TenantRequest =
  | { kind: 'platform' }
  | { kind: 'subdomain'; slug: string }
  | { kind: 'path'; slug: string }
  | { kind: 'custom'; hostname: string };

/** Slug from `/a/{slug}` and `/a/{slug}/...`. Reserved slugs are not academies. */
export function academySlugFromPath(pathname: string): string | null {
  const path = pathname.split('?')[0]?.split('#')[0] ?? '';
  const match = /^\/a\/([a-z0-9-]+)(?:\/|$)/i.exec(path);
  if (!match?.[1]) return null;
  return normaliseSubdomain(match[1]);
}

/** Path the app should render after the `/a/{slug}` prefix is removed. */
export function stripAcademyPath(pathname: string): string {
  const path = (pathname.split('?')[0] ?? '/').replace(/^\/a\/[a-z0-9-]+/i, '');
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function tenantFromRequest(host: string | null | undefined, pathname: string): TenantRequest {
  const pathSlug = academySlugFromPath(pathname);
  if (pathSlug) return { kind: 'path', slug: pathSlug };

  const hostname = (host ?? '').split(':')[0]?.trim().toLowerCase() ?? '';
  if (!hostname || PLATFORM_HOSTS.has(hostname)) return { kind: 'platform' };
  if (/^[\d.]+$/.test(hostname)) return { kind: 'platform' };
  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.local')) return { kind: 'platform' };

  if (hostname.endsWith('.localhost')) {
    const label = hostname.slice(0, -'.localhost'.length);
    if (!label || label.includes('.') || isReservedSubdomain(label)) return { kind: 'platform' };
    return { kind: 'subdomain', slug: label };
  }

  if (hostname === PLATFORM_ROOT || hostname.endsWith(`.${PLATFORM_ROOT}`)) {
    const label = hostname.slice(0, -(PLATFORM_ROOT.length + 1));
    if (!label || label.includes('.') || label === 'www' || isReservedSubdomain(label)) return { kind: 'platform' };
    return { kind: 'subdomain', slug: label };
  }

  if (hostname.includes('.')) return { kind: 'custom', hostname };
  return { kind: 'platform' };
}

/** Where a renamed slug should send the visitor. Null when they are already current. */
export function renameRedirect(input: {
  requestedSlug: string;
  currentSlug: string;
  mode: 'subdomain' | 'path';
  pathname: string;
  search?: string;
  root?: string;
}): string | null {
  if (!input.currentSlug || input.requestedSlug === input.currentSlug) return null;
  const search = input.search ?? '';
  if (input.mode === 'path') {
    const rest = stripAcademyPath(input.pathname);
    const suffix = rest === '/' ? '' : rest;
    return `/a/${input.currentSlug}${suffix}${search}`;
  }
  const root = input.root ?? PLATFORM_ROOT;
  return `https://${input.currentSlug}.${root}${input.pathname || '/'}${search}`;
}

/** Keep `/a/{slug}` on in-app links while the visitor is using the path fallback. */
export function prefixAcademyHref(href: string, slug: string | null | undefined): string {
  if (!slug || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/a/')) return href;
  return href === '/' ? `/a/${slug}` : `/a/${slug}${href}`;
}

export function cnameInstructions(hostname: string): { host: string; type: 'CNAME'; value: string; note: string } {
  const labels = hostname.split('.').filter(Boolean);
  const host = labels.length > 2 ? labels[0] ?? hostname : hostname;
  const apex = labels.length <= 2;
  const note = apex
    ? `At the DNS host for ${hostname}, add an ALIAS or ANAME for the apex to ${CNAME_TARGET}. A www name can be a CNAME to the same target. Vercel issues the certificate after the record answers.`
    : `At the DNS host, add a CNAME for ${host} pointing at ${CNAME_TARGET}. Vercel issues the certificate after the record answers.`;
  return { host, type: 'CNAME', value: CNAME_TARGET, note };
}

export function vercelDomainConfigured(env: { VERCEL_TOKEN?: string; VERCEL_PROJECT_ID?: string }): boolean {
  return Boolean(env.VERCEL_TOKEN?.trim() && env.VERCEL_PROJECT_ID?.trim());
}

export interface DomainAttachResult {
  status: 'manual' | 'pending' | 'verified' | 'active' | 'error';
  ssl: 'automatic' | 'manual' | 'pending';
  message: string;
}

export function manualDomainResult(): DomainAttachResult {
  return {
    status: 'manual',
    ssl: 'manual',
    message: 'Add the DNS record below. Automatic SSL runs when VERCEL_TOKEN and VERCEL_PROJECT_ID are set on the server.',
  };
}

export function interpretVercelDomain(input: {
  httpStatus: number;
  verified?: boolean;
  misconfigured?: boolean;
  alreadyExists?: boolean;
  error?: string;
}): DomainAttachResult {
  if (input.httpStatus === 0) return manualDomainResult();
  if (input.httpStatus >= 400 && !input.alreadyExists) {
    return {
      status: 'error',
      ssl: 'pending',
      message: input.error || 'Vercel did not accept this domain. The DNS instructions still apply.',
    };
  }
  if (input.misconfigured) {
    return {
      status: 'pending',
      ssl: 'pending',
      message: 'The domain is on the Vercel project. DNS does not point at Vercel yet, so the certificate is waiting.',
    };
  }
  if (input.verified) {
    return {
      status: 'active',
      ssl: 'automatic',
      message: 'Vercel verified the domain and will attach SSL automatically.',
    };
  }
  return {
    status: 'pending',
    ssl: 'pending',
    message: 'The domain was added to the Vercel project. SSL follows once DNS verifies.',
  };
}

export interface TenantCatalogue {
  catalogueVisibility?: 'private' | 'curated' | 'public';
  publicCatalogueIds?: readonly string[];
}

/** On an academy host, guests see that academy's catalogue rather than the whole market. */
export function filterTenantCatalogue<T extends { id: string }>(
  items: readonly T[],
  tenant: TenantCatalogue | null | undefined,
  memberIds: readonly string[] = [],
): T[] {
  if (!tenant) return [...items];
  if (tenant.catalogueVisibility === 'public') return [...items];
  const ids = new Set([...(tenant.publicCatalogueIds ?? []), ...memberIds]);
  if (tenant.catalogueVisibility === 'private') return items.filter((item) => ids.has(item.id));
  return items.filter((item) => ids.has(item.id));
}

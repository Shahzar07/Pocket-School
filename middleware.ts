import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GEO_COUNTRY_COOKIE, GEO_REGION_COOKIE } from '@/lib/languages';
import { stripAcademyPath, TENANT_HEADER, tenantFromRequest } from '@/lib/tenant-host';

/**
 * Copies Vercel's geo headers onto short-lived cookies so the client can
 * choose a default language. A saved user choice still wins; these cookies
 * are only a hint.
 *
 * An academy hostname, or `/a/{slug}` until poketschool.ai DNS is live, is
 * marked on the request. The path prefix is rewritten onto the real route
 * and stays in the browser URL, so the main site is never branded by a visit
 * to one academy.
 */
export function middleware(request: NextRequest) {
  const geo = (request as NextRequest & { geo?: { country?: string | null; region?: string | null } }).geo;
  const country = request.headers.get('x-vercel-ip-country') || geo?.country || '';
  const region = request.headers.get('x-vercel-ip-country-region') || geo?.region || '';
  const tenant = tenantFromRequest(request.headers.get('host'), request.nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  if (tenant.kind === 'subdomain' || tenant.kind === 'path') {
    requestHeaders.set(TENANT_HEADER, tenant.slug);
    requestHeaders.set('x-poket-tenant-mode', tenant.kind);
  } else if (tenant.kind === 'custom') {
    requestHeaders.set('x-poket-tenant-host', tenant.hostname);
    requestHeaders.set('x-poket-tenant-mode', 'custom');
  }

  const response = tenant.kind === 'path'
    ? NextResponse.rewrite(rewriteAcademyPath(request), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  const cookie = { path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax' as const };
  if (country) response.cookies.set(GEO_COUNTRY_COOKIE, country, cookie);
  if (region) response.cookies.set(GEO_REGION_COOKIE, region, cookie);
  return response;
}

function rewriteAcademyPath(request: NextRequest): URL {
  const url = request.nextUrl.clone();
  url.pathname = stripAcademyPath(request.nextUrl.pathname);
  return url;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

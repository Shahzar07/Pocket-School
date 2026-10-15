import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GEO_COUNTRY_COOKIE, GEO_REGION_COOKIE } from '@/lib/languages';

/**
 * Copies Vercel's geo headers onto short-lived cookies so the client can
 * choose a default language. A saved user choice still wins; these cookies
 * are only a hint.
 */
export function middleware(request: NextRequest) {
  const geo = (request as NextRequest & { geo?: { country?: string | null; region?: string | null } }).geo;
  const country = request.headers.get('x-vercel-ip-country') || geo?.country || '';
  const region = request.headers.get('x-vercel-ip-country-region') || geo?.region || '';
  const response = NextResponse.next();
  const cookie = { path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax' as const };
  if (country) response.cookies.set(GEO_COUNTRY_COOKIE, country, cookie);
  if (region) response.cookies.set(GEO_REGION_COOKIE, region, cookie);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

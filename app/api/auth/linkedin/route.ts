import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, rateLimit, requireUser } from '@/lib/api-guard';
import { beginLinkedIn, linkedInPublicConfig } from '@/lib/server/linkedin-auth';

export const dynamic = 'force-dynamic';

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

function stateCookie(response: NextResponse, state: string) {
  response.cookies.set('ps_li_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  });
}

export async function GET(req: NextRequest) {
  const config = linkedInPublicConfig();
  if (req.nextUrl.searchParams.get('start') !== 'login') return NextResponse.json(config);
  if (!rateLimit(`linkedin:${ipOf(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }
  const begun = await beginLinkedIn({ origin: req.nextUrl.origin, mode: 'login' });
  if ('error' in begun) {
    return NextResponse.json({ ...config, error: begun.error }, { status: config.enabled ? 503 : 404 });
  }
  const response = NextResponse.redirect(begun.url);
  stateCookie(response, begun.state);
  return response;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const begun = await beginLinkedIn({ origin: req.nextUrl.origin, mode: 'link', uid: user.uid });
  if ('error' in begun) return NextResponse.json({ error: begun.error }, { status: 400 });
  const response = NextResponse.json({ url: begun.url });
  stateCookie(response, begun.state);
  return response;
}

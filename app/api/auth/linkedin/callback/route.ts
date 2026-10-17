import { NextRequest, NextResponse } from 'next/server';
import { finishLinkedIn } from '@/lib/server/linkedin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const cookie = req.cookies.get('ps_li_state')?.value ?? '';
  const fail = (flag: 'link-first' | 'unavailable') => {
    const response = NextResponse.redirect(new URL(`/login?linkedin=${flag}`, req.nextUrl.origin));
    response.cookies.delete('ps_li_state');
    return response;
  };
  if (!code || !state || state !== cookie) return fail('unavailable');
  const done = await finishLinkedIn({ origin: req.nextUrl.origin, code, state });
  if ('error' in done) {
    return fail(done.error.includes('Sign in with Poket School first') ? 'link-first' : 'unavailable');
  }
  if (done.mode === 'link') {
    const response = NextResponse.redirect(new URL('/dashboard/student/portfolio?linkedin=linked', req.nextUrl.origin));
    response.cookies.delete('ps_li_state');
    return response;
  }
  const response = NextResponse.redirect(new URL('/login?linkedin=ready', req.nextUrl.origin));
  response.cookies.delete('ps_li_state');
  response.cookies.set('ps_li_token', done.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 120,
    path: '/',
  });
  return response;
}

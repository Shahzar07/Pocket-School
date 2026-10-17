import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`linkedin-session:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }
  const token = req.cookies.get('ps_li_token')?.value ?? '';
  const response = token
    ? NextResponse.json({ token })
    : NextResponse.json({ error: 'LinkedIn sign-in did not finish. Try again.' }, { status: 400 });
  response.cookies.delete('ps_li_token');
  return response;
}

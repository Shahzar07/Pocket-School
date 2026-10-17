import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { BRAND, FONT } from '@/lib/brand-theme';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { unsubscribeAlumni } from '@/lib/server/alumni-network-store';

export const dynamic = 'force-dynamic';

function page(title: string, message: string, status: number): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="margin:0;background:${BRAND.bg};color:${BRAND.ink};font-family:${FONT.sans},${FONT.display},sans-serif"><main style="max-width:36rem;margin:4rem auto;padding:1.5rem"><h1 style="font-size:1.6rem;font-family:${FONT.display},sans-serif">${title}</h1><p>${message}</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`alumni-unsub:${ip}`, 30, 60_000)) {
    return page('Please wait', 'Too many requests. Try this link again in a moment.', 429);
  }
  if (!isAdminConfigured()) {
    return page('Unavailable', 'Unsubscribe is unavailable until the server is configured.', 503);
  }
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? '';
  const result = await unsubscribeAlumni(token);
  if (!result) return page('Link not recognised', 'This unsubscribe link is not active.', 404);
  return page(
    'Unsubscribed',
    'Email and push from this academy have stopped. Your inbox choice is unchanged, and your class history stays on your account.',
    200,
  );
}

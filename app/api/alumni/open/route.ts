import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { recordCampaignSignal } from '@/lib/server/alumni-network-store';

export const dynamic = 'force-dynamic';

/** Records one open or click, then brings the alumnus to the class network. */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`alumni-open:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }
  const kind = req.nextUrl.searchParams.get('kind') === 'click' ? 'click' : 'open';
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? '';
  if (isAdminConfigured()) await recordCampaignSignal(token, kind);
  return NextResponse.redirect(new URL('/dashboard/student/network', req.url));
}

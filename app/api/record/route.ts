import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { openSharedRecord, requestVerification } from '@/lib/server/job-tracker-store';

export const dynamic = 'force-dynamic';

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`record:${ipOf(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }
  if (!isAdminConfigured()) return NextResponse.json({ open: false, reason: 'This record is not available yet.' });
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? '';
  const record = await openSharedRecord({
    token,
    visitorLabel: req.nextUrl.searchParams.get('visitor') ?? '',
    itemTitle: req.nextUrl.searchParams.get('item') ?? '',
  });
  return NextResponse.json(record);
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`record-post:${ipOf(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.action !== 'request') return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
  const saved = await requestVerification({
    token: typeof body.token === 'string' ? body.token : '',
    itemId: body.itemId,
    note: body.note,
    visitorLabel: body.visitorLabel,
  });
  if ('error' in saved) return NextResponse.json(saved, { status: 400 });
  return NextResponse.json(saved);
}

import { NextRequest, NextResponse } from 'next/server';
import { recordReferralClick } from '@/lib/payments/server/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  try {
    const result = await recordReferralClick(typeof body.code === 'string' ? body.code : '');
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false });
  }
}

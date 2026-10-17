import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import {
  cardTokenSecret,
  issueCardProof,
  listVisibleOffers,
  redeemOffer,
  verifyCheckoutCode,
} from '@/lib/student-id/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function ready(needsSecret: boolean): void {
  if (!isAdminConfigured()) throw new ActionError('INVALID', 'Student perks are coming soon.');
  if (needsSecret && cardTokenSecret().length < 16) throw new ActionError('INVALID', 'The student ID check is coming soon.');
}

export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get('view');
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Student perks are coming soon.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  if (view !== 'perks' && cardTokenSecret().length < 16) {
    return NextResponse.json({ error: 'The student ID check is coming soon.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  return runGet(req, async (user) => {
    if (view === 'perks') return { offers: await listVisibleOffers(user.uid) };
    return issueCardProof(user.uid);
  });
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    const action = typeof body.action === 'string' ? body.action : 'proof';
    ready(action === 'proof' || action === 'check-code');
    if (action === 'proof') return issueCardProof(user.uid);
    if (action === 'redeem') {
      const offerId = typeof body.offerId === 'string' ? body.offerId : '';
      const method = body.method === 'static' || body.method === 'unique' || body.method === 'scan' ? body.method : 'scan';
      if (!offerId) throw new ActionError('VALIDATION', 'Choose a perk.');
      return redeemOffer(user.uid, offerId, method);
    }
    if (action === 'check-code') {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!/^\d{6}$/.test(code)) throw new ActionError('VALIDATION', 'Enter the 6-digit code.');
      const face = await verifyCheckoutCode(user.uid, code);
      if (face === 'locked') throw new ActionError('LOCKED', 'Too many attempts. Try again later.');
      if (!face) throw new ActionError('VALIDATION', 'That code is not active.');
      return { face };
    }
    throw new ActionError('VALIDATION', 'Unknown student ID action.');
  });
}

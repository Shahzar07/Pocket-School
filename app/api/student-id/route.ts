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

function ready(): void {
  if (!isAdminConfigured()) throw new ActionError('INVALID', 'The student ID needs the server account.');
  if (cardTokenSecret().length < 16) throw new ActionError('INVALID', 'CARD_TOKEN_SECRET is not set.');
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured() || cardTokenSecret().length < 16) {
    return NextResponse.json({ error: 'The student ID needs the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const view = req.nextUrl.searchParams.get('view');
  return runGet(req, async (user) => {
    if (view === 'perks') return { offers: await listVisibleOffers(user.uid) };
    return issueCardProof(user.uid);
  });
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    ready();
    const action = typeof body.action === 'string' ? body.action : 'proof';
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

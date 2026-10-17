import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { asShareChannel } from '@/lib/cards/model';
import {
  createShare,
  ensureMemberIdentity,
  linkedUnder13,
  ownerCard,
  recordShareChannel,
  redeemReferral,
  regenerateShare,
  revokeShare,
  setCardIndexed,
  setParentSharing,
} from '@/lib/cards/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function ready(): void {
  if (!isAdminConfigured()) throw new ActionError('INVALID', 'The member card needs the server account.');
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'The member card needs the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  return runGet(req, async (user) => {
    const card = await ownerCard(user.uid);
    const children = await linkedUnder13(user.uid);
    return { card, children };
  });
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    ready();
    const action = typeof body.action === 'string' ? body.action : 'issue';
    if (action === 'issue') {
      const identity = await ensureMemberIdentity(user.uid);
      const redeemed = await redeemReferral(user.uid, body.ref);
      return { ...identity, redeemed };
    }
    if (action === 'share') {
      const shareId = await createShare(user.uid, user.uid);
      return { shareId, sharePath: `/card/${shareId}` };
    }
    if (action === 'regenerate') {
      const shareId = await regenerateShare(user.uid, user.uid);
      return { shareId, sharePath: `/card/${shareId}` };
    }
    if (action === 'revoke') {
      await revokeShare(user.uid, user.uid);
      return { shareId: '' };
    }
    if (action === 'channel') {
      const channel = asShareChannel(body.channel);
      if (!channel) throw new ActionError('VALIDATION', 'Choose a share channel.');
      await recordShareChannel(user.uid, channel);
      return { ok: true };
    }
    if (action === 'index') {
      await setCardIndexed(user.uid, body.indexed === true);
      return { indexed: body.indexed === true };
    }
    if (action === 'parent-share') {
      const childUid = typeof body.childUid === 'string' ? body.childUid : '';
      if (!childUid) throw new ActionError('VALIDATION', 'Choose a child.');
      await setParentSharing(user.uid, childUid, body.enabled === true);
      return { ok: true };
    }
    throw new ActionError('VALIDATION', 'Unknown card action.');
  });
}

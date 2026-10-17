import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import {
  confirmEmailCode,
  confirmGuardianCode,
  confirmPhoneCode,
  createGuardianCode,
  readOwnVerification,
  runOptionalIdCheck,
  saveCountries,
  sendPhoneCode,
  verifyPartner,
  verifyPrincipal,
  verifyStaff,
} from '@/lib/server/verification';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'read') return readOwnVerification(user.uid);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'email') return confirmEmailCode(user.uid, str(body.code), str(body.token), Number(body.expiresAt));
    if (action === 'phone-send') return sendPhoneCode(user.uid);
    if (action === 'phone') return confirmPhoneCode(user.uid, str(body.code), str(body.token), Number(body.expiresAt));
    if (action === 'guardian-code') return createGuardianCode(user.uid);
    if (action === 'confirm-guardian') return confirmGuardianCode(user.uid, str(body.code));
    if (action === 'id-check') return runOptionalIdCheck(user.uid);
    if (action === 'staff') {
      const method = body.method === 'email_domain' ? 'email_domain' : 'admin_invite';
      return verifyStaff(user.uid, str(body.targetUid), method);
    }
    if (action === 'principal') return verifyPrincipal(user.uid, str(body.targetUid), str(body.note));
    if (action === 'partner') return verifyPartner(user.uid, str(body.targetUid), body.kind === 'ngo' ? 'ngo' : 'police');
    if (action === 'country') return saveCountries(user.uid, str(body.currentCountry), str(body.homeCountry));
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

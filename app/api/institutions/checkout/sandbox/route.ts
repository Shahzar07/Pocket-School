import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { callerOwnsInstitution, institutionPaymentKeys, settleInstitutionOrder } from '@/lib/server/institution-activate';
import { adminDb } from '@/lib/firebase-admin';
import { checkoutChannel } from '@/lib/institution-self-serve';

export const dynamic = 'force-dynamic';

/** Completes a test payment when Stripe and the Malaysian gateway have no keys. */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Institution checkout needs the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as { institutionId?: string };
  const institutionId = body.institutionId?.trim() ?? '';
  if (!(await callerOwnsInstitution(user.uid, institutionId))) {
    return NextResponse.json({ error: 'Sign in as this academy’s admin to check out.' }, { status: 403 });
  }
  const order = await adminDb().doc(`institutions/${institutionId}/billing/order`).get();
  const data = order.data() ?? {};
  const keys = await institutionPaymentKeys();
  const channel = checkoutChannel({
    stripe: keys.stripe,
    gateway: keys.gateway,
    currency: typeof data.currency === 'string' ? data.currency : 'USD',
    tender: data.tender === 'fpx' || data.tender === 'invoice' ? data.tender : 'card',
    total: typeof data.total === 'number' ? data.total : 1,
  });
  if (channel !== 'sandbox') {
    return NextResponse.json({ error: 'A live payment method is configured. Use that instead of test mode.' }, { status: 409 });
  }
  const settled = await settleInstitutionOrder(institutionId, { providerRef: 'sandbox' });
  return NextResponse.json({ ...settled, sandbox: true });
}

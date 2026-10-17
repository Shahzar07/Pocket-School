import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { adminDb } from '@/lib/firebase-admin';
import { manageDestination } from '@/lib/billing/model';
import { payerSource, saveStripeCustomer } from '@/lib/billing/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as { institutionId?: string; returnPath?: string };
  const origin = req.nextUrl.origin;
  const returnUrl = `${origin}${body.returnPath && body.returnPath.startsWith('/dashboard') ? body.returnPath : '/dashboard'}`;

  if (body.institutionId) {
    const profile = await loadUser(user.uid);
    const role = typeof profile?.role === 'string' ? profile.role : user.role;
    const owns = profile?.institutionId === body.institutionId && role === 'institution_admin';
    const admin = role === 'admin' || user.adminRole === 'super' || user.role === 'admin';
    if (!owns && !admin) return NextResponse.json({ error: 'Institution admin access required.' }, { status: 403 });
    const link = await portalFor(body.institutionId, `institutions/${body.institutionId}`, user.email || '', returnUrl);
    if ('error' in link && link.error) return NextResponse.json(link, { status: 503 });
    return NextResponse.json(link);
  }

  const owned = await payerSource(user.uid);
  const destination = manageDestination(owned.source, null);
  if (destination.kind === 'store') return NextResponse.json({ url: destination.url, kind: 'store', source: owned.source });
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Card billing is not switched on yet.', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });
  }
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let customerId = owned.stripeCustomerId;
  if (!customerId) {
    const email = owned.email || user.email || '';
    if (!email) return NextResponse.json({ error: 'Add an email before managing billing.' }, { status: 400 });
    const existing = await stripe.customers.list({ email, limit: 1 });
    customerId = existing.data[0]?.id || (await stripe.customers.create({ email, metadata: { uid: user.uid } })).id;
    await saveStripeCustomer(user.uid, customerId);
  }
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return NextResponse.json({ url: session.url, kind: 'portal', source: 'stripe' });
}

async function portalFor(institutionId: string, docPath: string, email: string, returnUrl: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: 'Card billing is not switched on yet.', code: 'STRIPE_NOT_CONFIGURED' };
  }
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const snap = await adminDb().doc(docPath).get();
  let customerId = typeof snap.data()?.stripeCustomerId === 'string' ? snap.data()?.stripeCustomerId as string : '';
  if (!customerId) {
    if (!email) return { error: 'Add a billing email first.' };
    const created = await stripe.customers.create({ email, metadata: { institutionId } });
    customerId = created.id;
    await adminDb().doc(docPath).set({ stripeCustomerId: customerId }, { merge: true });
  }
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return { url: session.url, kind: 'portal' as const, source: 'stripe' as const };
}

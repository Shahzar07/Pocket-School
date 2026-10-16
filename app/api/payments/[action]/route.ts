import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { requestClient } from '@/lib/audit/model';
import { recordActivity } from '@/lib/audit/server';
import { ActionError } from '@/lib/server/actions';
import { runPost } from '@/lib/server/http';
import {
  completeSandbox,
  connectOnboarding,
  createOffer,
  financeAdmin,
  integrationsAdmin,
  paymentsAdmin,
  activePromoBanners,
  quoteFor,
  recordReferralClick,
  referralState,
  refundCheckout,
  startCheckout,
  updateIntegrations,
  updatePayments,
  walletView,
  type CheckoutInput,
} from '@/lib/payments/server/engine';
import { secretValue } from '@/lib/payments/server/settings';
import { SECRET_SLOTS } from '@/lib/payments/secrets';

export const dynamic = 'force-dynamic';

function input(uid: string, email: string | undefined, body: Record<string, unknown>, origin: string): CheckoutInput {
  return {
    uid,
    email,
    kind: typeof body.kind === 'string' ? body.kind : '',
    sku: typeof body.sku === 'string' ? body.sku : '',
    country: typeof body.country === 'string' ? body.country : 'MY',
    currency: typeof body.currency === 'string' ? body.currency : undefined,
    interval: typeof body.interval === 'string' ? body.interval : undefined,
    seats: typeof body.seats === 'number' ? body.seats : Number(body.seats) || undefined,
    coupon: typeof body.coupon === 'string' ? body.coupon : undefined,
    childIds: Array.isArray(body.childIds) ? body.childIds.filter((id): id is string => typeof id === 'string') : [],
    method: typeof body.method === 'string' ? body.method : undefined,
    idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    origin,
  };
}

async function requireSuper(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!(await callerIsAdmin(user.uid, user.email, user))) {
    return NextResponse.json({ error: 'Super admin access required.', code: 'FORBIDDEN' }, { status: 403 });
  }
  return user;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'admin-payments' || action === 'admin-integrations' || action === 'admin-finance' || action === 'refund') {
    const admin = await requireSuper(req);
    if (isNextResponse(admin)) return admin;
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      if (action === 'admin-payments') {
        if (!body.action) return NextResponse.json(await paymentsAdmin());
        const result = await updatePayments(body);
        await recordPaymentsChange(req, admin, body.action === 'flags' ? 'flags.edit' : 'payments.edit', body);
        return NextResponse.json(result);
      }
      if (action === 'admin-integrations') {
        if (body.action === 'test') return NextResponse.json(await testSlot(typeof body.slot === 'string' ? body.slot : ''));
        if (!body.action) return NextResponse.json(await integrationsAdmin());
        const result = await updateIntegrations(body);
        await recordPaymentsChange(req, admin, body.action === 'flags' ? 'flags.edit' : 'payments.edit', body);
        return NextResponse.json(result);
      }
      if (action === 'admin-finance') return NextResponse.json(await financeAdmin());
      const checkoutId = typeof body.checkoutId === 'string' ? body.checkoutId : '';
      const refund = await refundCheckout(admin.uid, checkoutId, admin);
      const client = requestClient(req.headers);
      await recordActivity({
        action: 'admin.action',
        actorId: admin.uid,
        actorEmail: admin.email,
        actorRole: 'super_admin',
        ip: client.ip,
        device: client.device,
        targetType: 'checkout',
        targetId: checkoutId,
        targetLabel: 'refund',
      });
      return NextResponse.json(refund);
    } catch (error) {
      return fail(error);
    }
  }

  return runPost(req, async (user, body) => {
    const origin = req.nextUrl.origin;
    if (action === 'quote') return quoteFor(input(user.uid, user.email, body, origin));
    if (action === 'checkout') return startCheckout(input(user.uid, user.email, body, origin));
    if (action === 'sandbox-complete') return completeSandbox(user.uid, typeof body.checkoutId === 'string' ? body.checkoutId : '');
    if (action === 'wallet') return walletView(user.uid);
    if (action === 'connect') return connectOnboarding(user.uid, user.email, origin);
    if (action === 'offer') {
      return createOffer(user.uid, {
        title: typeof body.title === 'string' ? body.title : '',
        price: Number(body.price),
        currency: typeof body.currency === 'string' ? body.currency : 'USD',
        minutes: Number(body.minutes),
      });
    }
    if (action === 'referral') {
      const profile = body;
      return referralState(user.uid, typeof profile.name === 'string' ? profile.name : '', body.create === true, {
        item: typeof body.item === 'string' ? body.item : undefined,
        kind: typeof body.kind === 'string' ? body.kind : undefined,
        percentOff: body.percentOff === undefined ? undefined : Number(body.percentOff),
        quantityLimit: body.quantityLimit === undefined ? undefined : Number(body.quantityLimit),
        expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
      });
    }
    throw new ActionError('INVALID', 'Unknown payment action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'admin-payments' || action === 'admin-integrations' || action === 'admin-finance') {
    const admin = await requireSuper(req);
    if (isNextResponse(admin)) return admin;
    try {
      if (action === 'admin-payments') return NextResponse.json(await paymentsAdmin());
      if (action === 'admin-integrations') return NextResponse.json(await integrationsAdmin());
      return NextResponse.json(await financeAdmin());
    } catch (error) {
      return fail(error);
    }
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    if (action === 'wallet') return NextResponse.json(await walletView(user.uid));
    if (action === 'referral') return NextResponse.json(await referralState(user.uid, '', false));
    return NextResponse.json({ error: 'Unknown payment action.', code: 'INVALID' }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}

function safePaymentsAfter(body: Record<string, unknown>): Record<string, unknown> {
  if (body.action === 'secret') {
    return { slot: typeof body.slot === 'string' ? body.slot : '', changed: true };
  }
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'value' || key === 'secret' || key === 'apiKey') continue;
    copy[key] = value;
  }
  return copy;
}

async function recordPaymentsChange(
  req: NextRequest,
  admin: { uid: string; email?: string },
  action: 'payments.edit' | 'flags.edit',
  body: Record<string, unknown>,
) {
  const client = requestClient(req.headers);
  await recordActivity({
    action,
    actorId: admin.uid,
    actorEmail: admin.email,
    actorRole: 'super_admin',
    ip: client.ip,
    device: client.device,
    targetType: 'payments',
    targetId: typeof body.action === 'string' ? body.action : 'payments',
    after: safePaymentsAfter(body),
  });
}

function fail(error: unknown): NextResponse {
  if (error instanceof ActionError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
}

async function testSlot(slotId: string): Promise<{ ok: boolean; mode: string; message: string }> {
  const slot = SECRET_SLOTS.find((item) => item.id === slotId);
  if (!slot) return { ok: false, mode: 'mock', message: 'Unknown integration.' };
  const secret = await secretValue(slotId);
  if (!secret) return { ok: true, mode: 'mock', message: 'No key stored. Sandbox connection succeeded.' };
  try {
    if (slot.id === 'stripe_secret') {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(secret);
      await stripe.balance.retrieve();
      return { ok: true, mode: 'live', message: 'Stripe answered. The key can read the account balance.' };
    }
    if (slot.id === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${secret}` } });
      return response.ok
        ? { ok: true, mode: 'live', message: 'OpenRouter accepted the key.' }
        : { ok: false, mode: 'live', message: 'OpenRouter rejected the key.' };
    }
    if (slot.id === 'billplz_key') {
      const host = process.env.MY_GATEWAY_MODE === 'live' ? 'https://www.billplz.com' : 'https://www.billplz-sandbox.com';
      const response = await fetch(`${host}/api/v3/collections`, {
        headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}` },
      });
      return response.ok
        ? { ok: true, mode: 'live', message: 'Billplz accepted the key.' }
        : { ok: false, mode: 'live', message: 'Billplz rejected the key.' };
    }
    return { ok: true, mode: 'stored', message: 'Key is stored. A live ping is not available for this provider yet, and the value is long enough to be a key.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The provider did not respond.';
    return { ok: false, mode: 'live', message: message.slice(0, 180) };
  }
}

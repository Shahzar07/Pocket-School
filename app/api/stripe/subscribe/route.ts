import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { tierDefinition, type AccessTier } from '@/lib/entitlements';
import { tierFromId } from '@/lib/server/actions';
import { PLATFORM_CURRENCY } from '@/lib/money';
import { planById, seedPricing } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Card payments are not switched on yet.', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as { tierId?: string; annual?: boolean };
  const tier = tierFromId(body.tierId ?? '');
  if (tier == null || tier === 0 || tier >= 5) {
    return NextResponse.json({ error: 'That plan is not sold online.' }, { status: 400 });
  }
  const def = tierDefinition(tier as AccessTier);
  const pricing = seedPricing();
  const monthly = planById(pricing, def.id)?.monthlyUsd ?? 0;
  if (monthly <= 0) return NextResponse.json({ error: 'That plan has no price.' }, { status: 400 });
  const origin = req.nextUrl.origin;
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: PLATFORM_CURRENCY.toLowerCase(),
        unit_amount: body.annual
          ? Math.round(monthly * 12 * (1 - pricing.annualDiscount) * 100)
          : Math.round(monthly * 100),
        recurring: { interval: body.annual ? 'year' : 'month' },
        product_data: {
          name: `Poket School — ${def.name}`,
          description: def.programmes.join(' · '),
        },
      },
    }],
    metadata: {
      kind: 'subscription',
      uid: user.uid,
      tierId: def.id,
      accessTier: String(def.tier),
    },
    success_url: `${origin}/dashboard/student?upgraded=1`,
    cancel_url: `${origin}/pricing`,
  });
  return NextResponse.json({ url: session.url });
}

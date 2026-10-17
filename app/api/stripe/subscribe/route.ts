import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { tierDefinition, type AccessTier } from '@/lib/entitlements';
import { tierFromId } from '@/lib/server/actions';
import { PLATFORM_CURRENCY } from '@/lib/money';
import { defaultTeacherPlan } from '@/lib/institution-commerce';
import { planById, seedPricing } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const profile = await loadUser(user.uid);
  if (typeof profile?.institutionId === 'string' && profile.institutionId) {
    return NextResponse.json({
      error: 'Your institution covers this seat. Poket School does not charge students, teachers, or parents on an institution plan.',
    }, { status: 409 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Card payments are not switched on yet.', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as { tierId?: string; annual?: boolean };
  if (profile?.role === 'parent') {
    return NextResponse.json({
      error: 'Parent accounts are free. The first independent child pays the plan. Each later child is 30% off.',
    }, { status: 409 });
  }
  if (body.tierId === 'teacher' || profile?.role === 'teacher') {
    if (body.tierId && body.tierId !== 'teacher') {
      return NextResponse.json({ error: 'Independent teachers pay the Teacher plan.' }, { status: 400 });
    }
    const teacher = defaultTeacherPlan();
    const amount = body.annual ? teacher.annualUsd : teacher.monthlyUsd;
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: PLATFORM_CURRENCY.toLowerCase(),
          unit_amount: Math.round(amount * 100),
          recurring: { interval: body.annual ? 'year' : 'month' },
          product_data: { name: 'Poket School — Teacher', description: 'Course builder and a monthly Sparks allowance.' },
        },
      }],
      metadata: {
        kind: 'individual_billing',
        uid: user.uid,
        planId: 'teacher',
        interval: body.annual ? 'annual' : 'monthly',
      },
      success_url: `${req.nextUrl.origin}/dashboard/teacher?upgraded=1`,
      cancel_url: `${req.nextUrl.origin}/pricing`,
    });
    return NextResponse.json({ url: session.url });
  }
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

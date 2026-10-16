import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { getPublicCourseById } from '@/lib/db';
import { loadPricingConfig } from '@/lib/pricing-store';
import { quoteCourse, stripeUnitAmount } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payments are coming soon.', code: 'COMING_SOON' },
      { status: 503 }
    );
  }

  let body: { courseId?: string; currency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { courseId } = body;
  if (!courseId) return NextResponse.json({ error: 'courseId required.' }, { status: 400 });

  const course = await getPublicCourseById(courseId);
  if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  if (!course.price || course.price <= 0) {
    return NextResponse.json({ error: 'Course is free — no payment needed.' }, { status: 400 });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' as any });

    const config = await loadPricingConfig();
    const quote = quoteCourse(config, course.price, course.currency, body.currency ?? course.currency ?? 'USD');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeUnitAmount(quote.amount, quote.currency),
      currency: quote.currency.toLowerCase(),
      metadata: {
        courseId,
        courseTitle: course.title,
        buyerEmail: user.email ?? user.uid,
        buyerId: user.uid,
      },
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      courseId,
      title: course.title,
      amount: quote.amount,
      currency: quote.currency,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment intent creation failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

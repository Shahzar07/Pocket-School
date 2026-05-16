import { NextRequest, NextResponse } from 'next/server';
import { getPublicCourseById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' },
      { status: 503 }
    );
  }

  let body: { courseId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { courseId, email } = body;
  if (!courseId) return NextResponse.json({ error: 'courseId required.' }, { status: 400 });

  const course = await getPublicCourseById(courseId);
  if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  if (!course.price || course.price <= 0) {
    return NextResponse.json({ error: 'Course is free — no payment needed.' }, { status: 400 });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' as any });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(course.price * 100),
      currency: (course.currency ?? 'GBP').toLowerCase(),
      metadata: {
        courseId,
        courseTitle: course.title,
        buyerEmail: email ?? 'guest',
      },
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      courseId,
      title: course.title,
      amount: course.price,
      currency: course.currency ?? 'GBP',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment intent creation failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

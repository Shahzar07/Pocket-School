import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';
import { PLATFORM_CURRENCY } from '@/lib/money';
import { purchaseGate } from '@/lib/billing/model';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Card payments are not switched on yet.', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as { courseId?: string };
  const profile = await loadUser(user.uid);
  const gate = purchaseGate({
    ageTier: profile?.ageTier,
    role: profile?.role,
    dateOfBirth: profile?.dateOfBirth,
    now: new Date(),
  });
  if (!gate.ok) return NextResponse.json({ error: gate.reason, code: 'MINOR' }, { status: 403 });
  if (!body.courseId) return NextResponse.json({ error: 'Choose a course first.' }, { status: 400 });
  const snap = await adminDb().doc(`courses/${body.courseId}`).get();
  if (!snap.exists) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  const course = snap.data() ?? {};
  const price = Number(course.price ?? 0);
  if (!price || price <= 0) {
    return NextResponse.json({ error: 'This course is free. Enrol from the course page.' }, { status: 400 });
  }
  const origin = req.nextUrl.origin;
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: (typeof course.currency === 'string' ? course.currency : PLATFORM_CURRENCY).toLowerCase(),
        unit_amount: Math.round(price * 100),
        product_data: { name: String(course.title ?? 'Course') },
      },
    }],
    metadata: {
      kind: 'course',
      studentId: user.uid,
      courseId: body.courseId,
      courseTitle: String(course.title ?? 'Course'),
    },
    success_url: `${origin}/dashboard/student/courses/${body.courseId}?paid=1`,
    cancel_url: `${origin}/courses/${body.courseId}`,
  });
  return NextResponse.json({ url: session.url });
}

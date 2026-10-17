import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { institutionEmail } from '@/lib/institution-membership';
import { planName } from '@/lib/institution-pricing';
import type { VolumeInterval, VolumePlanId } from '@/lib/institution-pricing';
import { openInstitutionBill } from '@/lib/server/institution-billing';

export const dynamic = 'force-dynamic';

const PLANS = new Set<string>(['primary_secondary', 'igcse_alevel', 'professional']);

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!(await callerIsAdmin(user.uid, user.email))) {
    return NextResponse.json({ error: 'A platform admin sends the payment link.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as {
    institutionId?: string;
    institutionName?: string;
    planId?: string;
    interval?: string;
    seats?: number;
    payerEmail?: string;
  };
  const institutionId = body.institutionId?.trim() ?? '';
  const planId = body.planId ?? '';
  const interval: VolumeInterval = body.interval === 'monthly' ? 'monthly' : 'annual';
  const seats = Math.floor(Number(body.seats));
  const payerEmail = body.payerEmail?.trim().toLowerCase() ?? '';
  if (!institutionId || !PLANS.has(planId) || !Number.isInteger(seats) || seats < 1 || !payerEmail.includes('@')) {
    return NextResponse.json({ error: 'Choose an institution, a level, a seat count, and a billing email.' }, { status: 400 });
  }
  const opened = await openInstitutionBill({
    institutionId,
    institutionName: body.institutionName?.trim() || 'Your institution',
    planId: planId as VolumePlanId,
    interval,
    seats,
    payerEmail,
  });
  let url = '';
  if (process.env.STRIPE_SECRET_KEY && opened.total > 0) {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: payerEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: opened.currency.toLowerCase(),
          unit_amount: Math.round(opened.total * 100),
          product_data: { name: `Poket School — ${planName(planId as VolumePlanId)} · ${seats} student seats` },
        },
      }],
      metadata: {
        kind: 'institution_billing',
        institutionId,
        interval,
        planId,
      },
      success_url: `${req.nextUrl.origin}/dashboard/institution/billing?paid=1`,
      cancel_url: `${req.nextUrl.origin}/dashboard/institution/billing`,
    });
    url = session.url ?? '';
  }
  const mail = institutionEmail('payment_link', {
    institutionName: body.institutionName?.trim() || 'Your institution',
    plan: planName(planId as VolumePlanId),
    seats,
    total: `${opened.currency} ${opened.total.toFixed(2)}`,
    link: url || `${req.nextUrl.origin}/dashboard/institution/billing`,
  });
  let emailed = false;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || `Poket School <${process.env.SMTP_USER}>`,
      to: payerEmail,
      subject: mail.subject,
      text: mail.text,
    });
    emailed = true;
  }
  return NextResponse.json({ url, emailed, subject: mail.subject, text: mail.text, total: opened.total, currency: opened.currency });
}

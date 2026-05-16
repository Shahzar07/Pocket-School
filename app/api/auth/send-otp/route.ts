import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Channel = 'sms' | 'whatsapp' | 'email';

function normalizeTo(phoneOrEmail: string, channel: Channel): string {
  const trimmed = phoneOrEmail.trim();
  if (channel === 'whatsapp') {
    return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
  }
  return trimmed;
}

export async function POST(req: NextRequest) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!sid || !token || !serviceSid) {
    return NextResponse.json(
      { error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID.' },
      { status: 503 }
    );
  }

  let body: { phone?: string; channel?: Channel };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { phone, channel = 'sms' } = body;
  if (!phone || phone.trim().length < 5) {
    return NextResponse.json({ error: 'Phone number (or email for email channel) is required.' }, { status: 400 });
  }
  if (!['sms', 'whatsapp', 'email'].includes(channel)) {
    return NextResponse.json({ error: 'channel must be sms, whatsapp or email.' }, { status: 400 });
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(sid, token);
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: normalizeTo(phone, channel),
        channel,
      });

    return NextResponse.json({ success: true, status: verification.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send verification code.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

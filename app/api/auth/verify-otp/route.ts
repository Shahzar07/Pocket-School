import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function normalizeTo(value: string): string {
  return value.trim().startsWith('whatsapp:') ? value.trim() : value.trim();
}

export async function POST(req: NextRequest) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!sid || !token || !serviceSid) {
    return NextResponse.json(
      { error: 'Twilio not configured.' },
      { status: 503 }
    );
  }

  let body: { phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { phone, code } = body;
  if (!phone || !code) {
    return NextResponse.json({ error: 'phone and code are required.' }, { status: 400 });
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(sid, token);
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: normalizeTo(phone),
        code: code.trim(),
      });

    const valid = check.status === 'approved';
    return NextResponse.json({ valid, status: check.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed.';
    return NextResponse.json({ valid: false, error: message }, { status: 400 });
  }
}

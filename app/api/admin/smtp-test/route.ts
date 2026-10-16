import { NextResponse } from 'next/server';
import firebaseConfig from '@/firebase-applet-config.json';
import { initialSuperAdmin } from '@/lib/admin-console';

export const runtime = 'nodejs';

async function callerEmail(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return null;
  const body = await response.json() as { users?: Array<{ email?: string }> };
  return body.users?.[0]?.email ?? null;
}

export async function POST(request: Request) {
  const email = await callerEmail(request);
  if (!email || !initialSuperAdmin(email)) {
    return NextResponse.json({ error: 'Only a super admin can send a test email.' }, { status: 403 });
  }
  const password = process.env.SMTP_PASS;
  if (!password) {
    return NextResponse.json({ error: 'Set SMTP_PASS in the environment. The password is not stored in settings.' }, { status: 400 });
  }
  const body = await request.json().catch(() => null) as { host?: string; port?: string; user?: string; to?: string } | null;
  const host = body?.host?.trim() ?? '';
  const user = body?.user?.trim() ?? '';
  const to = body?.to?.trim() ?? '';
  const port = Number(body?.port);
  if (!host || !user || !to || !Number.isFinite(port)) {
    return NextResponse.json({ error: 'Host, port, username, and a recipient are required.' }, { status: 400 });
  }
  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
    await transport.sendMail({
      from: user,
      to,
      subject: 'Poket School SMTP test',
      text: 'This is a test from System settings. If you can read it, outgoing mail is working.',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mail server refused the test.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

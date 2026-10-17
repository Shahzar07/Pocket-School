import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { resendEmailId, resendEventStatus, verifyResendSignature } from '@/lib/mail/webhook';
import { recordMailWebhook } from '@/lib/server/staff-notify';

export const dynamic = 'force-dynamic';

/** Resend delivery webhooks. Svix signature. Rejects when the secret is unset. */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  const body = await req.text();
  const verified = verifyResendSignature({
    secret,
    id: req.headers.get('svix-id') ?? '',
    timestamp: req.headers.get('svix-timestamp') ?? '',
    signature: req.headers.get('svix-signature') ?? '',
    body,
  });
  if (!verified) {
    return NextResponse.json({ error: 'Unauthorized.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return NextResponse.json({ error: 'The webhook body is not JSON.', code: 'BAD_REQUEST' }, { status: 400 });
  }
  const type = payload && typeof payload === 'object' && typeof (payload as { type?: unknown }).type === 'string'
    ? (payload as { type: string }).type
    : '';
  const status = resendEventStatus(type);
  if (!status) return NextResponse.json({ ok: true, ignored: true });
  const result = await recordMailWebhook(resendEmailId(payload), status);
  return NextResponse.json(result);
}

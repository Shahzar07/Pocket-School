import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';
import { invoiceFilename, invoicePdfBytes, type InvoiceFace } from '@/lib/documents/invoice-pdf';
import { invoiceLabel } from '@/lib/billing-model';
import { parseAddresses, recipientList, smtpConfigured, SMTP_MISSING } from '@/lib/documents/delivery';
import { formatMoney } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function smtpEnv() {
  return {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    port: Number(process.env.SMTP_PORT || 587),
    from: process.env.SMTP_FROM,
  };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!(await callerIsAdmin(user.uid, user.email))) {
    return NextResponse.json({ error: 'A super admin sends invoices.', code: 'FORBIDDEN' }, { status: 403 });
  }
  return NextResponse.json({ configured: smtpConfigured(smtpEnv()) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!(await callerIsAdmin(user.uid, user.email))) {
    return NextResponse.json({ error: 'A super admin sends invoices.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const env = smtpEnv();
  if (!smtpConfigured(env)) {
    return NextResponse.json({ error: SMTP_MISSING, code: 'SMTP_NOT_CONFIGURED' }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    invoiceIds?: string[];
    includeHolder?: boolean;
    to?: string;
    message?: string;
  };
  const ids = Array.isArray(body.invoiceIds) ? body.invoiceIds.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 20) : [];
  if (!ids.length) return NextResponse.json({ error: 'Choose at least one invoice.', code: 'INVALID' }, { status: 400 });
  const extra = parseAddresses(typeof body.to === 'string' ? body.to : '');
  if (!extra.ok) return NextResponse.json({ error: extra.error, code: 'INVALID' }, { status: 400 });
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  const includeHolder = body.includeHolder !== false;

  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465,
    auth: { user: env.user, pass: env.pass },
  });

  const sent: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const snap = await adminDb().doc(`transactions/${id}`).get();
    if (!snap.exists) {
      skipped.push({ id, reason: 'Invoice not found.' });
      continue;
    }
    const data = snap.data() ?? {};
    const userId = typeof data.userId === 'string' ? data.userId : '';
    let holderEmail = typeof data.email === 'string' ? data.email : '';
    let holderName = typeof data.buyerName === 'string' ? data.buyerName : '';
    if (userId) {
      const account = await adminDb().doc(`users/${userId}`).get();
      const profile = account.data() ?? {};
      if (!holderEmail && typeof profile.email === 'string') holderEmail = profile.email;
      if (!holderName && typeof profile.name === 'string') holderName = profile.name;
    }
    const recipients = recipientList([holderEmail], includeHolder, extra.emails);
    if (!recipients.length) {
      skipped.push({ id, reason: 'No address to send to.' });
      continue;
    }
    const face: InvoiceFace = {
      id,
      title: typeof data.title === 'string' ? data.title : undefined,
      invoiceId: typeof data.invoiceId === 'string' ? data.invoiceId : undefined,
      status: typeof data.status === 'string' ? data.status : undefined,
      totalLabel: formatMoney(Number(data.total ?? 0), typeof data.currency === 'string' ? data.currency : 'USD'),
      holderName,
      holderEmail,
    };
    const pdf = invoicePdfBytes(face);
    const label = invoiceLabel(face);
    await transport.sendMail({
      from: env.from || `Poket School <${env.user}>`,
      to: recipients.join(', '),
      subject: `Poket School invoice ${label}`,
      text: [`Poket School invoice ${label}`, message, 'The PDF is attached.'].filter(Boolean).join('\n\n'),
      attachments: [{ filename: invoiceFilename(face), content: Buffer.from(pdf), contentType: 'application/pdf' }],
    });
    await adminDb().collection('admin_audit').add({
      actorId: user.uid,
      actorEmail: user.email ?? '',
      action: 'invoice.email',
      targetId: id,
      at: Date.now(),
      before: {},
      after: { to: recipients, invoice: label, message },
    });
    sent.push(id);
  }
  return NextResponse.json({ sent, skipped });
}

import { NextRequest, NextResponse } from 'next/server';
import { brandedMailHtml, mailFromHeader } from '@/lib/academy-mail';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { institutionEmail } from '@/lib/institution-membership';

export const dynamic = 'force-dynamic';

const LOGIN_LINK = 'https://poketschool.ai/institutions/login';

/**
 * Super admin approval. The directory already sets status to active.
 * This confirms it and emails the registering admin.
 */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Approval email needs the server account.', emailed: false },
      { status: 503 },
    );
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;

  const body = await req.json().catch(() => ({})) as { institutionId?: unknown };
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });

  const ref = adminDb().doc(`institutions/${institutionId}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'That academy was not found.' }, { status: 404 });
  const data = snap.data() ?? {};
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Your academy';
  await ref.set({ status: 'active', reviewHold: false, reviewReasons: [] }, { merge: true });
  const { releaseHeldInstitution } = await import('@/lib/server/institution-activate');
  await releaseHeldInstitution(institutionId);

  let email = '';
  let personName = '';
  const adminId = typeof data.adminId === 'string' ? data.adminId : '';
  if (adminId) {
    const admin = await adminDb().doc(`users/${adminId}`).get();
    const profile = admin.data() ?? {};
    email = typeof profile.email === 'string' ? profile.email : '';
    personName = typeof profile.name === 'string' ? profile.name : '';
  }
  if (!email) {
    const members = await adminDb().collection(`institutions/${institutionId}/members`).limit(20).get();
    const admin = members.docs.find((row) => row.data().role === 'institution_admin');
    email = typeof admin?.data().email === 'string' ? admin.data().email : '';
    personName = personName || (typeof admin?.data().name === 'string' ? admin.data().name : '');
  }

  const mail = institutionEmail('academy_approved', {
    institutionName: name,
    personName,
    link: LOGIN_LINK,
  });
  if (!email || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return NextResponse.json({ emailed: false, subject: mail.subject, text: mail.text, status: 'active' });
  }

  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: mailFromHeader('Poket School'),
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: brandedMailHtml({ brand: null, heading: mail.subject, paragraphs: mail.text.split('\n') }),
  });
  return NextResponse.json({ emailed: true, subject: mail.subject, status: 'active' });
}

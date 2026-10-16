import { NextRequest, NextResponse } from 'next/server';
import { brandedMailHtml, mailBrandFromInstitution, mailFromHeader } from '@/lib/academy-mail';
import { callerIsAdmin, isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';
import { brandedInvite } from '@/lib/oem';
import { institutionOrigin } from '@/lib/white-label';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as { institutionId?: string; emails?: unknown; code?: string };
  const institutionId = body.institutionId?.trim() ?? '';
  const code = body.code?.trim().toUpperCase() ?? '';
  const emails = Array.isArray(body.emails)
    ? [...new Set(body.emails.filter((item): item is string => typeof item === 'string').map((item) => item.trim().toLowerCase()).filter((item) => EMAIL_RE.test(item)))]
    : [];
  if (!institutionId || code.length < 4 || emails.length === 0 || emails.length > 40) {
    return NextResponse.json({ error: 'Choose an academy, a join code, and up to 40 email addresses.' }, { status: 400 });
  }
  const profile = await loadUser(user.uid);
  const role = typeof profile?.role === 'string' ? profile.role : '';
  const ownAcademy = profile?.institutionId === institutionId && (role === 'institution_admin' || role === 'admin');
  if (!ownAcademy && !(await callerIsAdmin(user.uid, user.email))) {
    return NextResponse.json({ error: 'An academy admin sends these invites.' }, { status: 403 });
  }
  const snap = await adminDb().doc(`institutions/${institutionId}`).get();
  if (!snap.exists) return NextResponse.json({ error: 'That academy was not found.' }, { status: 404 });
  const data = snap.data() as Record<string, unknown>;
  const brand = mailBrandFromInstitution(data);
  const branding = data.branding && typeof data.branding === 'object' ? data.branding as { inviteSubject?: string; inviteBody?: string; emailFromName?: string; displayName?: string } : {};
  const subdomain = typeof data.subdomain === 'string' ? data.subdomain : '';
  const origin = subdomain ? institutionOrigin(subdomain) : (process.env.NEXT_PUBLIC_APP_URL || 'https://poketschool.ai');
  const message = brandedInvite({
    displayName: brand?.name || 'Poket School',
    emailFromName: brand?.fromName,
    logoUrl: brand?.logoUrl,
  }, code, origin, { subject: branding.inviteSubject, text: branding.inviteBody });
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return NextResponse.json({ emailed: false, subject: message.subject, text: message.text });
  }
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = mailFromHeader(brand?.fromName);
  await Promise.all(emails.map((to) => transport.sendMail({
    from,
    to,
    subject: message.subject,
    text: message.text,
    html: brandedMailHtml({ brand, heading: message.subject, paragraphs: message.text.split('\n') }),
  })));
  return NextResponse.json({ emailed: true, sent: emails.length, subject: message.subject });
}

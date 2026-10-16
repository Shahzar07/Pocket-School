import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';
import { isSuperAdminEmail } from '@/lib/roles';
import { documentPdf } from '@/lib/documents/packet';
import { deliveryAllowed, holderAddress, parseAddresses, recipientList, smtpConfigured, SMTP_MISSING, type Deliverable } from '@/lib/documents/delivery';

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

async function taughtStudents(teacherId: string, studentIds: string[]): Promise<string[]> {
  const courses = await adminDb().collection('courses').where('ownerId', '==', teacherId).limit(30).get();
  const taught: string[] = [];
  for (const studentId of studentIds) {
    for (const course of courses.docs) {
      const enrolled = await adminDb().doc(`courses/${course.id}/enrollments/${studentId}`).get();
      if (enrolled.exists) {
        taught.push(studentId);
        break;
      }
    }
  }
  return taught;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  return NextResponse.json({ configured: smtpConfigured(smtpEnv()) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const env = smtpEnv();
  if (!smtpConfigured(env)) {
    return NextResponse.json({ error: SMTP_MISSING, code: 'SMTP_NOT_CONFIGURED' }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    documents?: Deliverable[];
    includeHolder?: boolean;
    to?: string;
    message?: string;
    studentIds?: string[];
    institutionId?: string;
    csv?: { filename?: string; text?: string };
  };
  const documents = Array.isArray(body.documents) ? body.documents.slice(0, 20) : [];
  const csvText = body.csv && typeof body.csv.text === 'string' ? body.csv.text.slice(0, 200_000) : '';
  if ((!documents.length && !csvText) || documents.some((doc) => !doc || typeof doc.id !== 'string' || typeof doc.title !== 'string' || !Array.isArray(doc.lines))) {
    return NextResponse.json({ error: 'Choose a document to send.', code: 'INVALID' }, { status: 400 });
  }
  const extra = parseAddresses(typeof body.to === 'string' ? body.to : '');
  if (!extra.ok) return NextResponse.json({ error: extra.error, code: 'INVALID' }, { status: 400 });
  const profile = await loadUser(user.uid);
  const role = typeof profile?.role === 'string' ? profile.role : 'student';
  const childIds = Array.isArray(profile?.childIds) ? profile.childIds.filter((id): id is string => typeof id === 'string') : [];
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds.filter((id): id is string => typeof id === 'string').slice(0, 30) : [];
  const taught = role === 'teacher' ? await taughtStudents(user.uid, studentIds) : [];
  const allowed = deliveryAllowed({
    role: isSuperAdminEmail(user.email) ? 'admin' : role,
    actorId: user.uid,
    childIds,
    taughtStudentIds: taught,
    studentIds,
    actorInstitutionId: typeof profile?.institutionId === 'string' ? profile.institutionId : undefined,
    documentInstitutionId: typeof body.institutionId === 'string' ? body.institutionId : undefined,
  });
  if (!allowed.ok) return NextResponse.json({ error: allowed.error, code: 'FORBIDDEN' }, { status: 403 });

  const includeHolder = body.includeHolder !== false;
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  const lookup = new Map<string, string>();
  const privileged = isSuperAdminEmail(user.email) || role === 'admin' || role === 'institution_admin';
  if (includeHolder) {
    const needed = [...new Set(documents.flatMap((doc) => {
      if (typeof doc.holderEmail === 'string' && doc.holderEmail.includes('@')) return [];
      if (typeof doc.studentId !== 'string' || !doc.studentId) return [];
      if (!privileged && doc.studentId !== user.uid && !studentIds.includes(doc.studentId)) return [];
      return [doc.studentId];
    }))].slice(0, 20);
    for (const studentId of needed) {
      const snap = await adminDb().doc(`users/${studentId}`).get();
      const email = snap.get('email');
      if (typeof email === 'string') lookup.set(studentId, email);
    }
  }
  const recipients = recipientList(
    documents.map((doc) => holderAddress(doc, (studentId) => lookup.get(studentId))),
    includeHolder,
    extra.emails,
  );
  if (!recipients.length) return NextResponse.json({ error: 'Choose the account holder or type an address.', code: 'INVALID' }, { status: 400 });

  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465,
    auth: { user: env.user, pass: env.pass },
  });
  const year = new Date().getFullYear();
  const attachments: { filename: string; content: Buffer; contentType: string }[] = documents.map((doc) => ({
    filename: doc.filename?.endsWith('.pdf') ? doc.filename.replace(/[^\w.\-]+/g, '-').slice(0, 80) : `${doc.id.replace(/[^\w.\-]+/g, '-').slice(0, 40) || 'poket'}.pdf`,
    content: Buffer.from(documentPdf({ ...doc, lines: doc.lines.map((line) => String(line).slice(0, 500)).slice(0, 80) }, year)),
    contentType: 'application/pdf',
  }));
  if (csvText) {
    attachments.push({
      filename: typeof body.csv?.filename === 'string' && body.csv.filename.endsWith('.csv') ? body.csv.filename.replace(/[^\w.\-]+/g, '-').slice(0, 80) : 'poket.csv',
      content: Buffer.from(csvText),
      contentType: 'text/csv',
    });
  }
  await transport.sendMail({
    from: env.from || `Poket School <${env.user}>`,
    to: recipients.join(', '),
    subject: `Poket School · ${documents[0]?.title || 'Export'}`,
    text: ['Poket School', documents.map((doc) => doc.title).join(', '), message, 'The file is attached.'].filter(Boolean).join('\n\n'),
    attachments,
  });
  await adminDb().collection('admin_audit').add({
    actorId: user.uid,
    actorEmail: user.email ?? '',
    action: 'document.email',
    targetId: (documents.map((doc) => doc.id).join(',') || 'csv').slice(0, 200),
    at: Date.now(),
    before: {},
    after: { to: recipients, titles: documents.map((doc) => doc.title).slice(0, 20), message, studentIds },
  });
  return NextResponse.json({ sent: documents.map((doc) => doc.id) });
}

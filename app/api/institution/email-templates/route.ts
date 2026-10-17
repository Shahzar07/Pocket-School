import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { requestClient } from '@/lib/audit/model';
import { recordActivity } from '@/lib/audit/server';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import {
  EMAIL_TEMPLATE_KINDS,
  defaultEmailTemplate,
  isEmailTemplateKind,
  type InstitutionEmailTemplate,
} from '@/lib/institution-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function institutionIdFor(user: { uid: string; email?: string; role?: string; adminRole?: string }, requested: string): Promise<string | NextResponse> {
  const profile = await loadUser(user.uid);
  const role = typeof profile?.role === 'string' ? profile.role : '';
  const own = typeof profile?.institutionId === 'string' ? profile.institutionId : '';
  if (role === 'institution_admin') {
    if (!own || (requested && requested !== own)) {
      return NextResponse.json({ error: 'That institution is not yours.', code: 'FORBIDDEN' }, { status: 403 });
    }
    return own;
  }
  const platform = await callerIsAdmin(user.uid, user.email, { role: user.role, adminRole: user.adminRole });
  if (!platform) {
    return NextResponse.json({ error: 'Email templates belong to the institution.', code: 'FORBIDDEN' }, { status: 403 });
  }
  if (!requested) {
    return NextResponse.json({ error: 'Choose an institution.', code: 'INSTITUTION_REQUIRED' }, { status: 400 });
  }
  return requested;
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Email templates need the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const resolved = await institutionIdFor(user, req.nextUrl.searchParams.get('institutionId') ?? '');
  if (isNextResponse(resolved)) return resolved;
  const templates: InstitutionEmailTemplate[] = [];
  for (const kind of EMAIL_TEMPLATE_KINDS) {
    const snap = await adminDb().doc(`institutions/${resolved}/email_templates/${kind}`).get();
    const data = snap.data();
    if (data && typeof data.subject === 'string' && typeof data.body === 'string') {
      templates.push({ kind, subject: data.subject, body: data.body });
    } else {
      templates.push(defaultEmailTemplate(kind));
    }
  }
  return NextResponse.json({ institutionId: resolved, templates });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Email templates need the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const requested = typeof body.institutionId === 'string' ? body.institutionId : '';
  const resolved = await institutionIdFor(user, requested);
  if (isNextResponse(resolved)) return resolved;
  const kind = typeof body.kind === 'string' ? body.kind : '';
  if (!isEmailTemplateKind(kind)) {
    return NextResponse.json({ error: 'Choose otp, notification, invoice, or welcome.', code: 'BAD_KIND' }, { status: 400 });
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 180) : '';
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 8000) : '';
  if (!subject || !text) {
    return NextResponse.json({ error: 'A subject and a body are required.', code: 'EMPTY' }, { status: 400 });
  }
  const beforeSnap = await adminDb().doc(`institutions/${resolved}/email_templates/${kind}`).get();
  await adminDb().doc(`institutions/${resolved}/email_templates/${kind}`).set({
    kind,
    subject,
    body: text,
    updatedAt: Date.now(),
    updatedBy: user.uid,
  });
  const profile = await loadUser(user.uid);
  const client = requestClient(req.headers);
  await recordActivity({
    action: 'settings.edit',
    actorId: user.uid,
    actorEmail: user.email ?? '',
    actorRole: typeof profile?.role === 'string' ? profile.role : 'institution_admin',
    ip: client.ip,
    device: client.device,
    targetType: 'email_template',
    targetId: `${resolved}/${kind}`,
    targetLabel: kind,
    before: beforeSnap.data() ?? null,
    after: { kind, subject, body: text },
    institutionId: resolved,
  });
  return NextResponse.json({ ok: true, kind });
}

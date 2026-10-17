import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import {
  confirmVerification,
  createShareLink,
  deleteApplication,
  learnerJobDesk,
  revokeShareLink,
  saveApplication,
  tailorForLearner,
} from '@/lib/server/job-tracker-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) return NextResponse.json({ links: [], applications: [], reminders: [], requests: [], linkedInLinked: false });
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  return NextResponse.json(await learnerJobDesk(user.uid));
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'create-link') {
    const saved = await createShareLink(user.uid, body.label, body.days);
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json({ ...saved, url: `${req.nextUrl.origin}${saved.urlPath}` });
  }
  if (action === 'revoke-link') {
    const saved = await revokeShareLink(user.uid, typeof body.token === 'string' ? body.token : '');
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'save-application') {
    const saved = await saveApplication(user.uid, {
      id: body.id,
      company: body.company,
      role: body.role,
      link: body.link,
      status: body.status,
      date: body.date,
      shareToken: body.shareToken,
      reminderOn: body.reminderOn,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json({ application: saved });
  }
  if (action === 'delete-application') {
    const saved = await deleteApplication(user.uid, typeof body.id === 'string' ? body.id : '');
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'tailor') {
    return NextResponse.json(await tailorForLearner(user.uid, body.jobText));
  }
  if (action === 'confirm-verification') {
    const saved = await confirmVerification({
      requestId: typeof body.requestId === 'string' ? body.requestId : '',
      actorId: user.uid,
      by: 'learner',
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 403 });
    return NextResponse.json(saved);
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}

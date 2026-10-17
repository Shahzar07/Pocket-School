import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { listHelpArticles } from '@/lib/help-articles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Help articles need the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!(await callerIsAdmin(user.uid, user.email, user))) {
    return NextResponse.json({ error: 'Help articles are edited by an admin.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const articles = await listHelpArticles(false);
  return NextResponse.json({ articles });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Help articles need the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  if (!(await callerIsAdmin(user.uid, user.email, user))) {
    return NextResponse.json({ error: 'Help articles are edited by an admin.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id.trim().toLowerCase() : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : '';
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 8000) : '';
  const published = body.published !== false;
  if (!ID_RE.test(id) || id.length > 64) {
    return NextResponse.json({ error: 'Use a short id such as sign-in or sparks.', code: 'BAD_ID' }, { status: 400 });
  }
  if (!title || !text) {
    return NextResponse.json({ error: 'A title and a body are required.', code: 'EMPTY' }, { status: 400 });
  }
  await adminDb().collection('help_articles').doc(id).set({
    title,
    body: text,
    published,
    updatedAt: Date.now(),
    updatedBy: user.uid,
  });
  return NextResponse.json({ ok: true, id });
}

import { NextRequest, NextResponse } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { isAdminConfigured } from '@/lib/firebase-admin';
import {
  alertStats, closeAlert, confirmAlert, createAlert, readPublicAlert, recordShare, resolveAlert, updateAlert,
} from '@/lib/server/emergency';
import { publicView } from '@/lib/emergency/policy';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'share') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = str(body.id);
    if (id === 'sample') return NextResponse.json({ ok: true });
    if (!isAdminConfigured()) return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });
    return NextResponse.json(await recordShare(id));
  }
  return runPost(req, async (user, body) => {
    if (action === 'create') return createAlert(user.uid, body);
    if (action === 'confirm') return confirmAlert(user.uid, str(body.alertId));
    if (action === 'update') return updateAlert(user.uid, str(body.alertId), body);
    if (action === 'resolve') return resolveAlert(user.uid, str(body.alertId), body);
    if (action === 'close') return closeAlert(user.uid, str(body.alertId));
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'public') {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (id === 'sample') return NextResponse.json(publicView(SAMPLE_ALERT));
    if (!isAdminConfigured()) return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    const view = await readPublicAlert(id);
    if (!view) return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    return NextResponse.json(view);
  }
  return runGet(req, async (user) => {
    if (action === 'stats') return alertStats(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

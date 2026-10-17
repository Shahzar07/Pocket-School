import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { captchaSatisfied } from '@/lib/emergency/protections';
import {
  alertStats, attachAlert, closeAlert, confirmAlert, createAlert, flagFalseReport, listAlertReports,
  publicAlertFile, readPublicAlert, recordConsent, recordShare, reportAlert, resolveAlert, retractAlert,
  reviewAlert, setAlertAuthorities, updateAlert, viewAlertFile, withdrawConsent,
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
  if (action === 'report') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (str(body.alertId) === 'sample') return NextResponse.json({ ok: true });
    if (!isAdminConfigured()) return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });
    let reporterUid = '';
    if (req.headers.get('authorization')) {
      const user = await requireUser(req);
      if (isNextResponse(user)) return user;
      reporterUid = user.uid;
    }
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
    try {
      return NextResponse.json(await reportAlert({
        alertId: str(body.alertId),
        reporterUid,
        reason: str(body.reason),
        ip,
        captchaOk: await captchaSatisfied(str(body.captchaToken)),
      }));
    } catch (error) {
      if (error instanceof ActionError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
      }
      throw error;
    }
  }
  return runPost(req, async (user, body) => {
    if (action === 'create') return createAlert(user.uid, body);
    if (action === 'confirm') return confirmAlert(user.uid, str(body.alertId));
    if (action === 'update') return updateAlert(user.uid, str(body.alertId), body);
    if (action === 'resolve') return resolveAlert(user.uid, str(body.alertId), body);
    if (action === 'close') return closeAlert(user.uid, str(body.alertId));
    if (action === 'authorities') return setAlertAuthorities(user.uid, str(body.alertId), body);
    if (action === 'review') return reviewAlert(user.uid, str(body.alertId));
    if (action === 'retract') return retractAlert(user.uid, str(body.alertId), body);
    if (action === 'attach') return attachAlert(user.uid, str(body.alertId), body);
    if (action === 'consent') {
      return recordConsent(user.uid, str(body.alertId), body, {
        ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown',
        device: req.headers.get('user-agent') ?? 'unknown',
      });
    }
    if (action === 'withdraw-consent') return withdrawConsent(user.uid, str(body.alertId));
    if (action === 'report-false') return flagFalseReport(user.uid, str(body.reportId));
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
  if (action === 'public-file') {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    const attachmentId = req.nextUrl.searchParams.get('attachmentId') ?? '';
    if (!isAdminConfigured()) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    const signed = await publicAlertFile(id, attachmentId);
    if (!signed) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    return NextResponse.redirect(signed.url);
  }
  return runGet(req, async (user) => {
    if (action === 'stats') return alertStats(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'reports') return listAlertReports(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'file') {
      return viewAlertFile(user.uid, req.nextUrl.searchParams.get('alertId') ?? '', req.nextUrl.searchParams.get('attachmentId') ?? '');
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

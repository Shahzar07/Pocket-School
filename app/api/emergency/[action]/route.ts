import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { captchaSatisfied } from '@/lib/emergency/protections';
import { isShareChannel, shareLocation } from '@/lib/ledger/chain';
import { deviceFromHeaders } from '@/lib/ledger/device';
import {
  alertStats, attachAlert, closeAlert, confirmAlert, createAlert, exportAlertLog, flagFalseReport,
  listAlertReports, publicAlertFile, readPublicAlert, recordConsent, recordShare, redactAlertInternal,
  reportAlert, resolveAlert, retractAlert, reviewAlert, setAlertAuthorities, setAlertLegalHold,
  updateAlert, verifyAlert, viewAlertFile, withdrawConsent,
} from '@/lib/server/emergency';
import { publicView } from '@/lib/emergency/policy';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stamp(req: NextRequest, body: Record<string, unknown>) {
  return { ...body, device: deviceFromHeaders(req.headers) };
}

function failure(error: unknown) {
  if (error instanceof ActionError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
}

async function shareRedirect(req: NextRequest, id: string, channel: string) {
  if (!isShareChannel(channel)) {
    return NextResponse.json({ error: 'Choose a share channel.' }, { status: 400 });
  }
  const target = shareLocation(req.nextUrl.origin, id, channel);
  if (id === 'sample') return NextResponse.redirect(target);
  if (!isAdminConfigured()) return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });
  let actorUid = '';
  if (req.headers.get('authorization')) {
    const user = await requireUser(req);
    if (!isNextResponse(user)) actorUid = user.uid;
  }
  try {
    await recordShare(id, channel, actorUid, deviceFromHeaders(req.headers));
    return NextResponse.redirect(target);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'share') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = str(body.id);
    const channel = str(body.channel);
    if (!isShareChannel(channel)) {
      return NextResponse.json({ error: 'Choose a share channel.' }, { status: 400 });
    }
    if (id === 'sample') return NextResponse.json({ ok: true, channel });
    if (!isAdminConfigured()) return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });
    let actorUid = '';
    if (req.headers.get('authorization')) {
      const user = await requireUser(req);
      if (!isNextResponse(user)) actorUid = user.uid;
    }
    try {
      return NextResponse.json(await recordShare(id, channel, actorUid, deviceFromHeaders(req.headers)));
    } catch (error) {
      return failure(error);
    }
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
    const input = stamp(req, body);
    const device = deviceFromHeaders(req.headers);
    if (action === 'create') return createAlert(user.uid, input);
    if (action === 'confirm') return confirmAlert(user.uid, str(body.alertId), device);
    if (action === 'update') return updateAlert(user.uid, str(body.alertId), input);
    if (action === 'resolve') return resolveAlert(user.uid, str(body.alertId), input);
    if (action === 'close') return closeAlert(user.uid, str(body.alertId), device);
    if (action === 'authorities') return setAlertAuthorities(user.uid, str(body.alertId), input);
    if (action === 'review') return reviewAlert(user.uid, str(body.alertId), device);
    if (action === 'retract') return retractAlert(user.uid, str(body.alertId), input);
    if (action === 'attach') return attachAlert(user.uid, str(body.alertId), input);
    if (action === 'consent') {
      return recordConsent(user.uid, str(body.alertId), input, {
        ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown',
        device: req.headers.get('user-agent') ?? 'unknown',
      });
    }
    if (action === 'withdraw-consent') return withdrawConsent(user.uid, str(body.alertId), device);
    if (action === 'legal-hold') return setAlertLegalHold(user.uid, str(body.alertId), input);
    if (action === 'redact-internal') return redactAlertInternal(user.uid, str(body.alertId), input);
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
  if (action === 'share') {
    return shareRedirect(req, req.nextUrl.searchParams.get('id') ?? '', req.nextUrl.searchParams.get('channel') ?? '');
  }
  if (action === 'public-file') {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    const attachmentId = req.nextUrl.searchParams.get('attachmentId') ?? '';
    if (!isAdminConfigured()) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    const signed = await publicAlertFile(id, attachmentId);
    if (!signed) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    return NextResponse.redirect(signed.url);
  }
  if (action === 'export') {
    const user = await requireUser(req);
    if (isNextResponse(user)) return user;
    try {
      const file = await exportAlertLog(
        user.uid,
        req.nextUrl.searchParams.get('id') ?? '',
        req.nextUrl.searchParams.get('format') ?? 'csv',
        deviceFromHeaders(req.headers),
      );
      return new NextResponse(Buffer.from(file.body), {
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      return failure(error);
    }
  }
  return runGet(req, async (user) => {
    const device = deviceFromHeaders(req.headers);
    if (action === 'stats') return alertStats(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'reports') return listAlertReports(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'verify') return verifyAlert(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'file') {
      return viewAlertFile(
        user.uid,
        req.nextUrl.searchParams.get('alertId') ?? '',
        req.nextUrl.searchParams.get('attachmentId') ?? '',
        device,
      );
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

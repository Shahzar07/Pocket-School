import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { deviceFromHeaders } from '@/lib/ledger/device';
import { renotifyAlert } from '@/lib/server/emergency';
import { notifyTicketStaff } from '@/lib/server/staff-notify';
import {
  acknowledgeDanger,
  fileSafetyReport,
  listSafetyTracker,
  markDangerFalse,
  raiseDanger,
  readHelplines,
  recordFamilyDecision,
  safetyNotice,
  writeHelplines,
} from '@/lib/server/safety';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stamp(req: NextRequest, body: Record<string, unknown>) {
  return { ...body, device: deviceFromHeaders(req.headers) };
}

function bearerMatches(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function caseId(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'notify') {
    const secret = process.env.SAFETY_NOTIFY_SECRET ?? '';
    const header = req.headers.get('authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!bearerMatches(secret, provided)) {
      return NextResponse.json({ error: 'Unauthorized.', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ticketId = caseId(body.ticketId);
    const alertId = caseId(body.alertId);
    if ((ticketId && alertId) || (!ticketId && !alertId)) {
      return NextResponse.json({ error: 'Send a ticket id or an alert id.', code: 'BAD_REQUEST' }, { status: 400 });
    }
    try {
      const data = ticketId ? await notifyTicketStaff(ticketId) : await renotifyAlert(alertId);
      return NextResponse.json(data);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
    }
  }
  if (action === 'report' || action === 'danger') {
    const user = await requireUser(req, { enforceRateLimit: false });
    if (isNextResponse(user)) return user;
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const input = stamp(req, body);
      const data = action === 'report' ? await fileSafetyReport(user.uid, input) : await raiseDanger(user.uid, input);
      return NextResponse.json(data);
    } catch (error) {
      if (error instanceof ActionError) {
        const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
        return NextResponse.json({ error: error.message, code: error.code }, { status });
      }
      console.error(error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
    }
  }
  return runPost(req, async (user, body) => {
    const input = stamp(req, body);
    const device = deviceFromHeaders(req.headers);
    if (action === 'ack') return acknowledgeDanger(user.uid, str(body.id), device);
    if (action === 'family') return recordFamilyDecision(user.uid, str(body.id), input);
    if (action === 'false-danger') return markDangerFalse(user.uid, str(body.id), device);
    if (action === 'helplines') return writeHelplines(user.uid, input);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'tracker') return listSafetyTracker(user.uid);
    if (action === 'helplines') return readHelplines(user.uid);
    if (action === 'notice') return safetyNotice(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

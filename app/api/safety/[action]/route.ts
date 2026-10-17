import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { deviceFromHeaders } from '@/lib/ledger/device';
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
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

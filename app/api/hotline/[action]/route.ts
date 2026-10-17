import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { shareRefusal } from '@/lib/ledger/chain';
import { deviceFromHeaders } from '@/lib/ledger/device';
import {
  assignTicket, attachTicket, commentTicket, createTicket, exportTicketLog, getTicket, hotlineAnalytics,
  listTickets, rateTicket, redactTicketInternal, reopenTicket, setTicketAuthorities, setTicketLegalHold,
  setTicketStatus, verifyTicket, viewTicketFile,
} from '@/lib/server/hotline';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stamp(req: NextRequest, body: Record<string, unknown>) {
  return { ...body, device: deviceFromHeaders(req.headers) };
}

function refusedShare() {
  return NextResponse.json({ error: shareRefusal('hotline', '', false) }, { status: 403 });
}

function failure(error: unknown) {
  if (error instanceof ActionError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'share') return refusedShare();
  return runPost(req, async (user, body) => {
    const input = stamp(req, body);
    const device = deviceFromHeaders(req.headers);
    if (action === 'create') return createTicket(user.uid, input);
    if (action === 'comment') return commentTicket(user.uid, str(body.ticketId), input);
    if (action === 'assign') return assignTicket(user.uid, str(body.ticketId), str(body.assigneeUid), device);
    if (action === 'status') return setTicketStatus(user.uid, str(body.ticketId), input);
    if (action === 'reopen') return reopenTicket(user.uid, str(body.ticketId), device);
    if (action === 'rate') return rateTicket(user.uid, str(body.ticketId), input);
    if (action === 'attach') return attachTicket(user.uid, str(body.ticketId), input);
    if (action === 'authorities') return setTicketAuthorities(user.uid, str(body.ticketId), input);
    if (action === 'legal-hold') return setTicketLegalHold(user.uid, str(body.ticketId), input);
    if (action === 'redact-internal') return redactTicketInternal(user.uid, str(body.ticketId), input);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'share') return refusedShare();
  if (action === 'export') {
    const user = await requireUser(req);
    if (isNextResponse(user)) return user;
    try {
      const file = await exportTicketLog(
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
    if (action === 'list') return listTickets(user.uid, req.nextUrl.searchParams.get('status') ?? '');
    if (action === 'get') return getTicket(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'analytics') return hotlineAnalytics(user.uid);
    if (action === 'verify') return verifyTicket(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'file') {
      return viewTicketFile(
        user.uid,
        req.nextUrl.searchParams.get('ticketId') ?? '',
        req.nextUrl.searchParams.get('attachmentId') ?? '',
        device,
      );
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

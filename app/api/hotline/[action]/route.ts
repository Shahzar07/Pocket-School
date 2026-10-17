import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import {
  assignTicket, attachTicket, commentTicket, createTicket, getTicket, hotlineAnalytics,
  listTickets, rateTicket, reopenTicket, setTicketAuthorities, setTicketStatus, viewTicketFile,
} from '@/lib/server/hotline';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'create') return createTicket(user.uid, body);
    if (action === 'comment') return commentTicket(user.uid, str(body.ticketId), body);
    if (action === 'assign') return assignTicket(user.uid, str(body.ticketId), str(body.assigneeUid));
    if (action === 'status') return setTicketStatus(user.uid, str(body.ticketId), body);
    if (action === 'reopen') return reopenTicket(user.uid, str(body.ticketId));
    if (action === 'rate') return rateTicket(user.uid, str(body.ticketId), body);
    if (action === 'attach') return attachTicket(user.uid, str(body.ticketId), body);
    if (action === 'authorities') return setTicketAuthorities(user.uid, str(body.ticketId), body);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'list') return listTickets(user.uid, req.nextUrl.searchParams.get('status') ?? '');
    if (action === 'get') return getTicket(user.uid, req.nextUrl.searchParams.get('id') ?? '');
    if (action === 'analytics') return hotlineAnalytics(user.uid);
    if (action === 'file') {
      return viewTicketFile(user.uid, req.nextUrl.searchParams.get('ticketId') ?? '', req.nextUrl.searchParams.get('attachmentId') ?? '');
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

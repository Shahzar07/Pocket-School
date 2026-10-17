import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { deviceFromHeaders } from '@/lib/ledger/device';
import { ActionError } from '@/lib/server/actions';
import {
  blockPerson,
  bullyingGuide,
  deskRestrictComments,
  evidencePdf,
  listEvidence,
  mutePerson,
  readSchoolReferral,
  restrictPerson,
  sendSchoolReferral,
  storeEvidence,
  supportChat,
} from '@/lib/server/bullying';
import { runGet, runPost } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function caseId(value: string | null): string {
  return value && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    const input = { ...body, device: deviceFromHeaders(req.headers) };
    if (action === 'evidence') return storeEvidence(user.uid, input);
    if (action === 'restrict') return restrictPerson(user.uid, str(body.targetId));
    if (action === 'mute') return mutePerson(user.uid, str(body.targetId));
    if (action === 'block') return blockPerson(user.uid, str(body.targetId));
    if (action === 'desk-restrict') return deskRestrictComments(user.uid, str(body.targetId), body.on !== false);
    if (action === 'referral') return sendSchoolReferral(user.uid, input);
    if (action === 'support') return supportChat(user.uid, input);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'evidence-pdf') {
    const user = await requireUser(req);
    if (isNextResponse(user)) return user;
    const id = caseId(req.nextUrl.searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Choose an evidence record.', code: 'BAD_REQUEST' }, { status: 400 });
    try {
      const bytes = await evidencePdf(user.uid, id);
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="poket-evidence.pdf"',
        },
      });
    } catch (error) {
      if (error instanceof ActionError) {
        const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400;
        return NextResponse.json({ error: error.message, code: error.code }, { status });
      }
      console.error(error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
    }
  }
  return runGet(req, async (user) => {
    if (action === 'guide') return bullyingGuide(user.uid);
    if (action === 'evidence') return listEvidence(user.uid, req.nextUrl.searchParams.get('ownerId') ?? '');
    if (action === 'referral') {
      const id = caseId(req.nextUrl.searchParams.get('id'));
      if (!id) throw new ActionError('BAD_REQUEST', 'Choose a referral.');
      return readSchoolReferral(user.uid, id);
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

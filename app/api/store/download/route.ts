import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { signProductDownload } from '@/lib/store/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    const body = await req.json() as { sku?: unknown; file?: unknown };
    const file = body.file === 'markscheme' ? 'markscheme' : body.file === 'paper' ? 'paper' : '';
    if (!file || typeof body.sku !== 'string' || !body.sku) {
      throw new ActionError('BAD_REQUEST', 'Choose a paper or a mark scheme.');
    }
    return NextResponse.json(await signProductDownload(user, body.sku, file));
  } catch (error) {
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' ? 403
        : error.code === 'NOT_FOUND' ? 404
          : error.code === 'SETUP_NEEDED' ? 503
            : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}

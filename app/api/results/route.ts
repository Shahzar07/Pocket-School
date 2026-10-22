import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { removeResult, resultsDesk, saveResult, setResultShare, verifyResult } from '@/lib/results/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function failed(error: unknown) {
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

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    const studentId = req.nextUrl.searchParams.get('student') ?? '';
    return NextResponse.json(await resultsDesk(user, studentId));
  } catch (error) {
    return failed(error);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    if (action === 'save') {
      return NextResponse.json(await saveResult(user, {
        id: typeof body.id === 'string' ? body.id : undefined,
        level: typeof body.level === 'string' ? body.level : undefined,
        subject: typeof body.subject === 'string' ? body.subject : undefined,
        board: typeof body.board === 'string' ? body.board : undefined,
        grade: typeof body.grade === 'string' ? body.grade : undefined,
        session: typeof body.session === 'string' ? body.session : undefined,
        status: body.status,
        fileBase64: typeof body.fileBase64 === 'string' ? body.fileBase64 : undefined,
        fileName: typeof body.fileName === 'string' ? body.fileName : undefined,
        mime: typeof body.mime === 'string' ? body.mime : undefined,
      }));
    }
    if (action === 'remove') {
      const id = typeof body.id === 'string' ? body.id : '';
      return NextResponse.json(await removeResult(user, id));
    }
    if (action === 'verify') {
      const id = typeof body.id === 'string' ? body.id : '';
      return NextResponse.json(await verifyResult(user, id));
    }
    if (action === 'share') {
      return NextResponse.json(await setResultShare(user, body.enabled === true));
    }
    return NextResponse.json({ ok: false, error: 'Choose an action.', code: 'BAD_REQUEST' }, { status: 400 });
  } catch (error) {
    return failed(error);
  }
}

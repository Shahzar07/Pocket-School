import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { dryRunManifest, readImportJob, saveProductForm, startImportJob } from '@/lib/store/server';

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
    return NextResponse.json(await readImportJob(user, req.nextUrl.searchParams.get('jobId') ?? ''));
  } catch (error) {
    return failed(error);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await req.json() as { phase?: unknown; csv?: unknown; files?: unknown };
      if (body.phase === 'dry-run') return NextResponse.json(await dryRunManifest(user, typeof body.csv === 'string' ? body.csv : '', body.files));
      if (body.phase === 'start') return NextResponse.json(await startImportJob(user));
      throw new ActionError('BAD_REQUEST', 'Unknown import phase.');
    }
    const form = await req.formData();
    if (form.get('phase') !== 'row') throw new ActionError('BAD_REQUEST', 'Unknown import phase.');
    const result = await saveProductForm(user, form, typeof form.get('jobId') === 'string' ? String(form.get('jobId')) : '');
    return NextResponse.json({ ok: result.errors.length === 0 && result.productId.length > 0, ...result });
  } catch (error) {
    return failed(error);
  }
}

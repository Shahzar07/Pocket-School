import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import {
  applyFunnelTemplate,
  createFunnel,
  duplicateFunnel,
  listFunnels,
  publishFunnel,
  readFunnelDesk,
  saveFunnel,
  unpublishFunnel,
} from '@/lib/funnels/server';
import { isFunnelTemplate } from '@/lib/funnels/model';

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
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (id) return NextResponse.json(await readFunnelDesk(user, id));
    return NextResponse.json(await listFunnels(user));
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
    const id = typeof body.id === 'string' ? body.id : '';
    if (action === 'create') {
      const template = typeof body.template === 'string' && isFunnelTemplate(body.template) ? body.template : null;
      if (!template) throw new ActionError('BAD_REQUEST', 'Unknown template.');
      return NextResponse.json(await createFunnel(user, template));
    }
    if (!id) throw new ActionError('BAD_REQUEST', 'Landing page not found.');
    if (action === 'save') {
      return NextResponse.json(await saveFunnel(user, {
        id,
        title: typeof body.title === 'string' ? body.title : '',
        slug: typeof body.slug === 'string' ? body.slug : '',
        sections: body.sections,
      }));
    }
    if (action === 'apply-template') {
      const template = typeof body.template === 'string' && isFunnelTemplate(body.template) ? body.template : null;
      if (!template) throw new ActionError('BAD_REQUEST', 'Unknown template.');
      return NextResponse.json(await applyFunnelTemplate(user, id, template));
    }
    if (action === 'duplicate') return NextResponse.json(await duplicateFunnel(user, id));
    if (action === 'publish') return NextResponse.json(await publishFunnel(user, id, typeof body.slug === 'string' ? body.slug : ''));
    if (action === 'unpublish') return NextResponse.json(await unpublishFunnel(user, id));
    throw new ActionError('BAD_REQUEST', 'Unknown action.');
  } catch (error) {
    return failed(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { listStoreProducts, publishStoreProduct, saveProductForm } from '@/lib/store/server';

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
    return NextResponse.json(await listStoreProducts(user));
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
      const body = await req.json() as { action?: unknown; sku?: unknown };
      if (body.action !== 'publish') throw new ActionError('BAD_REQUEST', 'Unknown product action.');
      const published = await publishStoreProduct(user, typeof body.sku === 'string' ? body.sku : '');
      return NextResponse.json({ ok: true, ...published });
    }
    const form = await req.formData();
    const result = await saveProductForm(user, form);
    const ok = result.errors.length === 0 && result.productId.length > 0;
    return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 400 });
  } catch (error) {
    return failed(error);
  }
}

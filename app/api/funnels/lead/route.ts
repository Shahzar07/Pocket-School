import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { FUNNEL_COPY } from '@/lib/funnels/copy';
import { submitFunnelLead } from '@/lib/funnels/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function failed(error: unknown) {
  if (error instanceof ActionError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'SETUP_NEEDED' ? 503 : 400;
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status });
  }
  console.error(error);
  return NextResponse.json({ ok: false, error: FUNNEL_COPY.leadFailed, code: 'INTERNAL' }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0]?.trim() || 'local';
  if (!rateLimit(`funnel-lead:${ip}`, 8, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  try {
    const body = await req.json() as { slug?: unknown; name?: unknown; email?: unknown; note?: unknown };
    const result = await submitFunnelLead({
      slug: typeof body.slug === 'string' ? body.slug : '',
      name: typeof body.name === 'string' ? body.name : '',
      email: typeof body.email === 'string' ? body.email : '',
      note: typeof body.note === 'string' ? body.note : '',
    });
    return NextResponse.json(result);
  } catch (error) {
    return failed(error);
  }
}

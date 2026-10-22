import { NextRequest, NextResponse } from 'next/server';
import { publicFunnel } from '@/lib/funnels/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Published pages only. A draft slug does not include its sections. */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await publicFunnel(req.nextUrl.searchParams.get('slug') ?? ''));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ state: 'none' });
  }
}

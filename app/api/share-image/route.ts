import { NextRequest, NextResponse } from 'next/server';
import { shareCardPng } from '@/lib/server/share-card';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') ?? 'portfolio';
  const png = await shareCardPng(kind);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

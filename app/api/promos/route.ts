import { NextResponse } from 'next/server';
import { activePromoBanners } from '@/lib/payments/server/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const promos = await activePromoBanners();
    return NextResponse.json({ promos });
  } catch {
    return NextResponse.json({ promos: [] });
  }
}

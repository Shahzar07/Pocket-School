import { NextResponse } from 'next/server';
import { productAccess, type AllocatableProduct, type AllocationViewer } from '@/lib/allocation';

/**
 * The same audience decision the CMS preview uses.
 * Firestore rules enforce the read. This route exists so a server caller
 * cannot drift from that decision.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { product?: AllocatableProduct; viewer?: AllocationViewer } | null;
  if (!body?.product?.id || !body.viewer?.role) {
    return NextResponse.json({ error: 'A product and a viewer are required.' }, { status: 400 });
  }
  return NextResponse.json(productAccess(body.product, body.viewer));
}

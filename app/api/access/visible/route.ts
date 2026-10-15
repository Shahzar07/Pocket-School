import { NextResponse } from 'next/server';
import { productAccess, type AllocatableProduct, type AllocationViewer } from '@/lib/allocation';
import { lessonWindow } from '@/lib/access-policy';

/**
 * The same audience decision the CMS preview uses.
 * Firestore rules enforce the read. This route exists so a server caller
 * cannot drift from that decision. Pass lessonIndex to also receive the
 * drip and preview decision for that lesson.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    product?: AllocatableProduct;
    viewer?: AllocationViewer;
    lessonIndex?: number;
    unitIndex?: number;
  } | null;
  if (!body?.product?.id || !body.viewer?.role) {
    return NextResponse.json({ error: 'A product and a viewer are required.' }, { status: 400 });
  }
  const decision = productAccess(body.product, body.viewer);
  if (typeof body.lessonIndex !== 'number') return NextResponse.json(decision);
  return NextResponse.json({
    ...decision,
    lesson: lessonWindow(body.product.accessPolicy, body.viewer, body.lessonIndex, body.unitIndex ?? 0),
  });
}

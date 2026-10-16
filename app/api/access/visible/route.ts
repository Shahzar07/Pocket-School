import { NextRequest, NextResponse } from 'next/server';
import { roleForServerCheck } from '@/lib/admin-access';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { productAccess, type AllocatableProduct, type AllocationViewer, type ViewerRole } from '@/lib/allocation';
import { lessonWindow } from '@/lib/access-policy';

const VIEWER_ROLES: readonly ViewerRole[] = ['student', 'teacher', 'parent', 'institution_admin', 'admin'];

function viewerRole(value: string): ViewerRole {
  return (VIEWER_ROLES as readonly string[]).includes(value) ? value as ViewerRole : 'student';
}

/**
 * The same audience decision the CMS preview uses.
 * Firestore rules enforce the read. This route exists so a server caller
 * cannot drift from that decision. Pass lessonIndex to also receive the
 * drip and preview decision for that lesson.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (isNextResponse(user)) return user;
  const body = await request.json().catch(() => null) as {
    product?: AllocatableProduct;
    viewer?: Omit<AllocationViewer, 'role'> & { role?: string };
    lessonIndex?: number;
    unitIndex?: number;
  } | null;
  if (!body?.product?.id) {
    return NextResponse.json({ error: 'A product is required.' }, { status: 400 });
  }
  const profile = await loadUser(user.uid);
  const profileRole = typeof profile?.role === 'string' ? profile.role : '';
  const posted = body.viewer ?? {};
  const viewer: AllocationViewer = {
    ...posted,
    role: viewerRole(roleForServerCheck(user, profileRole)),
    userId: user.uid,
  };
  const decision = productAccess(body.product, viewer);
  if (typeof body.lessonIndex !== 'number') return NextResponse.json(decision);
  return NextResponse.json({
    ...decision,
    lesson: lessonWindow(body.product.accessPolicy, viewer, body.lessonIndex, body.unitIndex ?? 0),
  });
}

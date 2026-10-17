import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requirePlatformAdmin } from '@/lib/api-guard';
import { resolveStaffRole } from '@/lib/admin-console';
import { ActionError } from '@/lib/server/actions';
import {
  listSchoolLeads,
  mergeSchoolLeads,
  setSchoolLandingApproval,
  setSchoolStripMinimum,
} from '@/lib/server/school-leads';

export const dynamic = 'force-dynamic';

function statusFor(code: string): number {
  if (code === 'FORBIDDEN') return 403;
  if (code === 'NOT_FOUND') return 404;
  return 400;
}

async function superAdmin(req: NextRequest) {
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const profile = await loadUser(user.uid);
  const staff = resolveStaffRole({
    email: user.email,
    role: typeof profile?.role === 'string' ? profile.role : user.role,
    adminRole: typeof profile?.adminRole === 'string' ? profile.adminRole : user.adminRole,
  });
  if (staff !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin access required.', code: 'FORBIDDEN' }, { status: 403 });
  }
  return user;
}

export async function GET(req: NextRequest) {
  const user = await superAdmin(req);
  if (isNextResponse(user)) return user;
  const data = await listSchoolLeads();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await superAdmin(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  try {
    if (action === 'minimum') {
      const minimum = await setSchoolStripMinimum(body.minimum);
      return NextResponse.json({ minimum });
    }
    if (action === 'approve') {
      await setSchoolLandingApproval(typeof body.key === 'string' ? body.key : '', body.approved === true);
      return NextResponse.json({ ok: true });
    }
    if (action === 'merge') {
      const lead = await mergeSchoolLeads(
        typeof body.keep === 'string' ? body.keep : '',
        typeof body.drop === 'string' ? body.drop : '',
      );
      return NextResponse.json({ lead });
    }
    return NextResponse.json({ error: 'Unknown action.', code: 'VALIDATION' }, { status: 400 });
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error.code) });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}

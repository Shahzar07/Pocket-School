import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { resolveStaffRole } from '@/lib/admin-console';
import { readInsights } from '@/lib/server/insight-counters';
import { dayKey } from '@/lib/insights/census';

export const dynamic = 'force-dynamic';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function viewer(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const profile = await loadUser(user.uid);
  const staff = resolveStaffRole({
    email: user.email,
    role: typeof profile?.role === 'string' ? profile.role : user.role,
    adminRole: typeof profile?.adminRole === 'string' ? profile.adminRole : user.adminRole,
  });
  const institutionId = text(profile?.institutionId);
  const superAdmin = staff === 'super_admin';
  const academyAdmin = profile?.role === 'institution_admin' && !!institutionId;
  if (!superAdmin && !academyAdmin) {
    return NextResponse.json({ error: 'Insights are for a super admin or an institution admin.', code: 'FORBIDDEN' }, { status: 403 });
  }
  return { user, superAdmin, institutionId };
}

export async function GET(req: NextRequest) {
  const gate = await viewer(req);
  if (gate instanceof NextResponse) return gate;
  const url = new URL(req.url);
  const requested = text(url.searchParams.get('institutionId'));
  const scope = gate.superAdmin ? (requested || 'platform') : gate.institutionId;
  if (!gate.superAdmin && requested && requested !== gate.institutionId) {
    return NextResponse.json({ error: 'That institution is outside your academy.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const today = dayKey(new Date());
  const from = text(url.searchParams.get('from')) || today.slice(0, 8) + '01';
  const to = text(url.searchParams.get('to')) || today;
  const view = await readInsights({
    scope,
    country: text(url.searchParams.get('country')).toUpperCase(),
    state: text(url.searchParams.get('state')),
    gender: text(url.searchParams.get('gender')),
    level: text(url.searchParams.get('level')),
    from,
    to,
    today,
    includeLeads: gate.superAdmin && scope === 'platform',
  });
  return NextResponse.json(view);
}

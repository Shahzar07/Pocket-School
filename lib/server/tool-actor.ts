import { resolveStaffRole } from '@/lib/admin-console';
import { loadUser, type AuthedUser } from '@/lib/api-guard';
import { isPartnerMerchant } from '@/lib/student-id/model';
import type { BannerActor } from '@/lib/safety/banner';

export interface ToolActor extends BannerActor {
  email: string;
  partner: boolean;
  platform: boolean;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function loadToolActor(user: AuthedUser): Promise<ToolActor> {
  const profile = await loadUser(user.uid);
  const role = text(profile?.role) || text(user.role);
  const email = text(user.email) || text(profile?.email);
  const staff = resolveStaffRole({
    email,
    role,
    adminRole: text(profile?.adminRole) || text(user.adminRole),
  });
  return {
    uid: user.uid,
    email,
    role,
    staff,
    institutionId: text(profile?.institutionId),
    region: text(profile?.region) || text(profile?.state),
    country: text(profile?.country),
    partner: isPartnerMerchant({ role, roles: Array.isArray(profile?.roles) ? profile.roles as string[] : [] }),
    platform: staff === 'super_admin' || staff === 'admin' || role === 'admin',
  };
}

export function allocationScope(actor: ToolActor): string | null {
  if (actor.staff === 'super_admin') return null;
  return actor.institutionId || null;
}

export function canAllocate(actor: ToolActor): boolean {
  if (actor.staff === 'super_admin') return true;
  if (!actor.institutionId) return false;
  return actor.staff === 'admin' || actor.role === 'institution_admin' || actor.role === 'teacher' || actor.role === 'admin';
}

export function canCreateAllocation(actor: ToolActor): boolean {
  return actor.staff === 'super_admin' || ((actor.staff === 'admin' || actor.role === 'institution_admin' || actor.role === 'admin') && !!actor.institutionId);
}

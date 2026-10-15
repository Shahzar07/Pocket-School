import { anyTargetMatch, normaliseTargets } from '../allocation-targets';
import { allocResource } from '../entitlements';

export function normaliseAudiences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normaliseTargets(value.filter((item): item is string => typeof item === 'string'));
}

/**
 * Approved resources stay visible when no audience is set.
 * A chosen audience uses the shared allocation targets.
 * `alloc:resource:{id}` still opens a resource for one student.
 */
export function canSeeResource(input: {
  status: string;
  authorId: string;
  viewerId: string;
  viewerRole: string;
  audiences: readonly string[];
  permissions: readonly string[];
  resourceId: string;
  institutionId?: string | null;
  cohortIds?: readonly string[];
}): boolean {
  if (input.viewerRole === 'admin' || input.authorId === input.viewerId) return true;
  if (input.permissions.includes(allocResource(input.resourceId))) return true;
  if (input.status !== 'approved') return false;
  if (input.audiences.length === 0) return true;
  return anyTargetMatch(input.audiences, {
    role: input.viewerRole,
    userId: input.viewerId,
    institutionId: input.institutionId,
    cohortIds: input.cohortIds,
  }).hit;
}

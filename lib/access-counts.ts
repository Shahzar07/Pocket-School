/** Live headcount for the access page. Users & Sparks remains the directory. */

export interface RoleCount {
  role: string;
  count: number;
}

const ROLES = ['student', 'teacher', 'parent', 'institution_admin', 'admin'] as const;

export function countByRole(users: { role?: string | null }[]): RoleCount[] {
  const totals = new Map<string, number>(ROLES.map((role) => [role, 0]));
  for (const user of users) {
    const role = user.role && totals.has(user.role) ? user.role : 'student';
    totals.set(role, (totals.get(role) ?? 0) + 1);
  }
  return ROLES.map((role) => ({ role, count: totals.get(role) ?? 0 }));
}

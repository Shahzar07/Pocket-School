/**
 * Shared dashboard home for every Poket School role.
 * Web and the mobile app should both follow this map.
 * Tile order is a preference, not a permission.
 */

export const DASH_ROLES = [
  'student',
  'parent',
  'teacher',
  'institution',
  'admin',
  'alumni',
  'recruiter',
] as const;

export type DashRole = (typeof DASH_ROLES)[number];

export const DASH_CATEGORIES = [
  'learning',
  'progress',
  'messages',
  'community',
  'careers',
  'payments',
  'safety',
  'settings',
  'insights',
  'people',
] as const;

export type DashCategory = (typeof DASH_CATEGORIES)[number];

export type AlertTone = 'good' | 'cyan' | 'coral' | 'critical';

export interface CategoryStyle {
  label: string;
  /** Lucide icon name. One style, 24px, rounded strokes. */
  icon: string;
  /** Soft wash behind the tile. */
  wash: string;
  /** Icon ink. AA on the wash and on a card. */
  ink: string;
}

export const CATEGORY_STYLE: Record<DashCategory, CategoryStyle> = {
  learning: { label: 'Learning', icon: 'book-open', wash: 'var(--ps-wash)', ink: 'var(--ps-blue-deep)' },
  progress: { label: 'Progress', icon: 'activity', wash: 'var(--ps-amber-soft)', ink: 'var(--ps-on-amber)' },
  messages: { label: 'Messages', icon: 'message-square', wash: 'var(--ps-wash)', ink: 'var(--ps-blue-deep)' },
  community: { label: 'Community', icon: 'users', wash: 'var(--ps-coral-soft)', ink: 'var(--ps-coral)' },
  careers: { label: 'Careers', icon: 'briefcase', wash: 'var(--ps-amber-soft)', ink: 'var(--ps-on-amber)' },
  payments: { label: 'Payments', icon: 'credit-card', wash: 'var(--ps-wash)', ink: 'var(--ps-blue-deep)' },
  safety: { label: 'Safety', icon: 'shield', wash: 'var(--ps-coral-soft)', ink: 'var(--ps-coral)' },
  settings: { label: 'Settings', icon: 'settings', wash: 'var(--ps-wash)', ink: 'var(--ps-blue-deep)' },
  insights: { label: 'Insights', icon: 'bar-chart-3', wash: 'var(--ps-amber-soft)', ink: 'var(--ps-on-amber)' },
  people: { label: 'People', icon: 'users-round', wash: 'var(--ps-coral-soft)', ink: 'var(--ps-coral)' },
};

export const ALERT_TONE: Record<AlertTone, { label: string; wash: string; ink: string }> = {
  good: { label: 'On track', wash: 'var(--ps-mint)', ink: 'var(--ps-good)' },
  cyan: { label: 'Needs a look', wash: 'var(--ps-cyan-soft)', ink: 'var(--ps-cyan-text)' },
  coral: { label: 'Needs care', wash: 'var(--ps-coral-soft)', ink: 'var(--ps-coral)' },
  critical: { label: 'Urgent', wash: 'var(--destructive)', ink: 'var(--destructive-foreground)' },
};

/** Push categories the bell groups by. Matches lib/push.ts. */
export const NOTICE_GROUPS = [
  'progress',
  'grades',
  'assignments',
  'goals',
  'attendance',
  'flags',
  'digests',
  'general',
] as const;

export type NoticeGroup = (typeof NOTICE_GROUPS)[number];

export const NOTICE_LABEL: Record<NoticeGroup, string> = {
  progress: 'Progress',
  grades: 'Grades',
  assignments: 'Assignments',
  goals: 'Goals',
  attendance: 'Attendance',
  flags: 'Safety',
  digests: 'Digests',
  general: 'General',
};

export interface DashLink {
  id: string;
  label: string;
  href: string;
  category: DashCategory;
  hint?: string;
}

export interface RoleHome {
  role: DashRole;
  label: string;
  /** Short line under the person's name. Supportive, never punitive. */
  blurb: string;
  fab: DashLink;
  /** Four destinations. More is the fifth tab and opens the full list. */
  tabs: DashLink[];
  /** The three jobs that should be one tap from home. */
  tasks: DashLink[];
  tiles: DashLink[];
}

const student: RoleHome = {
  role: 'student',
  label: 'Student',
  blurb: 'Pick up where you left off. Small steps still count.',
  fab: { id: 'continue', label: 'Continue lesson', href: '/dashboard/student/learning', category: 'learning' },
  tabs: [
    { id: 'home', label: 'Home', href: '/dashboard/student', category: 'learning' },
    { id: 'learn', label: 'Learn', href: '/dashboard/student/learning', category: 'learning' },
    { id: 'progress', label: 'Progress', href: '/dashboard/student/progress', category: 'progress' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
  ],
  tasks: [
    { id: 'continue-lesson', label: 'Continue lesson', href: '/dashboard/student/learning', category: 'learning', hint: 'Your next lesson' },
    { id: 'quest', label: "Today's quest", href: '/dashboard/student/tasks', category: 'progress', hint: 'Streak and daily goal' },
    { id: 'my-progress', label: 'Progress', href: '/dashboard/student/progress', category: 'progress', hint: 'A note from ET AI' },
  ],
  tiles: [
    { id: 'notes', label: 'Notes', href: '/dashboard/notes', category: 'learning', hint: 'Sticky notes' },
    { id: 'unit-tests', label: 'Unit tests due', href: '/dashboard/student/exams', category: 'learning' },
    { id: 'groups', label: 'Groups', href: '/dashboard/community', category: 'community' },
    { id: 'courses', label: 'Courses', href: '/dashboard/student/courses', category: 'learning' },
    { id: 'live', label: 'Live classes', href: '/dashboard/student/live', category: 'learning' },
    { id: 'achievements', label: 'Badges', href: '/dashboard/student/achievements', category: 'progress' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
    { id: 'billing', label: 'Payments', href: '/dashboard/student/billing', category: 'payments' },
    { id: 'safety', label: 'Safety', href: '/dashboard/student/integrity', category: 'safety' },
    { id: 'report-concern', label: 'Report a concern', href: '/dashboard/student/safety', category: 'safety' },
    { id: 'alumni', label: 'Alumni', href: '/dashboard/alumni', category: 'careers' },
    { id: 'profile', label: 'Settings', href: '/dashboard/profile', category: 'settings' },
  ],
};

const parent: RoleHome = {
  role: 'parent',
  label: 'Parent',
  blurb: 'See how your child is doing, then choose one helpful step.',
  fab: { id: 'message', label: 'Message the school', href: '/dashboard/messages', category: 'messages' },
  tabs: [
    { id: 'home', label: 'Home', href: '/dashboard/parent', category: 'progress' },
    { id: 'progress', label: 'Progress', href: '/dashboard/parent/progress', category: 'progress' },
    { id: 'alerts', label: 'Alerts', href: '/dashboard/parent/notifications', category: 'safety' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
  ],
  tasks: [
    { id: 'child-progress', label: 'Child progress', href: '/dashboard/parent/progress', category: 'progress', hint: 'Traffic lights' },
    { id: 'alerts', label: 'Alerts', href: '/dashboard/parent/notifications', category: 'safety', hint: 'What needs a look' },
    { id: 'payments', label: 'Payments', href: '/dashboard/parent/billing', category: 'payments', hint: 'Fees and receipts' },
  ],
  tiles: [
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
    { id: 'due', label: 'Due dates', href: '/dashboard/parent/duedates', category: 'learning' },
    { id: 'reports', label: 'Reports', href: '/dashboard/parent/reports', category: 'insights' },
    { id: 'goals', label: 'Goals', href: '/dashboard/parent/goals', category: 'progress' },
    { id: 'controls', label: 'Family controls', href: '/dashboard/parent/controls', category: 'safety' },
    { id: 'hotline', label: 'Poket SafeLine', href: '/dashboard/parent/hotline', category: 'safety' },
    { id: 'calendar', label: 'Calendar', href: '/dashboard/calendar', category: 'learning' },
    { id: 'profile', label: 'Settings', href: '/dashboard/profile', category: 'settings' },
  ],
};

const teacher: RoleHome = {
  role: 'teacher',
  label: 'Teacher',
  blurb: 'Your class is here. Start with anyone who needs you today.',
  fab: { id: 'mark', label: 'Mark work', href: '/dashboard/teacher/gradebook', category: 'learning' },
  tabs: [
    { id: 'home', label: 'Home', href: '/dashboard/teacher', category: 'people' },
    { id: 'risk', label: 'Class risk', href: '/dashboard/teacher/progress', category: 'progress' },
    { id: 'marking', label: 'Marking', href: '/dashboard/teacher/gradebook', category: 'learning' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
  ],
  tasks: [
    { id: 'class-risk', label: 'Class risk', href: '/dashboard/teacher/progress', category: 'progress', hint: 'Who needs a check-in' },
    { id: 'marking', label: 'Marking', href: '/dashboard/teacher/gradebook', category: 'learning', hint: 'Work waiting on you' },
    { id: 'attendance', label: 'Attendance', href: '/dashboard/teacher/attendance', category: 'people', hint: 'Today’s register' },
  ],
  tiles: [
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
    { id: 'classes', label: 'Classes', href: '/dashboard/teacher/classes', category: 'people' },
    { id: 'courses', label: 'Courses', href: '/dashboard/teacher/courses', category: 'learning' },
    { id: 'live', label: 'Live class', href: '/dashboard/teacher/live', category: 'learning' },
    { id: 'insights', label: 'Insights', href: '/dashboard/teacher/insights', category: 'insights' },
    { id: 'assignments', label: 'Assignments', href: '/dashboard/teacher/assignments', category: 'learning' },
    { id: 'hotline', label: 'Poket SafeLine', href: '/dashboard/teacher/hotline', category: 'safety' },
    { id: 'roll-call', label: 'Staff roll-call', href: '/dashboard/staff/roll-call', category: 'safety' },
    { id: 'profile', label: 'Settings', href: '/dashboard/profile', category: 'settings' },
  ],
};

const institution: RoleHome = {
  role: 'institution',
  label: 'Institution admin',
  blurb: 'Seats, joins, and the learners who need a plan.',
  fab: { id: 'joins', label: 'Review joins', href: '/dashboard/institution/approvals', category: 'people' },
  tabs: [
    { id: 'home', label: 'Home', href: '/dashboard/institution', category: 'people' },
    { id: 'people', label: 'People', href: '/dashboard/institution/approvals', category: 'people' },
    { id: 'billing', label: 'Billing', href: '/dashboard/institution/billing', category: 'payments' },
    { id: 'insights', label: 'Insights', href: '/dashboard/institution/progress', category: 'insights' },
  ],
  tasks: [
    { id: 'seats', label: 'Seats and billing', href: '/dashboard/institution/billing', category: 'payments', hint: 'Licences in use' },
    { id: 'joins', label: 'Joins queue', href: '/dashboard/institution/approvals', category: 'people', hint: 'People waiting' },
    { id: 'insights', label: 'Insights', href: '/dashboard/institution/progress', category: 'insights', hint: 'At-risk learners' },
  ],
  tiles: [
    { id: 'automation', label: 'Automation', href: '/dashboard/institution/templates', category: 'settings' },
    { id: 'care', label: 'Care cases', href: '/dashboard/institution/progress', category: 'safety', hint: 'Linked from progress alerts' },
    { id: 'emergency', label: 'Emergency alerts', href: '/dashboard/institution/emergency', category: 'safety' },
    { id: 'roll-call', label: 'Staff roll-call', href: '/dashboard/staff/roll-call', category: 'safety' },
    { id: 'activity', label: 'Activity', href: '/dashboard/institution/activity', category: 'insights' },
    { id: 'usage', label: 'Usage', href: '/dashboard/institution/usage', category: 'insights' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
    { id: 'recruiter', label: 'Recruiter desk', href: '/dashboard/recruiter', category: 'careers' },
    { id: 'profile', label: 'Settings', href: '/dashboard/profile', category: 'settings' },
  ],
};

const admin: RoleHome = {
  role: 'admin',
  label: 'Super admin',
  blurb: 'The whole platform, starting with what needs a decision.',
  fab: { id: 'insights', label: 'Open insights', href: '/dashboard/admin/insights', category: 'insights' },
  tabs: [
    { id: 'home', label: 'Home', href: '/dashboard/admin', category: 'insights' },
    { id: 'insights', label: 'Insights', href: '/dashboard/admin/insights', category: 'insights' },
    { id: 'people', label: 'Institutions', href: '/dashboard/admin/institutions', category: 'people' },
    { id: 'moderation', label: 'Moderation', href: '/dashboard/admin/moderation', category: 'safety' },
  ],
  tasks: [
    { id: 'queues', label: 'Queues', href: '/dashboard/admin/queues', category: 'safety', hint: 'Decisions waiting' },
    { id: 'safety-desk', label: 'Safety Desk', href: '/dashboard/admin/safety-desk', category: 'safety', hint: 'SLA timers' },
    { id: 'users', label: 'People', href: '/dashboard/admin/users', category: 'people', hint: 'Roles and tiers' },
  ],
  tiles: [
    { id: 'queues', label: 'Queues', href: '/dashboard/admin/queues', category: 'safety' },
    { id: 'platform', label: 'Platform', href: '/dashboard/admin/platform', category: 'settings' },
    { id: 'pulse', label: 'Pulse', href: '/dashboard/admin/pulse', category: 'insights' },
    { id: 'pricing', label: 'Pricing', href: '/dashboard/admin/payments', category: 'payments' },
    { id: 'automation', label: 'Automation', href: '/dashboard/admin/settings', category: 'settings' },
    { id: 'users', label: 'People', href: '/dashboard/admin/users', category: 'people' },
    { id: 'placement', label: 'Course placement', href: '/dashboard/admin/placement', category: 'learning' },
    { id: 'help', label: 'Help articles', href: '/dashboard/admin/help', category: 'settings' },
    { id: 'hotline', label: 'Poket SafeLine', href: '/dashboard/admin/hotline', category: 'safety' },
    { id: 'emergency', label: 'Emergency desk', href: '/dashboard/admin/emergency', category: 'safety' },
    { id: 'roll-call', label: 'Staff roll-call', href: '/dashboard/staff/roll-call', category: 'safety' },
    { id: 'safety-desk', label: 'Safety Desk', href: '/dashboard/admin/safety-desk', category: 'safety' },
    { id: 'emergency-numbers', label: 'Emergency numbers', href: '/dashboard/admin/emergency-numbers', category: 'safety' },
    { id: 'activity', label: 'Activity', href: '/dashboard/admin/activity', category: 'insights' },
    { id: 'profile', label: 'Settings', href: '/dashboard/profile', category: 'settings' },
  ],
};

const alumni: RoleHome = {
  role: 'alumni',
  label: 'Alumni',
  blurb: 'Your certificates and profile stay with you after the course.',
  fab: { id: 'profile', label: 'Update profile', href: '/dashboard/profile', category: 'careers' },
  tabs: [
    { id: 'home', label: 'Home', href: '/dashboard/alumni', category: 'careers' },
    { id: 'certificates', label: 'Certificates', href: '/dashboard/student/certificates', category: 'progress' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
    { id: 'profile', label: 'Profile', href: '/dashboard/profile', category: 'careers' },
  ],
  tasks: [
    { id: 'certificates', label: 'Certificates', href: '/dashboard/student/certificates', category: 'progress', hint: 'Proof you can share' },
    { id: 'profile', label: 'Profile', href: '/dashboard/profile', category: 'careers', hint: 'What schools can see' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages', hint: 'From your school' },
  ],
  tiles: [
    { id: 'courses', label: 'Past courses', href: '/dashboard/student/courses', category: 'learning' },
    { id: 'community', label: 'Community', href: '/dashboard/community', category: 'community' },
    { id: 'progress', label: 'Progress', href: '/dashboard/student/progress', category: 'progress' },
    { id: 'settings', label: 'Settings', href: '/dashboard/profile', category: 'settings' },
  ],
};

const recruiter: RoleHome = {
  role: 'recruiter',
  label: 'Recruiter',
  blurb: 'Search people a school has chosen to share. Nothing here is guessed.',
  fab: { id: 'search', label: 'Search talent', href: '/dashboard/recruiter#search', category: 'careers' },
  tabs: [
    { id: 'home', label: 'Home', href: '/dashboard/recruiter', category: 'careers' },
    { id: 'search', label: 'Search', href: '/dashboard/recruiter#search', category: 'careers' },
    { id: 'lists', label: 'Lists', href: '/dashboard/recruiter#lists', category: 'people' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
  ],
  tasks: [
    { id: 'search', label: 'Search', href: '/dashboard/recruiter#search', category: 'careers', hint: 'Name, level, or subject' },
    { id: 'lists', label: 'Talent lists', href: '/dashboard/recruiter#lists', category: 'people', hint: 'Saved by you' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages', hint: 'With a school' },
  ],
  tiles: [
    { id: 'institutions', label: 'Schools', href: '/dashboard/admin/institutions', category: 'people' },
    { id: 'messages', label: 'Messages', href: '/dashboard/messages', category: 'messages' },
    { id: 'settings', label: 'Settings', href: '/dashboard/profile', category: 'settings' },
  ],
};

const HOMES: Record<DashRole, RoleHome> = {
  student,
  parent,
  teacher,
  institution,
  admin,
  alumni,
  recruiter,
};

export function isDashRole(value: string): value is DashRole {
  return (DASH_ROLES as readonly string[]).includes(value);
}

export function roleHome(role: DashRole): RoleHome {
  return HOMES[role];
}

export function tileStorageKey(role: DashRole): string {
  return `poket-dash-tiles:${role}`;
}

export function coachStorageKey(role: DashRole): string {
  return `poket-dash-coach:${role}`;
}

/** Keep saved ids, drop unknown ones, and append anything new at the end. */
export function applyTileOrder(tiles: readonly DashLink[], order: readonly string[]): DashLink[] {
  const byId = new Map(tiles.map((tile, index) => [tile.id, { tile, index }] as const));
  const used = new Set<string>();
  const next: DashLink[] = [];
  for (const id of order) {
    const row = byId.get(id);
    if (!row || used.has(id)) continue;
    used.add(id);
    next.push(row.tile);
  }
  for (const tile of tiles) {
    if (used.has(tile.id)) continue;
    next.push(tile);
  }
  return next;
}

export function moveTile(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const next = [...ids];
  const index = next.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return [...ids];
  const [item] = next.splice(index, 1);
  if (!item) return [...ids];
  next.splice(target, 0, item);
  return next;
}

export interface SidebarGroup {
  category: DashCategory;
  items: DashLink[];
}

/** Tasks first, then tiles, one link per href, grouped by category. */
export function sidebarGroups(role: DashRole): SidebarGroup[] {
  const home = roleHome(role);
  const seen = new Set<string>();
  const items: DashLink[] = [];
  for (const item of [...home.tasks, ...home.tiles]) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    items.push(item);
  }
  const groups: SidebarGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.category === item.category) last.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }
  return groups;
}

export function searchLinks(role: DashRole, query: string): DashLink[] {
  const home = roleHome(role);
  const needle = query.trim().toLowerCase();
  const pool = [home.fab, ...home.tabs, ...home.tasks, ...home.tiles];
  const seen = new Set<string>();
  const hits: DashLink[] = [];
  for (const item of pool) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (!needle || item.label.toLowerCase().includes(needle) || CATEGORY_STYLE[item.category].label.toLowerCase().includes(needle)) {
      hits.push(item);
    }
  }
  return hits.slice(0, 8);
}

export function pushCategoryForNotice(type: string, link?: string | null): NoticeGroup {
  if (link && link.includes('/progress')) return 'progress';
  switch (type) {
    case 'grade':
      return 'grades';
    case 'assignment':
    case 'exam':
      return 'assignments';
    case 'integrity':
      return 'flags';
    case 'announcement':
      return 'digests';
    case 'attendance':
      return 'attendance';
    case 'goal':
      return 'goals';
    default:
      return 'general';
  }
}

export interface GroupedNotices<T> {
  category: NoticeGroup;
  label: string;
  items: T[];
}

export function groupNotices<T extends { type: string; link?: string | null }>(items: readonly T[]): GroupedNotices<T>[] {
  const buckets = new Map<NoticeGroup, T[]>();
  for (const item of items) {
    const category = pushCategoryForNotice(item.type, item.link);
    const list = buckets.get(category) ?? [];
    list.push(item);
    buckets.set(category, list);
  }
  return NOTICE_GROUPS.filter(category => buckets.has(category)).map(category => ({
    category,
    label: NOTICE_LABEL[category],
    items: buckets.get(category) ?? [],
  }));
}

export function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

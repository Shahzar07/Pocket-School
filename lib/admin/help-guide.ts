import { STAFF_LABELS, type StaffRole } from '@/lib/admin-console';
import { DASHBOARD_PAGES, type DashboardPage } from '@/lib/dashboard-pages';

export interface HelpTool {
  path: string;
  title: string;
  purpose: string;
  keys: string;
}

export interface HelpRole {
  id: string;
  label: string;
  can: string;
  hidden: string;
}

const EXTRA: HelpTool[] = [
  {
    path: '/dashboard/admin/queues',
    title: 'Queues',
    purpose: 'Verification, partners, moderation, safety, Amber, and institution decisions waiting on staff.',
    keys: 'FIREBASE_SERVICE_ACCOUNT',
  },
  {
    path: '/dashboard/admin/platform',
    title: 'Platform',
    purpose: 'Feature flags, broadcasts, helplines, safety terms, and the on-call rota.',
    keys: 'FIREBASE_SERVICE_ACCOUNT',
  },
  {
    path: '/dashboard/admin/pulse',
    title: 'Pulse',
    purpose: 'Signups, active people, revenue, and SLA breaches.',
    keys: 'FIREBASE_SERVICE_ACCOUNT',
  },
];

export const HELP_ROLES: HelpRole[] = [
  {
    id: 'super_admin',
    label: STAFF_LABELS.super_admin,
    can: 'Every admin tool, every institution, partner workflow, certificate defaults, and the global Poket SafeLine queue. Can change another super admin.',
    hidden: 'Nothing on the admin desk is hidden.',
  },
  {
    id: 'admin',
    label: STAFF_LABELS.admin,
    can: 'The same tools, limited to their institution, region, or country. Can create seat allocations for that institution and edit that institution’s certificate override.',
    hidden: 'Other institutions, other regions, super-admin role changes, and safeguarding names unless they are the safeguarding lead.',
  },
  {
    id: 'institution_admin',
    label: 'Institution admin',
    can: 'Their own academy, its allocations, and its certificate override. Poket SafeLine opens on the institution queue.',
    hidden: 'Other academies, the partner queue, platform flags, and certificate defaults.',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    can: 'Read seat allocations for their institution. Poket SafeLine opens on the teacher queue.',
    hidden: 'Creating institutions, partner records, and certificate templates.',
  },
  {
    id: 'partner_merchant',
    label: 'Partner merchant',
    can: 'Create and update their own merchant record and offers. Approve, suspend, and archive stay with staff.',
    hidden: 'Other merchants, institutions, allocations, certificates, and the SafeLine banner.',
  },
  {
    id: 'content_editor',
    label: STAFF_LABELS.content_editor,
    can: 'Help articles and other content tools.',
    hidden: 'People, billing, and safety queues.',
  },
  {
    id: 'support',
    label: STAFF_LABELS.support,
    can: 'Support and moderation tools, including view-as.',
    hidden: 'Billing changes and super-admin settings.',
  },
  {
    id: 'finance',
    label: STAFF_LABELS.finance,
    can: 'Sparks and access tiers.',
    hidden: 'Safety identity and content publishing.',
  },
];

export function adminTools(): HelpTool[] {
  const fromPages = DASHBOARD_PAGES.filter((page) => page.path.startsWith('/dashboard/admin')).map(toTool);
  const known = new Set(fromPages.map((tool) => tool.path));
  return [...fromPages, ...EXTRA.filter((tool) => !known.has(tool.path))].sort((a, b) => a.path.localeCompare(b.path));
}

function toTool(page: DashboardPage): HelpTool {
  return { path: page.path, title: page.title, purpose: page.purpose, keys: page.ownerKeys };
}

export function missingKeys(tools: readonly HelpTool[]): { key: string; effect: string }[] {
  const rows = [
    {
      key: 'FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS',
      effect: 'Without the Firebase Admin key, institution create, the allocation list, partner saves, certificate saves, the admin desk, and SafeLine counts say this admin tool is coming soon. Nothing is written.',
    },
  ];
  const seen = new Set<string>(['None.', 'None']);
  for (const tool of tools) {
    const key = tool.keys.trim();
    if (!key || seen.has(key) || /^none\b/i.test(key)) continue;
    seen.add(key);
    rows.push({ key, effect: `${tool.title} (${tool.path})` });
  }
  return rows;
}

export function toolsForRole(role: string | null, tools: readonly HelpTool[]): HelpTool[] {
  if (role === 'partner_merchant') return tools.filter((tool) => tool.path === '/dashboard/admin/partners');
  if (role === 'teacher') {
    return tools.filter((tool) => tool.path === '/dashboard/admin/allocations' || tool.path === '/dashboard/admin/hotline');
  }
  if (role === 'institution_admin') {
    return tools.filter((tool) => (
      tool.path.startsWith('/dashboard/admin/institutions')
      || tool.path === '/dashboard/admin/allocations'
      || tool.path === '/dashboard/admin/certificates'
      || tool.path === '/dashboard/admin/hotline'
      || tool.path === '/dashboard/admin/help'
    ));
  }
  return [...tools];
}

export function roleNote(staff: StaffRole | null, role: string): HelpRole | undefined {
  if (staff) return HELP_ROLES.find((item) => item.id === staff);
  return HELP_ROLES.find((item) => item.id === role);
}

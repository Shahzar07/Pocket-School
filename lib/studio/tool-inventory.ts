/**
 * Every AI tool surface. The sidebar lists the entries a role may open.
 * Wrapped routes use the full-page shell. Unwrapped rows stay in the product
 * and are listed so the shell does not swallow a catalog, an API, or a CMS journal.
 */

import { hasAccountRole, type RoleSource } from '@/lib/account-modes';
import { hasCmsAddon } from '@/lib/entitlements';
import { isFlagEnabled } from '@/lib/flags';
import { isTeacherOrAdmin } from '@/lib/roles';
import { canUseDeskTool, type DeskToolId } from '@/lib/studio/desk';
import { STUDIO_ET, STUDIO_TIMETABLE } from '@/lib/studio-paths';
import { studioTimetableGate } from '@/lib/timetable/access';
import { TIMETABLE_COPY } from '@/lib/timetable/copy';

export type ToolGate = 'timetable' | 'teacher-toolkit' | 'parent-explainer' | 'research-helper' | 'student' | 'staff' | 'books' | 'cms' | 'admin';

export interface ToolActor extends RoleSource {
  cms?: boolean | null;
  permissions?: string[] | null;
  accessTier?: number | null;
  subscriptionTier?: string | null;
}

export interface ToolRoute {
  id: string;
  label: string;
  href: string;
  /** Show in the shell Tools list. */
  sidebar: boolean;
  /** Render this surface inside the full-page shell. */
  wrapped: boolean;
  /** The page already draws the shell (the ET AI chat). */
  ownsShell?: boolean;
  /** Path prefixes this entry covers, including nested pages. */
  covers: string[];
  gate?: ToolGate;
  /** Desk tools open inside ET AI. */
  mode?: DeskToolId;
  entry?: 'timetable';
  /** Exact path match. Prefix matches would swallow child tools. */
  exact?: boolean;
  why: string;
}

const TIMETABLE_PATHS = [
  STUDIO_TIMETABLE,
  '/dashboard/admin/timetable',
  '/dashboard/institution/timetable',
  '/dashboard/teacher/timetable',
  '/dashboard/student/timetable',
  '/dashboard/parent/timetable',
];

const PLANNER_PATHS = [
  '/dashboard/student/planner',
  '/dashboard/teacher/planner',
  '/dashboard/parent/planner',
  '/dashboard/admin/planner',
];

export const TOOL_ROUTES: ToolRoute[] = [
  {
    id: 'ai-studio',
    label: 'AI Studio',
    href: '/dashboard/studio',
    sidebar: false,
    wrapped: true,
    ownsShell: true,
    exact: true,
    covers: ['/dashboard/studio'],
    why: 'Signed-in AI Studio home. The shell is already this page, so Tools does not list it again.',
  },
  {
    id: 'et-ai',
    label: 'ET AI',
    href: STUDIO_ET,
    sidebar: false,
    wrapped: true,
    ownsShell: true,
    exact: true,
    covers: [STUDIO_ET],
    why: 'ET AI chat. The top Chats link opens this address, so Tools does not list it again.',
  },
  {
    id: 'et-maths',
    label: 'ET Maths',
    href: '/dashboard/studio/maths',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/studio/maths'],
    why: 'Maths solver, exam packs, and the daily puzzle.',
  },
  {
    id: 'et-exams',
    label: 'ET Exams',
    href: '/dashboard/studio/exam-prep',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/studio/exam-prep'],
    why: 'Exam plans, mocks, oral practice, topics, and shared plans.',
  },
  {
    id: 'et-essays',
    label: 'ET Essays',
    href: '/dashboard/studio/essays',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/studio/essays', '/studio/essays'],
    why: 'Essay planner and teacher review, including the public essays pages.',
  },
  {
    id: 'essay-writer',
    label: 'Essay Writer',
    href: '/dashboard/studio/essay',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/studio/essay', '/dashboard/student/essay'],
    why: 'ET AI grades an essay the learner writes.',
  },
  {
    id: 'book-studio',
    label: 'Book Studio',
    href: '/reads/studio',
    sidebar: true,
    wrapped: true,
    covers: ['/reads/studio'],
    why: 'PoketReads book creator: idea, cast, chapters, cover, preview, export.',
  },
  {
    id: 'ai-book-creator',
    label: 'AI Book Creator',
    href: '/dashboard/admin/books',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/admin/books'],
    gate: 'books',
    why: 'The same Book Studio opened from the CMS. Teachers need the CMS add-on.',
  },
  {
    id: 'poketreads',
    label: 'PoketReads',
    href: '/reads',
    sidebar: true,
    wrapped: false,
    covers: [],
    why: 'Public catalog and storefront. The link stays in Tools. Wrapping it would hide the shop.',
  },
  {
    id: 'teacher-toolkit',
    label: 'Teacher Toolkit',
    href: `${STUDIO_ET}?mode=teacher-toolkit`,
    sidebar: true,
    wrapped: true,
    ownsShell: true,
    covers: [],
    gate: 'teacher-toolkit',
    mode: 'teacher-toolkit',
    why: 'Lesson plans, worksheets, and rubrics inside ET AI. Not a separate route.',
  },
  {
    id: 'parent-explainer',
    label: 'Parent Explainer',
    href: `${STUDIO_ET}?mode=parent-explainer`,
    sidebar: true,
    wrapped: true,
    ownsShell: true,
    covers: [],
    gate: 'parent-explainer',
    mode: 'parent-explainer',
    why: 'Plain-language week inside ET AI. Parents only.',
  },
  {
    id: 'research-helper',
    label: 'Research Helper',
    href: `${STUDIO_ET}?mode=research-helper`,
    sidebar: true,
    wrapped: true,
    ownsShell: true,
    covers: [],
    gate: 'research-helper',
    mode: 'research-helper',
    why: 'Sources and citations inside ET AI. Students and teachers.',
  },
  {
    id: 'study-planner',
    label: 'Study planner',
    href: '/dashboard/planner',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/planner'],
    gate: 'student',
    exact: true,
    why: 'Student week of revision. The page opens the calendar terms view.',
  },
  {
    id: 'timetabler',
    label: TIMETABLE_COPY.studioTab,
    href: STUDIO_TIMETABLE,
    sidebar: true,
    wrapped: true,
    covers: TIMETABLE_PATHS,
    gate: 'timetable',
    entry: 'timetable',
    why: 'ET AI Timetabler, including each role desk. Hidden for students and parents.',
  },
  {
    id: 'ai-teachers',
    label: 'AI Teachers',
    href: '/dashboard/studio/teachers',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/studio/teachers', '/ai-teachers'],
    why: 'Portrait grid and each teacher chat. ET + Subject was this same grid, so it is not a second link. /ai-teachers stays as the public address.',
  },
  {
    id: 'lesson-generator',
    label: 'Lesson generator',
    href: '/dashboard/teacher/upload',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/teacher/upload'],
    gate: 'staff',
    why: 'Teacher upload that drafts a lesson, quiz, or flashcards.',
  },
  {
    id: 'exam-builder',
    label: 'Exam builder',
    href: '/dashboard/teacher/exams',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/teacher/exams'],
    gate: 'staff',
    why: 'Build an exam and send it to a class.',
  },
  {
    id: 'report-studio',
    label: 'Report Studio',
    href: '/dashboard/teacher/report-studio',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/teacher/report-studio'],
    gate: 'staff',
    why: 'Report comments drafted with ET AI.',
  },
  {
    id: 'course-architect',
    label: 'Course architect',
    href: '/dashboard/admin/curriculum',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/admin/curriculum'],
    gate: 'cms',
    why: 'ET AI course architect in the curriculum CMS.',
  },
  {
    id: 'exam-packs',
    label: 'Exam packs',
    href: '/dashboard/admin/exam-packs',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/admin/exam-packs'],
    gate: 'admin',
    why: 'Admin desk for ET Maths syllabus packs.',
  },
  {
    id: 'creator-store',
    label: 'Creator Store',
    href: '/dashboard/store',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/store'],
    why: 'Creator notes, worksheets, and templates.',
  },
  {
    id: 'planner',
    label: 'Planner',
    href: '/dashboard/student/planner',
    sidebar: true,
    wrapped: true,
    covers: PLANNER_PATHS,
    why: 'Role planner. The link follows the signed-in role.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    href: '/dashboard/calendar',
    sidebar: true,
    wrapped: true,
    covers: ['/dashboard/calendar'],
    why: 'Month, week, and day calendar beside the studio tools.',
  },
];

/** Surfaces that are not full-page AI tools. Listed so the inventory is complete. */
export const UNWRAPPED_NOTES: { path: string; why: string }[] = [
  { path: '/reads and /reads/[slug]', why: 'PoketReads catalog. The Tools link stays. The creator is /reads/studio, which is wrapped.' },
  { path: '/studio, /pricing, and other marketing pages', why: 'Public marketing. Not a signed-in tool.' },
  { path: '/preview/studio and /preview/timetable', why: 'Design galleries for QA. The live tools are the dashboard routes.' },
  { path: '/api/ai/*, /api/reads/translate, /api/content/translate', why: 'APIs. There is no page to wrap.' },
  { path: 'Flashcards', why: 'An ET AI skill, and a format on the lesson generator. No standalone page.' },
  { path: 'Translation', why: 'The language switcher and translate APIs. No standalone page.' },
  { path: 'Homework help', why: 'The ET AI photo prompt. No standalone page.' },
  { path: '/dashboard/admin/blog', why: 'Journal CMS for unpublished posts. Not an AI writer.' },
  { path: 'Gradebook, attendance, billing, SafeLine, helpdesk, messages', why: 'School desk pages. Not AI tool canvases.' },
  { path: 'Floating ET tutor on other dashboard pages', why: 'The dock stays on non-tool pages. Tool routes hide it and use the shell.' },
];

function pathOnly(href: string): string {
  return href.split('?')[0] ?? href;
}

export function plannerHref(role: string | undefined): string {
  if (role === 'teacher') return '/dashboard/teacher/planner';
  if (role === 'parent') return '/dashboard/parent/planner';
  if (role === 'admin' || role === 'super_admin' || role === 'content_editor') return '/dashboard/admin/planner';
  if (role === 'institution_admin') return '/dashboard/calendar';
  return '/dashboard/student/planner';
}

export function toolHref(route: ToolRoute, role: string | undefined, place: 'dashboard' | 'public'): string {
  if (route.id === 'planner') return plannerHref(role);
  if (route.id === 'ai-teachers') return place === 'dashboard' ? '/dashboard/studio/teachers' : '/ai-teachers';
  if (route.id === 'essay-writer' && (role === 'student' || !role)) return '/dashboard/student/essay';
  return route.href;
}

function allowed(actor: ToolActor | null | undefined, gate: ToolGate | undefined): boolean {
  if (!gate) return true;
  if (gate === 'timetable') {
    return studioTimetableGate({ role: actor?.role, roles: actor?.roles, permissions: actor?.permissions }) !== 'hidden';
  }
  if (gate === 'teacher-toolkit' || gate === 'parent-explainer' || gate === 'research-helper') {
    return canUseDeskTool(actor, gate);
  }
  if (gate === 'student') return hasAccountRole(actor, 'student') && isFlagEnabled('studyPlanner');
  if (gate === 'staff') return isTeacherOrAdmin(actor);
  if (gate === 'admin') return actor?.role === 'admin' || actor?.role === 'super_admin';
  if (gate === 'books') {
    if (actor?.role === 'admin' || actor?.role === 'super_admin' || actor?.role === 'content_editor') return true;
    const teaching = hasAccountRole(actor, 'teacher') || actor?.role === 'institution_admin';
    return Boolean(teaching && hasCmsAddon(actor));
  }
  if (gate === 'cms') {
    if (actor?.role === 'admin' || actor?.role === 'super_admin') return true;
    const teaching = hasAccountRole(actor, 'teacher') || actor?.role === 'institution_admin';
    return Boolean(teaching && hasCmsAddon(actor));
  }
  return false;
}

export const TOOL_ICON_NAMES = [
  'sparkles',
  'bot',
  'calculator',
  'clipboard',
  'pen',
  'book',
  'book-marked',
  'users',
  'search',
  'calendar',
  'calendar-range',
  'graduation',
  'upload',
  'file-question',
  'file-text',
  'layers',
  'package',
  'store',
  'calendar-days',
  'layout',
] as const;

export type ToolIconName = (typeof TOOL_ICON_NAMES)[number];

export interface SidebarTool {
  id: string;
  label: string;
  href: string;
  icon: ToolIconName;
  /** Top group, above Recents. Everything else stays in Tools. */
  placement: 'primary' | 'tools';
  mode?: DeskToolId;
  entry?: 'timetable';
}

const TOOL_ICONS: Record<string, ToolIconName> = {
  'ai-studio': 'sparkles',
  'et-ai': 'bot',
  'et-maths': 'calculator',
  'et-exams': 'clipboard',
  'et-essays': 'pen',
  'essay-writer': 'pen',
  'book-studio': 'book',
  'ai-book-creator': 'book-marked',
  poketreads: 'book',
  'teacher-toolkit': 'layout',
  'parent-explainer': 'users',
  'research-helper': 'search',
  'study-planner': 'calendar',
  timetabler: 'calendar-range',
  'ai-teachers': 'graduation',
  'lesson-generator': 'upload',
  'exam-builder': 'file-question',
  'report-studio': 'file-text',
  'course-architect': 'layers',
  'exam-packs': 'package',
  'creator-store': 'store',
  planner: 'calendar-days',
  calendar: 'calendar',
};

/** Former tab-bar order. AI Teachers is pulled into the top group. */
const TAB_ORDER = ['ai-studio', 'et-ai', 'et-maths', 'et-exams', 'et-essays', 'creator-store', 'ai-book-creator', 'timetabler'];

export function sidebarTools(actor: ToolActor | null | undefined, place: 'dashboard' | 'public'): SidebarTool[] {
  const ranked = TOOL_ROUTES.filter(route => route.sidebar && allowed(actor, route.gate)).map((route, index) => ({
    id: route.id,
    label: route.label,
    href: toolHref(route, actor?.role ?? undefined, place),
    icon: TOOL_ICONS[route.id] ?? 'sparkles',
    placement: route.id === 'ai-teachers' ? 'primary' as const : 'tools' as const,
    mode: route.mode,
    entry: route.entry,
    rank: route.id === 'ai-teachers' ? -1 : (TAB_ORDER.indexOf(route.id) >= 0 ? TAB_ORDER.indexOf(route.id) : 100 + index),
  }));
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.map(({ rank: _rank, ...tool }) => tool);
}

function coversPath(route: ToolRoute, pathname: string): boolean {
  return route.covers.some(prefix => {
    if (route.exact && prefix === pathOnly(route.href)) return pathname === prefix;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function matchingRoutes(pathname: string): ToolRoute[] {
  return TOOL_ROUTES.filter(route => coversPath(route, pathname));
}

export function isAiToolPath(pathname: string): boolean {
  return matchingRoutes(pathname).some(route => route.wrapped);
}

export function ownsStudioShell(pathname: string): boolean {
  return TOOL_ROUTES.some(route => route.ownsShell && route.exact && pathname === pathOnly(route.href));
}

export function activeSidebarId(pathname: string, tools: SidebarTool[]): string | null {
  let best: { id: string; length: number } | null = null;
  for (const tool of tools) {
    if (tool.mode) continue;
    const path = pathOnly(tool.href);
    const route = TOOL_ROUTES.find(item => item.id === tool.id);
    const prefixes = route?.covers.length ? route.covers : [path];
    for (const prefix of prefixes) {
      const hit = route?.exact && prefix === path
        ? pathname === prefix
        : pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (!hit) continue;
      if (!best || prefix.length > best.length) best = { id: tool.id, length: prefix.length };
    }
  }
  return best?.id ?? null;
}

export function inventoryLines(): { path: string; state: 'wrapped' | 'not wrapped'; why: string }[] {
  const lines: { path: string; state: 'wrapped' | 'not wrapped'; why: string }[] = [];
  const seen = new Set<string>();
  const push = (path: string, state: 'wrapped' | 'not wrapped', why: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    lines.push({ path, state, why });
  };
  for (const route of TOOL_ROUTES) {
    if (route.mode) {
      push(`${STUDIO_ET}?mode=${route.mode}`, 'wrapped', route.why);
      continue;
    }
    const paths = route.covers.length ? route.covers : [pathOnly(route.href)];
    for (const path of paths) push(path, route.wrapped ? 'wrapped' : 'not wrapped', route.why);
  }
  for (const note of UNWRAPPED_NOTES) push(note.path, 'not wrapped', note.why);
  return lines;
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  ArrowLeft, Asterisk, BookMarked, BookOpen, Bot, Calculator, Calendar, CalendarDays, CalendarRange,
  ClipboardList, FileQuestionMark, FileText, GraduationCap, HelpCircle, Home, Layers, LayoutDashboard,
  Library, Menu, MessageSquare, Package, PenLine, Phone, Plus, Search, Sparkles, Store, Upload, User as UserIcon, Users,
} from 'lucide-react';
import { AccountMenu } from '@/components/account/account-menu';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { DashboardSearch } from '@/components/dashboard-search';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationsBell } from '@/components/notifications-bell';
import { PipGuide } from '@/components/pip-guide';
import { SparksChip } from '@/components/sparks-chip';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAccountMode } from '@/hooks/use-account-mode';
import { useAuthSTORE } from '@/hooks/use-auth';
import { homeForMode, MODE_NAMES, type AccountMode } from '@/lib/account-modes';
import { resolveStaffRole } from '@/lib/admin-console';
import { studioCssVars } from '@/lib/studio/shell-theme';
import {
  activeSidebarId,
  sidebarTools,
  type SidebarTool,
  type ToolIconName,
} from '@/lib/studio/tool-inventory';
import type { TourRole } from '@/lib/tour-steps';

const TOUR_ROLES = new Set<string>(['student', 'teacher', 'parent', 'admin', 'institution_admin']);

export const SHELL_LINK = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--studio-dim)] transition-colors hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-text)]';
export const SHELL_ACTIVE = 'flex w-full items-center gap-2.5 rounded-lg bg-[#3FE0D0] px-3 py-2 text-sm font-semibold text-[#203337]';

const TOOL_GLYPH: Record<ToolIconName, typeof Home> = {
  sparkles: Sparkles,
  bot: Bot,
  calculator: Calculator,
  clipboard: ClipboardList,
  pen: PenLine,
  book: BookOpen,
  'book-marked': BookMarked,
  users: Users,
  search: Search,
  calendar: Calendar,
  'calendar-range': CalendarRange,
  graduation: GraduationCap,
  upload: Upload,
  'file-question': FileQuestionMark,
  'file-text': FileText,
  layers: Layers,
  package: Package,
  store: Store,
  'calendar-days': CalendarDays,
  layout: LayoutDashboard,
};

export function StudioDot({ active = false }: { active?: boolean }) {
  return <span className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-[#203337]' : 'bg-[#3FE0D0]'}`} data-studio-dot="1" aria-hidden />;
}

export function ToolGlyph({ name }: { name: ToolIconName }) {
  const Icon = TOOL_GLYPH[name];
  return <Icon className="h-4 w-4 shrink-0" aria-hidden />;
}

function StudioShortcuts({ onClose }: { onClose: () => void }) {
  return (
    <>
      <Link href="/dashboard/studio" onClick={onClose} className={SHELL_LINK}>
        <StudioDot />
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden /> Chats
      </Link>
      <Link href="/dashboard/studio?view=library" onClick={onClose} className={SHELL_LINK}>
        <StudioDot />
        <Library className="h-4 w-4 shrink-0" aria-hidden /> Library
      </Link>
    </>
  );
}

function dashboardHomeHref(role: string | undefined): string {
  if (role === 'teacher') return '/dashboard/teacher';
  if (role === 'parent') return '/dashboard/parent';
  if (role === 'institution_admin') return '/dashboard/institution';
  if (role === 'admin' || role === 'super_admin' || role === 'content_editor') return '/dashboard/admin';
  if (role === 'partner_merchant') return '/dashboard/partner';
  return '/dashboard';
}

function safelineHref(role: string | undefined): string {
  if (role === 'teacher') return '/dashboard/teacher/hotline';
  if (role === 'parent') return '/dashboard/parent/hotline';
  if (role === 'admin' || role === 'super_admin' || role === 'content_editor') return '/dashboard/admin/hotline';
  if (role === 'institution_admin') return '/dashboard/institution/hotline';
  return '/dashboard/student/safety';
}

export function ShellEssentials() {
  const { resolvedTheme } = useTheme();
  const onDark = resolvedTheme !== 'light';
  const profile = useAuthSTORE(state => state.profile);
  const tourRole = (TOUR_ROLES.has(profile?.role ?? '') ? profile?.role : 'student') as TourRole;
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 overflow-hidden" data-studio-essentials="1">
      <PipGuide role={tourRole} compact />
      <ThemeToggle onDark={onDark} />
      <LanguageSwitcher tone={onDark ? 'onDark' : 'default'} compact />
      <NotificationsBell tone={onDark ? 'onDark' : 'default'} />
      <SparksChip />
      <CurrencySwitcher tone={onDark ? 'onDark' : 'default'} />
      <button
        type="button"
        aria-label="Search"
        aria-expanded={searchOpen}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--studio-text)] hover:bg-[var(--studio-surface-hover)]"
        onClick={() => {
          setSearchOpen(true);
          window.setTimeout(() => document.getElementById('dashboard-search')?.focus(), 0);
        }}
      >
        <Search className="h-4 w-4" aria-hidden />
      </button>
      {searchOpen ? (
        <div className="fixed end-3 top-14 z-50 w-[min(22rem,calc(100vw-1.5rem))]">
          <DashboardSearch />
        </div>
      ) : null}
    </div>
  );
}

function ShellAccount({ email }: { email: string }) {
  const router = useRouter();
  const profile = useAuthSTORE(state => state.profile);
  const account = useAccountMode();
  const showModes = account.modes.length > 1 || account.canBecome;
  const roleLabel = account.mode ? MODE_NAMES[account.mode] : (profile?.role ?? 'Student');
  const chooseMode = (next: AccountMode) => {
    account.setMode(next);
    router.push(homeForMode(next));
  };
  return (
    <AccountMenu
      name={profile?.displayName || profile?.name || email || 'User'}
      email={email || profile?.email || ''}
      roleLabel={roleLabel}
      staffHome={Boolean(resolveStaffRole(profile))}
      modes={account.modes}
      activeMode={account.mode}
      onSwitchMode={showModes ? chooseMode : undefined}
      onBecomeInstructor={account.canBecome ? () => router.push('/dashboard/student/become-instructor') : undefined}
    >
      <span className="flex items-center gap-2.5 rounded-xl bg-[var(--studio-surface)] px-2.5 py-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#3FE0D0] text-[10px] font-bold text-[#203337]">
          {(email || 'U').slice(0, 2).toUpperCase()}
        </span>
        <span className="truncate text-xs text-[var(--studio-dim)]">{email}</span>
      </span>
    </AccountMenu>
  );
}

export function ShellSidebar({
  open,
  onClose,
  place,
  email,
  newLabel,
  onNew,
  beforeTools,
  afterTools,
  recents,
  suppressActive = false,
  modeControl,
}: {
  open: boolean;
  onClose: () => void;
  place: 'dashboard' | 'public';
  email?: string;
  newLabel: string;
  onNew: () => void;
  beforeTools?: ReactNode;
  afterTools?: ReactNode;
  recents?: ReactNode;
  suppressActive?: boolean;
  modeControl?: (tool: SidebarTool) => ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const profile = useAuthSTORE(state => state.profile);
  const tools = sidebarTools(profile, place);
  const active = suppressActive ? null : activeSidebarId(pathname, tools);
  const home = dashboardHomeHref(profile?.role);
  const primary = tools.filter(tool => tool.placement === 'primary');
  const list = tools.filter(tool => tool.placement !== 'primary');
  const childTools = (id: string) => list.filter(tool => tool.parentId === id);
  const roots = list.filter(tool => !tool.parentId || !list.some(item => item.id === tool.parentId));
  const renderTool = (tool: SidebarTool, nested = false) => {
    if (tool.mode && modeControl) return <div key={tool.id}>{modeControl(tool)}</div>;
    const current = active === tool.id;
    const className = `${current ? SHELL_ACTIVE : SHELL_LINK}${nested ? ' ps-9' : ''}`;
    return (
      <div key={tool.id}>
        <Link
          href={tool.href}
          onClick={onClose}
          aria-current={current ? 'page' : undefined}
          data-studio-entry={tool.entry}
          data-studio-placement={tool.placement}
          data-studio-subitem={nested ? tool.id : undefined}
          className={className}
        >
          {tool.placement === 'primary' ? <StudioDot active={current} /> : null}
          <ToolGlyph name={tool.icon} />
          <span className="min-w-0 truncate">{tool.label}</span>
        </Link>
        {childTools(tool.id).map(child => renderTool(child, true))}
      </div>
    );
  };
  return (
    <aside
      aria-label="ET AI Studio"
      data-studio-sidebar="1"
      className={`${open ? 'flex' : 'hidden'} absolute inset-y-0 start-0 z-40 h-full min-h-0 w-[min(264px,86vw)] shrink-0 flex-col overflow-hidden border-e border-[var(--studio-border-soft)] bg-[var(--studio-sidebar)] shadow-xl lg:static lg:flex lg:shadow-none`}
    >
      <div className="shrink-0 p-3">
        <Link href={place === 'dashboard' ? '/dashboard/studio' : '/'} className="mb-1 flex items-center gap-2.5 px-2 py-2" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3FE0D0]">
            <Asterisk className="h-5 w-5 text-[#203337]" />
          </div>
          <div>
            <p className="text-[15px] font-bold leading-tight text-[var(--studio-text)]">ET</p>
            <p className="text-[10px] uppercase leading-tight tracking-[0.2em] text-[var(--studio-accent-text)]">AI STUDIO</p>
          </div>
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <nav className="mt-1 space-y-0.5" aria-label="AI Studio">
          <Link href={home} onClick={onClose} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--studio-text)] hover:bg-[var(--studio-surface-hover)]">
            <Home className="h-4 w-4 shrink-0 text-[var(--studio-accent-text)]" aria-hidden /> Dashboard
          </Link>
          <button type="button" onClick={onNew} className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--studio-border)] px-3 py-2.5 text-sm font-semibold text-[var(--studio-text)] hover:bg-[var(--studio-surface-hover)]">
            <Plus className="h-4 w-4 shrink-0 text-[var(--studio-accent-text)]" aria-hidden /> {newLabel}
          </button>
          {beforeTools ?? <StudioShortcuts onClose={onClose} />}
          <div data-studio-primary="1" className="space-y-0.5">{primary.map(renderTool)}</div>
          <p className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--studio-faint)]">Recents</p>
          <div className="space-y-0.5">{recents}</div>
          <p className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--studio-faint)]">Tools</p>
          <div data-studio-tools="list" className="space-y-0.5">
            {roots.map(tool => renderTool(tool))}
            {afterTools}
          </div>
        </nav>
      </div>
      <div className="shrink-0 space-y-1 border-t border-[var(--studio-border-soft)] p-3">
        {email ? <ShellAccount email={email} /> : (
          <Link href="/login" className="flex items-center gap-2 px-2.5 py-2 text-xs text-[var(--studio-dim)] hover:text-[var(--studio-text)]">
            <UserIcon className="h-3.5 w-3.5" /> Sign in to save
          </Link>
        )}
        <Link href={safelineHref(profile?.role)} className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--studio-dim)] transition-colors hover:text-[var(--studio-text)]">
          <Phone className="h-3.5 w-3.5" aria-hidden /> Poket SafeLine
        </Link>
        <Link href="/dashboard/helpdesk" className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--studio-dim)] transition-colors hover:text-[var(--studio-text)]">
          <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Help Center
        </Link>
        <Link href="/" className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--studio-faint)] transition-colors hover:text-[var(--studio-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Poket School
        </Link>
      </div>
    </aside>
  );
}

function useShellOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return { open, setOpen };
}

export function shellLight(resolvedTheme: string | undefined): boolean {
  return resolvedTheme === 'light';
}

function ShellFrame({
  children,
  fill,
  place,
  email,
  newLabel,
  onNew,
  beforeTools,
  afterTools,
  recents,
  modeControl,
}: {
  children: ReactNode;
  fill: 'viewport' | 'parent';
  place: 'dashboard' | 'public';
  email?: string;
  newLabel: string;
  onNew: () => void;
  beforeTools?: ReactNode;
  afterTools?: ReactNode;
  recents?: ReactNode;
  modeControl?: (tool: SidebarTool) => ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [light, setLight] = useState(false);
  useEffect(() => {
    if (resolvedTheme === 'light' || resolvedTheme === 'dark') {
      setLight(shellLight(resolvedTheme));
      return;
    }
    setLight(document.documentElement.classList.contains('light'));
  }, [resolvedTheme]);
  const { open, setOpen } = useShellOpen();
  const frame = fill === 'viewport' ? 'fixed inset-0 z-[80] h-dvh' : 'h-full min-h-0 w-full';
  return (
    <div
      className={`relative flex overflow-hidden bg-[var(--studio-bg)] text-[var(--studio-text)] ${frame}`}
      style={studioCssVars(light)}
      data-studio-layout={light ? 'light' : 'dark'}
      data-studio-theme={light ? 'light' : 'dark'}
      data-tool-shell="1"
    >
      <ShellSidebar
        open={open}
        onClose={() => setOpen(false)}
        place={place}
        email={email}
        newLabel={newLabel}
        onNew={onNew}
        beforeTools={beforeTools}
        afterTools={afterTools}
        recents={recents}
        modeControl={modeControl}
      />
      {open ? <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--studio-border-soft)] px-2 py-1">
          <button type="button" className="grid h-9 w-9 place-items-center text-[var(--studio-dim)] lg:hidden" aria-label="Open ET AI menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="ms-auto min-w-0">
            <ShellEssentials />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ToolShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const userEmail = useAuthSTORE(state => state.user?.email);
  const profile = useAuthSTORE(state => state.profile);
  const book = pathname.startsWith('/reads/studio') || pathname.startsWith('/dashboard/admin/books');
  const onNew = () => {
    if (book) {
      document.querySelector<HTMLButtonElement>('[data-new-book="1"]')?.click();
      return;
    }
    const session = document.querySelector<HTMLButtonElement>('[aria-label="New session"]');
    if (session && pathname.includes('/teachers/')) {
      session.click();
      return;
    }
    router.push('/dashboard/studio');
  };
  return (
    <ShellFrame
      fill="parent"
      place="dashboard"
      email={userEmail || profile?.email || undefined}
      newLabel={book ? 'New book' : 'New chat'}
      onNew={onNew}
      afterTools={(
        <Link href="/dashboard/studio?view=tools" className={SHELL_LINK}>
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> All tools
        </Link>
      )}
    >
      {children}
    </ShellFrame>
  );
}

/** Public tool pages sit outside the dashboard layout. */
export function PublicToolShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const userEmail = useAuthSTORE(state => state.user?.email);
  const book = pathname.startsWith('/reads/studio');
  return (
    <ShellFrame
      fill="viewport"
      place="public"
      email={userEmail || undefined}
      newLabel={book ? 'New book' : 'New chat'}
      onNew={() => {
        if (book) {
          document.querySelector<HTMLButtonElement>('[data-new-book="1"]')?.click();
          return;
        }
        router.push('/dashboard/studio');
      }}
      afterTools={(
        <Link href="/dashboard/studio?view=tools" className={SHELL_LINK}>
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> All tools
        </Link>
      )}
    >
      {children}
    </ShellFrame>
  );
}

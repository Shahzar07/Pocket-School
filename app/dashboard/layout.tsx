'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import {
  Loader2, Menu, Home, BookOpen, Clock, Activity, MessageSquare,
  ClipboardList, Presentation, Shield, BarChart, Settings, FileText, KeyRound, ChevronsUpDown,
  CheckCircle, Video, Calendar, Megaphone, Library, HelpCircle,
  CreditCard, FileBarChart, AlertTriangle, ListTodo, PenSquare,
  GraduationCap, Users, Star, Award, ClipboardCheck, UserCircle, ShieldCheck, X,
  Sparkles, Store, Layers, LogOut, Mail, UserCog,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AITutor } from '@/components/ai-tutor';
import { NotificationsBell } from '@/components/notifications-bell';
import { DashboardSearch } from '@/components/dashboard-search';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SparksChip } from '@/components/sparks-chip';
import { upsertUserSession, accountStatusOf } from '@/lib/db';
import { PipGuide } from '@/components/pip-guide';
import type { TourRole } from '@/lib/tour-steps';
import { ROLE_LABELS } from '@/lib/roles';
import Link from 'next/link';

type Role = 'student' | 'teacher' | 'parent' | 'admin';

const ROLE_ACCENT: Record<Role, { icon: string; bar: string; chip: string }> = {
  student: { icon: 'text-[#60A5FA]', bar: 'bg-[#60A5FA]', chip: 'from-[#1A73E8] to-[#7C3AED]' },
  teacher: { icon: 'text-emerald-400', bar: 'bg-emerald-400', chip: 'from-emerald-500 to-teal-600' },
  parent:  { icon: 'text-amber-400',  bar: 'bg-amber-400',  chip: 'from-amber-500 to-orange-600' },
  admin:   { icon: 'text-violet-400', bar: 'bg-violet-400', chip: 'from-violet-500 to-fuchsia-600' },
};

interface NavEntry { href: string; icon: React.ElementType; label: string }
interface NavGroup { section?: string; items: NavEntry[] }

const NAV: Record<Role, NavGroup[]> = {
  student: [
    { items: [
      { href: '/dashboard/student', icon: Home, label: 'Dashboard' },
      { href: '/ai-studio', icon: Sparkles, label: 'AI Studio ↗' },
      { href: '/ai-teachers', icon: Users, label: 'AI Teachers ↗' },
      { href: '/dashboard/student/learning', icon: GraduationCap, label: 'My Learning' },
      { href: '/courses', icon: Store, label: 'Marketplace' },
      { href: '/dashboard/student/courses', icon: BookOpen, label: 'My Courses' },
      { href: '/dashboard/student/live', icon: Video, label: 'Live Classes' },
      { href: '/dashboard/messages', icon: MessageSquare, label: 'Messages' },
      { href: '/dashboard/student/achievements', icon: CheckCircle, label: 'Achievements' },
    ]},
    { section: 'Academics', items: [
      { href: '/dashboard/student/assignments', icon: ClipboardList, label: 'Assignments' },
      { href: '/dashboard/student/exams', icon: PenSquare, label: 'Exams' },
      { href: '/dashboard/student/transcript', icon: GraduationCap, label: 'Transcript' },
      { href: '/dashboard/student/attendance', icon: ClipboardCheck, label: 'Attendance' },
      { href: '/dashboard/student/certificates', icon: Award, label: 'Certificates' },
      { href: '/dashboard/student/tasks', icon: ListTodo, label: 'Daily Goals' },
    ]},
    { section: 'Finance', items: [
      { href: '/dashboard/student/billing', icon: CreditCard, label: 'Billing' },
    ]},
    { section: 'School', items: [
      { href: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
      { href: '/dashboard/calendar', icon: Calendar, label: 'Calendar' },
      { href: '/dashboard/resources', icon: Library, label: 'Resources' },
      { href: '/dashboard/helpdesk', icon: HelpCircle, label: 'Helpdesk' },
    ]},
    { section: 'Account', items: [
      { href: '/dashboard/profile', icon: UserCircle, label: 'My Profile' },
    ]},
  ],
  teacher: [
    { items: [
      { href: '/dashboard/teacher', icon: Home, label: 'Overview' },
      { href: '/ai-studio', icon: Sparkles, label: 'AI Studio ↗' },
      { href: '/dashboard/teacher/classes', icon: GraduationCap, label: 'My Classes' },
      { href: '/dashboard/teacher/courses', icon: Presentation, label: 'Courses & Products' },
      { href: '/courses', icon: Store, label: 'Marketplace' },
      { href: '/dashboard/messages', icon: MessageSquare, label: 'Messages' },
      { href: '/dashboard/teacher/analytics', icon: Activity, label: 'Analytics' },
    ]},
    { section: 'Academics', items: [
      { href: '/dashboard/teacher/gradebook', icon: ClipboardList, label: 'Gradebook' },
      { href: '/dashboard/teacher/assignments', icon: FileText, label: 'Assignments' },
      { href: '/dashboard/teacher/exams', icon: PenSquare, label: 'Exam Builder' },
      { href: '/dashboard/teacher/report-cards', icon: FileBarChart, label: 'Report Cards' },
      { href: '/dashboard/teacher/attendance', icon: ClipboardCheck, label: 'Attendance' },
      { href: '/dashboard/teacher/live', icon: Video, label: 'Live Classes' },
      { href: '/dashboard/teacher/integrity', icon: AlertTriangle, label: 'Integrity' },
      { href: '/dashboard/teacher/behaviour', icon: Star, label: 'Behaviour' },
    ]},
    // Billing and Helpdesk are institution-admin responsibilities, not teachers'.
    { section: 'School', items: [
      { href: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
      { href: '/dashboard/calendar', icon: Calendar, label: 'Calendar' },
      { href: '/dashboard/resources', icon: Library, label: 'Resources' },
    ]},
    { section: 'Account', items: [
      { href: '/dashboard/profile', icon: UserCircle, label: 'My Profile' },
    ]},
  ],
  parent: [
    { items: [
      { href: '/dashboard/parent', icon: Home, label: 'Child Progress' },
      { href: '/dashboard/messages', icon: MessageSquare, label: 'Messages' },
      { href: '/ai-studio', icon: Sparkles, label: 'AI Studio ↗' },
      { href: '/courses', icon: Store, label: 'Marketplace' },
      { href: '/dashboard/parent/communications', icon: Mail, label: 'Mailbox' },
      { href: '/dashboard/parent/duedates', icon: Clock, label: 'Due Dates' },
    ]},
    { section: 'School', items: [
      { href: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
      { href: '/dashboard/calendar', icon: Calendar, label: 'Calendar' },
      { href: '/dashboard/helpdesk', icon: HelpCircle, label: 'Helpdesk' },
    ]},
    { section: 'Account', items: [
      { href: '/dashboard/profile', icon: UserCircle, label: 'My Profile' },
    ]},
  ],
  admin: [
    { items: [
      { href: '/dashboard/admin', icon: BarChart, label: 'Analytics' },
      { href: '/ai-studio', icon: Sparkles, label: 'AI Studio ↗' },
      { href: '/dashboard/admin/courses', icon: Presentation, label: 'All Courses' },
      { href: '/dashboard/admin/curriculum', icon: Layers, label: 'Curriculum CMS' },
      { href: '/courses', icon: Store, label: 'Marketplace' },
      { href: '/dashboard/admin/users', icon: UserCog, label: 'Users & Sparks' },
      { href: '/dashboard/admin/institutions', icon: Users, label: 'Institutions' },
      { href: '/dashboard/admin/access', icon: Shield, label: 'Access Config' },
      { href: '/dashboard/admin/allocations', icon: KeyRound, label: 'Allocations' },
      { href: '/dashboard/messages', icon: MessageSquare, label: 'Messages' },
      { href: '/dashboard/admin/settings', icon: Settings, label: 'System Settings' },
      { href: '/dashboard/admin/verifications', icon: ShieldCheck, label: 'Verifications' },
    ]},
    { section: 'Platform', items: [
      { href: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
      { href: '/dashboard/calendar', icon: Calendar, label: 'Calendar' },
      { href: '/dashboard/resources', icon: Library, label: 'Resources' },
      { href: '/dashboard/teacher/billing', icon: CreditCard, label: 'Billing' },
      { href: '/dashboard/helpdesk', icon: HelpCircle, label: 'Helpdesk' },
    ]},
    { section: 'Account', items: [
      { href: '/dashboard/profile', icon: UserCircle, label: 'My Profile' },
    ]},
  ],
};

function isNavActive(href: string, pathname: string): boolean {
  const roots = ['/dashboard/student', '/dashboard/teacher', '/dashboard/parent', '/dashboard/admin'];
  if (roots.includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

const NavItem = ({ entry, role, pathname, onClick, router }: {
  entry: NavEntry; role: Role; pathname: string; onClick: () => void; router: ReturnType<typeof useRouter>;
}) => {
  const active = isNavActive(entry.href, pathname);
  const Icon = entry.icon;

  return (
    <button
      type="button"
      onClick={() => { onClick(); router.push(entry.href); }}
      className={`relative w-full px-3 h-9 rounded-xl flex items-center gap-3 cursor-pointer transition-colors text-left text-[13px] ${
        active
          ? 'bg-muted text-foreground font-semibold shadow-[var(--shadow-card)]'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground font-medium'
      }`}
    >
      {/* Active marker sits in the gutter, as in the reference design. */}
      {active && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
      )}
      <Icon className={`w-[17px] h-[17px] shrink-0 ${active ? 'text-primary' : ''}`} />
      <span className="truncate">{entry.label}</span>
    </button>
  );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuthSTORE();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newDevice, setNewDevice] = useState(false);

  const handleNavClick = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const deviceInfo = `${navigator.userAgent.slice(0, 80)}|${screen.width}x${screen.height}`;
    upsertUserSession(user.uid, deviceInfo).then(isNew => { if (isNew) setNewDevice(true); }).catch(() => {});
  }, [user]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // A suspended account keeps its Firebase session, so without this check a
  // suspended user would carry on using the dashboard until their token expired.
  if (accountStatusOf(profile) === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center card-glow">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 grid place-items-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl text-foreground">Your account is suspended</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Access has been paused by an administrator. If you think this is a mistake, reply to your
            welcome email or contact your school.
          </p>
          <a
            href="mailto:support@poketschool.ai"
            className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-foreground text-background font-bold text-sm"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  const role = (profile.role ?? 'student') as Role;
  const nav = NAV[role] ?? NAV.student;
  const accent = ROLE_ACCENT[role];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar — light, profile-led, grouped ── */}
      <aside data-tour="sidebar" className={`relative bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 shrink-0 ${sidebarOpen ? 'w-[264px]' : 'w-0 opacity-0 overflow-hidden'}`}>

        {/* Who you are, at the top — the reference design leads with identity
            rather than a logo lockup. */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 p-2 -m-2 rounded-2xl hover:bg-muted transition-colors"
          >
            <Avatar className="w-10 h-10 border border-border shrink-0">
              <AvatarImage src={profile.avatarUrl ?? user.photoURL ?? undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground truncate leading-tight">
                {profile.name ?? 'User'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {ROLE_LABELS[role] ?? role}
              </p>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </Link>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto px-3 pb-2 space-y-0.5 [scrollbar-width:thin]">
          {nav.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {group.section && (
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.14em] px-3 pt-5 pb-1.5">
                  {group.section}
                </p>
              )}
              {group.items.map(entry => (
                <NavItem key={entry.href + entry.label} entry={entry} role={role} pathname={pathname} onClick={handleNavClick} router={router} />
              ))}
            </div>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="px-3 py-3 shrink-0 border-t border-sidebar-border">
          <Link
            href="/dashboard/helpdesk"
            className="flex items-center gap-3 px-3 h-9 rounded-xl text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <HelpCircle className="w-[17px] h-[17px] shrink-0" /> Help Center
          </Link>
          <button
            onClick={() => { signOut(auth).then(() => { useAuthSTORE.getState().setUser(null); router.push('/login'); }); }}
            className="w-full flex items-center gap-3 px-3 h-9 rounded-xl text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-[17px] h-[17px] shrink-0" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-[72px] bg-background/80 backdrop-blur-xl flex items-center justify-between gap-4 px-4 lg:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
              <Menu className="w-5 h-5 text-muted-foreground" />
            </Button>
            <PipGuide role={role as TourRole} />
            <span data-tour="search"><DashboardSearch /></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span data-tour="sparks"><SparksChip /></span>
            <span data-tour="language"><LanguageSwitcher /></span>
            <span data-tour="notifications"><NotificationsBell /></span>
            <button onClick={() => router.push('/dashboard/profile')} className="ml-1" data-tour="profile">
              <Avatar className="w-9 h-9 border-2 border-border cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                <AvatarImage src={profile.avatarUrl ?? user.photoURL ?? undefined} />
                <AvatarFallback className="bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] text-white text-sm font-bold">
                  {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </header>

        {/* New device warning banner */}
        {newDevice && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 text-sm text-amber-700 dark:text-amber-400 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>New device detected.</strong> If this wasn't you, change your password immediately in My Profile.</span>
            </div>
            <button onClick={() => setNewDevice(false)} className="text-amber-600 hover:text-amber-800 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Main with ambient gradient wash */}
        <main className="flex-1 overflow-y-auto relative">
          {/* A faint teal wash at the top, echoing the homepage sky. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(39,134,164,0.06)_0%,transparent_100%)]" />
          <div className="relative px-4 pb-6 pt-1 lg:px-6 lg:pb-10">
            {children}
          </div>
        </main>
      </div>

      <AITutor />
    </div>
  );
}

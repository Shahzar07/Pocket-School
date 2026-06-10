'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import {
  Loader2, Menu, Home, BookOpen, Clock, Activity, MessageSquare,
  ClipboardList, Presentation, Shield, BarChart, Settings, FileText,
  CheckCircle, Video, Calendar, Megaphone, Library, HelpCircle,
  CreditCard, FileBarChart, AlertTriangle, ListTodo, PenSquare,
  GraduationCap, Users, Star, Award, ClipboardCheck, UserCircle, ShieldCheck, X,
  Sparkles, Store, Layers, LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AITutor } from '@/components/ai-tutor';
import { NotificationsBell } from '@/components/notifications-bell';
import { DashboardSearch } from '@/components/dashboard-search';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SparksChip } from '@/components/sparks-chip';
import { upsertUserSession } from '@/lib/db';
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
      { href: '/dashboard/student/achievements', icon: CheckCircle, label: 'Achievements' },
    ]},
    { section: 'Academics', items: [
      { href: '/dashboard/student/assignments', icon: ClipboardList, label: 'Assignments' },
      { href: '/dashboard/student/exams', icon: PenSquare, label: 'Exams' },
      { href: '/dashboard/student/transcript', icon: GraduationCap, label: 'Transcript' },
      { href: '/dashboard/student/attendance', icon: ClipboardCheck, label: 'Attendance' },
      { href: '/dashboard/student/certificates', icon: Award, label: 'Certificates' },
      { href: '/dashboard/student/tasks', icon: ListTodo, label: 'My Tasks' },
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
    { section: 'Finance', items: [
      { href: '/dashboard/teacher/billing', icon: CreditCard, label: 'Billing' },
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
  parent: [
    { items: [
      { href: '/dashboard/parent', icon: Home, label: 'Child Progress' },
      { href: '/ai-studio', icon: Sparkles, label: 'AI Studio ↗' },
      { href: '/courses', icon: Store, label: 'Marketplace' },
      { href: '/dashboard/parent/communications', icon: MessageSquare, label: 'Communications' },
      { href: '/dashboard/parent/duedates', icon: Clock, label: 'Due Dates' },
      { href: '/dashboard/student/attendance', icon: ClipboardCheck, label: 'Child Attendance' },
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
      { href: '/dashboard/admin/institutions', icon: Users, label: 'Institutions' },
      { href: '/dashboard/admin/access', icon: Shield, label: 'Access Config' },
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
  const accent = ROLE_ACCENT[role];
  const active = isNavActive(entry.href, pathname);
  const Icon = entry.icon;

  return (
    <button
      type="button"
      onClick={() => { onClick(); router.push(entry.href); }}
      className={`relative w-full px-3 py-[9px] rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 text-left text-[13px] group ${
        active
          ? 'bg-white/[0.07] text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] font-medium'
      }`}
    >
      {active && <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full ${accent.bar} shadow-[0_0_8px_currentColor]`} />}
      <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? accent.icon : 'text-slate-500 group-hover:text-slate-300'}`} />
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

  const role = (profile.role ?? 'student') as Role;
  const nav = NAV[role] ?? NAV.student;
  const accent = ROLE_ACCENT[role];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar — dark glass ── */}
      <aside className={`relative bg-[#070B14] flex flex-col transition-all duration-300 shrink-0 ${sidebarOpen ? 'w-[270px]' : 'w-0 opacity-0 overflow-hidden'}`}>
        {/* ambient glow inside sidebar */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#1A73E8]/10 blur-[90px]" />
          <div className="absolute bottom-0 -right-20 w-64 h-64 rounded-full bg-[#7C3AED]/10 blur-[90px]" />
        </div>
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-white/[0.08]" />

        {/* Logo */}
        <div className="relative h-[68px] flex items-center px-5 shrink-0">
          <Link href={`/dashboard/${role}`} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] flex items-center justify-center shadow-[0_0_24px_rgba(26,115,232,0.45)] shrink-0">
              <Sparkles className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="leading-none">
              <span className="font-heading text-xl text-white tracking-tight block">Pocket School</span>
              <span className={`inline-block mt-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/90 bg-gradient-to-r ${accent.chip} px-2 py-[3px] rounded-full`}>
                {role} portal
              </span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]">
          {nav.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {group.section && (
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] px-3 pt-5 pb-1.5">{group.section}</p>
              )}
              {group.items.map(entry => (
                <NavItem key={entry.href + entry.label} entry={entry} role={role} pathname={pathname} onClick={handleNavClick} router={router} />
              ))}
            </div>
          ))}
        </nav>

        {/* User card + logout */}
        <div className="relative px-3 py-3 shrink-0">
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <Avatar className="w-9 h-9 border border-white/10 shrink-0">
                <AvatarImage src={profile.avatarUrl ?? user.photoURL ?? undefined} />
                <AvatarFallback className={`bg-gradient-to-br ${accent.chip} text-white text-xs font-bold`}>
                  {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{profile.name ?? 'User'}</p>
                <p className="text-[11px] text-slate-500 truncate capitalize">{role}</p>
              </div>
              <button
                onClick={() => { signOut(auth).then(() => { useAuthSTORE.getState().setUser(null); router.push('/login'); }); }}
                className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-center text-slate-600 mt-2.5">© 2026 Pocket School</p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-[68px] bg-background/70 backdrop-blur-xl border-b border-border/60 flex items-center justify-between px-4 lg:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5 text-muted-foreground" />
            </Button>
            <DashboardSearch />
          </div>
          <div className="flex items-center gap-1.5">
            <SparksChip />
            <LanguageSwitcher />
            <NotificationsBell />
            <button onClick={() => router.push('/dashboard/profile')} className="ml-1">
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
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(58%_100%_at_50%_0%,rgba(26,115,232,0.07)_0%,rgba(124,58,237,0.04)_45%,transparent_100%)]" />
          <div className="relative p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <AITutor />
    </div>
  );
}

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

const NavItem = ({ href, icon: Icon, label, activeBgClass, activeTextClass, pathname, onClick, router }: {
  href: string; icon: React.ElementType; label: string; activeBgClass: string;
  activeTextClass: string; pathname: string; onClick: () => void; router: ReturnType<typeof useRouter>;
}) => {
  const isActive = pathname === href || pathname.startsWith(href + '/') && href !== '/dashboard/student' && href !== '/dashboard/teacher' && href !== '/dashboard/parent' && href !== '/dashboard/admin';
  const exactActive = pathname === href;
  const active = href.includes('/dashboard/student') || href.includes('/dashboard/teacher') || href.includes('/dashboard/parent') || href.includes('/dashboard/admin')
    ? (href.split('/').length > 3 ? (pathname === href || pathname.startsWith(href + '/')) : exactActive)
    : isActive;

  const activeClass = active
    ? `${activeBgClass} ${activeTextClass} font-semibold shadow-sm`
    : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium';

  return (
    <button
      type="button"
      onClick={() => { onClick(); router.push(href); }}
      className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-all text-left text-sm ${activeClass}`}
    >
      <Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{label}</span>
    </button>
  );
};

const NavSection = ({ label }: { label: string }) => (
  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider px-3 pt-4 pb-1">{label}</p>
);

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

  const navProps = { pathname, onClick: handleNavClick, router };
  const sB = 'bg-primary/10'; const sT = 'text-primary';                    // student
  const tB = 'bg-emerald-500/10'; const tT = 'text-emerald-600';            // teacher
  const pB = 'bg-amber-500/10'; const pT = 'text-amber-600';                // parent
  const aB = 'bg-foreground'; const aT = 'text-background';                 // admin

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`bg-card border-r border-border flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 opacity-0 overflow-hidden shrink-0'}`}>
        <div className="h-16 flex items-center px-5 border-b border-border shrink-0">
          <Link href={`/dashboard/${profile.role}`} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1A73E8] via-[#3B82F6] to-[#7C3AED] flex items-center justify-center shadow-[0_0_16px_rgba(26,115,232,0.3)] shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">Pocket School</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider px-3 pt-2 pb-1 capitalize">{profile.role} Portal</p>

          {/* ── Student ── */}
          {profile.role === 'student' && (
            <>
              <NavItem href="/dashboard/student" icon={Home} label="Dashboard" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/ai-studio" icon={Sparkles} label="AI Studio ↗" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/ai-teachers" icon={Users} label="AI Teachers ↗" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/learning" icon={GraduationCap} label="My Learning" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/courses" icon={Store} label="Marketplace" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/courses" icon={BookOpen} label="My Courses" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/live" icon={Video} label="Live Classes" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/achievements" icon={CheckCircle} label="Achievements" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavSection label="Academics" />
              <NavItem href="/dashboard/student/assignments" icon={ClipboardList} label="Assignments" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/exams" icon={PenSquare} label="Exams" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/transcript" icon={GraduationCap} label="Transcript" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/attendance" icon={ClipboardCheck} label="Attendance" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/certificates" icon={Award} label="Certificates" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/student/tasks" icon={ListTodo} label="My Tasks" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavSection label="Finance" />
              <NavItem href="/dashboard/student/billing" icon={CreditCard} label="Billing" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavSection label="School" />
              <NavItem href="/dashboard/announcements" icon={Megaphone} label="Announcements" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/calendar" icon={Calendar} label="Calendar" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/resources" icon={Library} label="Resources" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavItem href="/dashboard/helpdesk" icon={HelpCircle} label="Helpdesk" activeBgClass={sB} activeTextClass={sT} {...navProps} />
              <NavSection label="Account" />
              <NavItem href="/dashboard/profile" icon={UserCircle} label="My Profile" activeBgClass={sB} activeTextClass={sT} {...navProps} />
            </>
          )}

          {/* ── Teacher ── */}
          {profile.role === 'teacher' && (
            <>
              <NavItem href="/dashboard/teacher" icon={Home} label="Overview" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/ai-studio" icon={Sparkles} label="AI Studio ↗" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/classes" icon={GraduationCap} label="My Classes" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/courses" icon={Presentation} label="Courses & Products" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/courses" icon={Store} label="Marketplace" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/analytics" icon={Activity} label="Analytics" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavSection label="Academics" />
              <NavItem href="/dashboard/teacher/gradebook" icon={ClipboardList} label="Gradebook" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/assignments" icon={FileText} label="Assignments" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/exams" icon={PenSquare} label="Exam Builder" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/report-cards" icon={FileBarChart} label="Report Cards" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/attendance" icon={ClipboardCheck} label="Attendance" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/integrity" icon={AlertTriangle} label="Integrity" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/teacher/behaviour" icon={Star} label="Behaviour" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavSection label="Finance" />
              <NavItem href="/dashboard/teacher/billing" icon={CreditCard} label="Billing" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavSection label="School" />
              <NavItem href="/dashboard/announcements" icon={Megaphone} label="Announcements" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/calendar" icon={Calendar} label="Calendar" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/resources" icon={Library} label="Resources" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavItem href="/dashboard/helpdesk" icon={HelpCircle} label="Helpdesk" activeBgClass={tB} activeTextClass={tT} {...navProps} />
              <NavSection label="Account" />
              <NavItem href="/dashboard/profile" icon={UserCircle} label="My Profile" activeBgClass={tB} activeTextClass={tT} {...navProps} />
            </>
          )}

          {/* ── Parent ── */}
          {profile.role === 'parent' && (
            <>
              <NavItem href="/dashboard/parent" icon={Home} label="Child Progress" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavItem href="/ai-studio" icon={Sparkles} label="AI Studio ↗" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavItem href="/courses" icon={Store} label="Marketplace" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavItem href="/dashboard/parent/communications" icon={MessageSquare} label="Communications" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavItem href="/dashboard/parent/duedates" icon={Clock} label="Due Dates" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavItem href="/dashboard/student/attendance" icon={ClipboardCheck} label="Child Attendance" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavSection label="School" />
              <NavItem href="/dashboard/announcements" icon={Megaphone} label="Announcements" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavItem href="/dashboard/calendar" icon={Calendar} label="Calendar" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavItem href="/dashboard/helpdesk" icon={HelpCircle} label="Helpdesk" activeBgClass={pB} activeTextClass={pT} {...navProps} />
              <NavSection label="Account" />
              <NavItem href="/dashboard/profile" icon={UserCircle} label="My Profile" activeBgClass={pB} activeTextClass={pT} {...navProps} />
            </>
          )}

          {/* ── Admin ── */}
          {profile.role === 'admin' && (
            <>
              <NavItem href="/dashboard/admin" icon={BarChart} label="Analytics" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/ai-studio" icon={Sparkles} label="AI Studio ↗" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/admin/courses" icon={Presentation} label="All Courses" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/admin/curriculum" icon={Layers} label="Curriculum CMS" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/courses" icon={Store} label="Marketplace" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/admin/institutions" icon={Users} label="Institutions" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/admin/access" icon={Shield} label="Access Config" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/admin/settings" icon={Settings} label="System Settings" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/admin/verifications" icon={ShieldCheck} label="Verifications" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavSection label="Platform" />
              <NavItem href="/dashboard/announcements" icon={Megaphone} label="Announcements" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/calendar" icon={Calendar} label="Calendar" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/resources" icon={Library} label="Resources" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/teacher/billing" icon={CreditCard} label="Billing" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavItem href="/dashboard/helpdesk" icon={HelpCircle} label="Helpdesk" activeBgClass={aB} activeTextClass={aT} {...navProps} />
              <NavSection label="Account" />
              <NavItem href="/dashboard/profile" icon={UserCircle} label="My Profile" activeBgClass={aB} activeTextClass={aT} {...navProps} />
            </>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="px-3 py-3 border-t border-border shrink-0">
          <button
            onClick={() => { signOut(auth).then(() => { useAuthSTORE.getState().setUser(null); router.push('/login'); }); }}
            className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-colors text-red-500 hover:bg-red-500/10 font-medium text-sm"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </button>
          <p className="text-[10px] text-center text-muted-foreground/60 mt-2">© 2026 Pocket School. All rights reserved.</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5 text-muted-foreground" />
            </Button>
            <DashboardSearch />
          </div>
          <div className="flex items-center gap-2">
            <SparksChip />
            <LanguageSwitcher />
            <NotificationsBell />
            <button onClick={() => router.push('/dashboard/profile')}>
              <Avatar className="w-9 h-9 border border-border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                <AvatarImage src={profile.avatarUrl ?? user.photoURL ?? undefined} />
                <AvatarFallback>{profile.name?.charAt(0) ?? 'U'}</AvatarFallback>
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

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 relative">
          {children}
        </main>
      </div>

      <AITutor />
    </div>
  );
}

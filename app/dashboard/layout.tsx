'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import {
  Loader2, Menu, Home, BookOpen, Clock, Activity, MessageSquare,
  ClipboardList, Presentation, Shield, BarChart, Settings, FileText, KeyRound, ChevronsUpDown, Target,
  CheckCircle, Video, Calendar, Megaphone, Library, HelpCircle,
  CreditCard, FileBarChart, AlertTriangle, ListTodo, PenSquare,
  GraduationCap, Users, Star, Award, ClipboardCheck, UserCircle, ShieldCheck, X,
  Sparkles, Store, Layers, LogOut, Mail, UserCog, BookMarked, Compass, Camera, Newspaper,
  Wallet, Gift, Landmark, Plug, PieChart, Search,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
const AITutor = dynamic(() => import('@/components/ai-tutor').then(mod => mod.AITutor), { ssr: false });
import { NotificationsBell } from '@/components/notifications-bell';
import { DashboardSearch } from '@/components/dashboard-search';
import { LanguageSwitcher } from '@/components/language-switcher';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { SparksChip } from '@/components/sparks-chip';
import { upsertUserSession, accountStatusOf, clearUserFields, updateUser } from '@/lib/db';
import { deletionClosed, formatDeletionDate, sessionRevoked } from '@/lib/account-settings';
import { AccountMenu } from '@/components/account/account-menu';
import { ModeSwitch } from '@/components/account/mode-switch';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { ModuleHeader } from '@/components/module-header';
import { MobileNav } from '@/components/shell/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAccountMode } from '@/hooks/use-account-mode';
import { homeForMode, learnerSpaceRoles, modeRedirect, MODE_NAMES, type AccountMode } from '@/lib/account-modes';
import { ACCESS_DENIED_MESSAGE, decideDashboardAccess } from '@/lib/dashboard-access';
import { loginBlocked, resolveStaffRole } from '@/lib/admin-console';
import { reportActivity } from '@/lib/audit/report';
import { adminMfaPending } from '@/lib/admin-mfa-pending';
import { AdminViewAsBanner, clearViewAs, useAdminIdle, useViewAs } from '@/components/admin-session';
import { isSuperAdmin, ROLE_LABELS } from '@/lib/roles';
import { PipGuide } from '@/components/pip-guide';
import { OfflineBanner } from '@/components/offline-banner';
import { RoleChecklist } from '@/components/role-checklist';
import { PagePurpose } from '@/components/page-purpose';
import dynamic from 'next/dynamic';
import type { TourRole } from '@/lib/tour-steps';
import { hasCmsAddon } from '@/lib/entitlements';
import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AcademySession } from '@/components/academy-session';

type Role = 'student' | 'teacher' | 'parent' | 'admin' | 'institution_admin';

const ROLE_ACCENT: Record<Role, { icon: string; bar: string; chip: string }> = {
  student: { icon: 'text-primary', bar: 'bg-primary', chip: 'from-primary to-primary' },
  teacher: { icon: 'text-emerald-400', bar: 'bg-emerald-400', chip: 'from-emerald-500 to-teal-600' },
  parent:  { icon: 'text-amber-400',  bar: 'bg-amber-400',  chip: 'from-amber-500 to-orange-600' },
  admin:   { icon: 'text-violet-400', bar: 'bg-violet-400', chip: 'from-violet-500 to-fuchsia-600' },
  institution_admin: { icon: 'text-sky-400', bar: 'bg-sky-400', chip: 'from-sky-500 to-cyan-600' },
};

interface NavEntry { href: string; icon: React.ElementType; labelKey: string; label?: string; flag?: FeatureFlag; superOnly?: boolean }
interface NavGroup { sectionKey?: string; sectionLabel?: string; items: NavEntry[] }

const NAV: Record<Role, NavGroup[]> = {
  student: [
    { items: [
      { href: '/dashboard/student', icon: Home, labelKey: 'nav.dashboard' },
      { href: '/dashboard/studio', icon: Sparkles, labelKey: 'nav.aiStudio' },
      { href: '/ai-teachers', icon: Users, labelKey: 'nav.aiTeachers' },
      { href: '/dashboard/student/learning', icon: GraduationCap, labelKey: 'nav.myLearning' },
      { href: '/courses', icon: Store, labelKey: 'nav.marketplace' },
      { href: '/reads', icon: BookMarked, labelKey: 'nav.books' },
      { href: '/dashboard/student/courses', icon: BookOpen, labelKey: 'nav.myCourses' },
      { href: '/dashboard/student/live', icon: Video, labelKey: 'nav.liveClasses' },
      { href: '/dashboard/messages', icon: MessageSquare, labelKey: 'nav.messages' },
      { href: '/dashboard/student/achievements', icon: CheckCircle, labelKey: 'nav.achievements' },
    ]},
    { sectionKey: 'nav.section.academics', items: [
      { href: '/dashboard/student/assignments', icon: ClipboardList, labelKey: 'nav.assignments' },
      { href: '/dashboard/student/exams', icon: PenSquare, labelKey: 'nav.exams' },
      { href: '/dashboard/student/transcript', icon: GraduationCap, labelKey: 'nav.transcript' },
      { href: '/dashboard/student/attendance', icon: ClipboardCheck, labelKey: 'nav.attendance' },
      { href: '/dashboard/student/certificates', icon: Award, labelKey: 'nav.certificates' },
      { href: '/dashboard/student/tasks', icon: ListTodo, labelKey: 'nav.dailyGoals' },
      { href: '/dashboard/student/analytics', icon: Activity, labelKey: 'nav.insights' },
      { href: '/dashboard/behaviour', icon: Star, labelKey: 'nav.behaviour' },
      { href: '/dashboard/student/integrity', icon: Shield, labelKey: 'nav.integrity' },
      { href: '/dashboard/reports', icon: FileBarChart, labelKey: 'nav.reports' },
    ]},
    { sectionKey: 'nav.section.finance', items: [
      { href: '/dashboard/student/billing', icon: CreditCard, labelKey: 'nav.billing' },
      { href: '/dashboard/wallet', icon: Wallet, labelKey: 'nav.wallet' },
      { href: '/dashboard/referrals', icon: Gift, labelKey: 'nav.referrals' },
    ]},
    { sectionKey: 'nav.section.community', items: [
      { href: '/dashboard/community', icon: Compass, labelKey: 'nav.community', flag: 'community' },
      { href: '/dashboard/network', icon: Users, labelKey: 'nav.community', label: 'Network' },
      { href: '/dashboard/tutors', icon: Users, labelKey: 'nav.tutors', flag: 'tutorMarketplace' },
      { href: '/dashboard/exam-centre', icon: PenSquare, labelKey: 'nav.examCentre', flag: 'examCentre' },
      { href: '/dashboard/store', icon: Library, labelKey: 'nav.creatorStore', flag: 'creatorStore' },
      { href: '/dashboard/studio/maths', icon: Camera, labelKey: 'nav.snapSolve', label: 'ET Maths', flag: 'snapAndSolve' },
    ]},
    { sectionKey: 'nav.section.school', items: [
      { href: '/dashboard/announcements', icon: Megaphone, labelKey: 'nav.announcements' },
      { href: '/dashboard/calendar', icon: Calendar, labelKey: 'nav.calendar', label: 'Calendar & terms' },
      { href: '/dashboard/resources', icon: Library, labelKey: 'nav.resources' },
      { href: '/dashboard/helpdesk', icon: HelpCircle, labelKey: 'nav.helpdesk' },
    ]},
    { sectionKey: 'nav.section.account', items: [
      { href: '/dashboard/profile', icon: UserCircle, labelKey: 'nav.myProfile' },
    ]},
  ],
  teacher: [
    { items: [
      { href: '/dashboard/teacher', icon: Home, labelKey: 'nav.overview' },
      { href: '/dashboard/studio', icon: Sparkles, labelKey: 'nav.aiStudio' },
      { href: '/dashboard/teacher/classes', icon: GraduationCap, labelKey: 'nav.myClasses' },
      { href: '/dashboard/teacher/courses', icon: Presentation, labelKey: 'nav.coursesProducts' },
      { href: '/courses', icon: Store, labelKey: 'nav.marketplace' },
      { href: '/reads', icon: BookMarked, labelKey: 'nav.books' },
      { href: '/dashboard/teacher/earnings', icon: CreditCard, labelKey: 'nav.earnings' },
      { href: '/dashboard/wallet', icon: Wallet, labelKey: 'nav.wallet' },
      { href: '/dashboard/referrals', icon: Gift, labelKey: 'nav.referrals' },
      { href: '/dashboard/messages', icon: MessageSquare, labelKey: 'nav.messages' },
      { href: '/dashboard/teacher/analytics', icon: Activity, labelKey: 'nav.analytics' },
      { href: '/dashboard/teacher/insights', icon: BarChart, labelKey: 'nav.insights' },
      { href: '/dashboard/teacher/goals', icon: Target, labelKey: 'nav.goals' },
    ]},
    { sectionKey: 'nav.section.academics', items: [
      { href: '/dashboard/teacher/gradebook', icon: ClipboardList, labelKey: 'nav.gradebook' },
      { href: '/dashboard/teacher/assignments', icon: FileText, labelKey: 'nav.assignments' },
      { href: '/dashboard/teacher/exams', icon: PenSquare, labelKey: 'nav.examBuilder' },
      { href: '/dashboard/teacher/report-cards', icon: FileBarChart, labelKey: 'nav.reportCards' },
      { href: '/dashboard/teacher/report-studio', icon: FileText, labelKey: 'nav.reportStudio' },
      { href: '/dashboard/teacher/attendance', icon: ClipboardCheck, labelKey: 'nav.attendance' },
      { href: '/dashboard/teacher/live', icon: Video, labelKey: 'nav.liveClasses' },
      { href: '/dashboard/teacher/integrity', icon: AlertTriangle, labelKey: 'nav.integrity' },
      { href: '/dashboard/teacher/integrity/cases', icon: Shield, labelKey: 'nav.integrityCases' },
      { href: '/dashboard/reports', icon: FileBarChart, labelKey: 'nav.reports' },
      { href: '/dashboard/behaviour', icon: Star, labelKey: 'nav.behaviour' },
      { href: '/dashboard/teacher/behaviour', icon: Star, labelKey: 'nav.merits' },
    ]},
    // Billing and Helpdesk are institution-admin responsibilities, not teachers'.
    { sectionKey: 'nav.section.community', items: [
      { href: '/dashboard/community', icon: Compass, labelKey: 'nav.community', flag: 'community' },
      { href: '/dashboard/network', icon: Users, labelKey: 'nav.community', label: 'Network' },
      { href: '/dashboard/tutors', icon: Users, labelKey: 'nav.tutors', flag: 'tutorMarketplace' },
      { href: '/dashboard/exam-centre', icon: PenSquare, labelKey: 'nav.examCentre', flag: 'examCentre' },
      { href: '/dashboard/store', icon: Library, labelKey: 'nav.creatorStore', flag: 'creatorStore' },
    ]},
    { sectionKey: 'nav.section.school', items: [
      { href: '/dashboard/announcements', icon: Megaphone, labelKey: 'nav.announcements' },
      { href: '/dashboard/calendar', icon: Calendar, labelKey: 'nav.calendar', label: 'Calendar & terms' },
      { href: '/dashboard/resources', icon: Library, labelKey: 'nav.resources' },
    ]},
    { sectionKey: 'nav.section.account', items: [
      { href: '/dashboard/profile', icon: UserCircle, labelKey: 'nav.myProfile' },
    ]},
  ],
  parent: [
    { items: [
      { href: '/dashboard/parent', icon: Home, labelKey: 'nav.childProgress' },
      { href: '/dashboard/parent#certificates', icon: Award, labelKey: 'nav.certificates' },
      { href: '/dashboard/messages', icon: MessageSquare, labelKey: 'nav.messages' },
      { href: '/dashboard/studio', icon: Sparkles, labelKey: 'nav.aiStudio' },
      { href: '/courses', icon: Store, labelKey: 'nav.marketplace' },
      { href: '/reads', icon: BookMarked, labelKey: 'nav.books' },
      { href: '/dashboard/parent/communications', icon: Mail, labelKey: 'nav.mailbox' },
      { href: '/dashboard/parent/duedates', icon: Clock, labelKey: 'nav.dueDates' },
      { href: '/dashboard/wallet', icon: Wallet, labelKey: 'nav.wallet' },
      { href: '/dashboard/referrals', icon: Gift, labelKey: 'nav.referrals' },
      { href: '/dashboard/parent/goals', icon: Target, labelKey: 'nav.goals' },
      { href: '/dashboard/parent/analytics', icon: Activity, labelKey: 'nav.insights' },
      { href: '/dashboard/behaviour', icon: Star, labelKey: 'nav.behaviour' },
      { href: '/dashboard/parent/integrity', icon: Shield, labelKey: 'nav.integrity' },
      { href: '/dashboard/parent/reports', icon: FileBarChart, labelKey: 'nav.reportCards' },
      { href: '/dashboard/reports', icon: FileBarChart, labelKey: 'nav.reports' },
    ]},
    { sectionKey: 'nav.section.family', items: [
      { href: '/dashboard/parent/controls', icon: Shield, labelKey: 'nav.controls', flag: 'community' },
    ]},
    { sectionKey: 'nav.section.school', items: [
      { href: '/dashboard/announcements', icon: Megaphone, labelKey: 'nav.announcements' },
      { href: '/dashboard/calendar', icon: Calendar, labelKey: 'nav.calendar', label: 'Calendar & terms' },
      { href: '/dashboard/helpdesk', icon: HelpCircle, labelKey: 'nav.helpdesk' },
    ]},
    { sectionKey: 'nav.section.account', items: [
      { href: '/dashboard/profile', icon: UserCircle, labelKey: 'nav.myProfile' },
    ]},
  ],
  admin: [
    { items: [
      { href: '/dashboard/admin', icon: BarChart, labelKey: 'nav.analytics' },
      { href: '/dashboard/admin/blog', icon: Newspaper, labelKey: 'nav.blog', label: 'Blog', superOnly: true },
      { href: '/dashboard/studio', icon: Sparkles, labelKey: 'nav.aiStudio' },
      { href: '/dashboard/admin/courses', icon: Presentation, labelKey: 'nav.allCourses' },
      { href: '/dashboard/admin/curriculum', icon: Layers, labelKey: 'nav.curriculumCms' },
      { href: '/dashboard/admin/books', icon: BookOpen, labelKey: 'nav.books', label: 'Book Studio' },
      { href: '/courses', icon: Store, labelKey: 'nav.marketplace' },
      { href: '/reads', icon: BookMarked, labelKey: 'nav.books' },
      { href: '/dashboard/admin/users', icon: UserCog, labelKey: 'nav.usersSparks' },
      { href: '/dashboard/admin/institutions', icon: Users, labelKey: 'nav.institutions' },
      { href: '/dashboard/admin/access', icon: Shield, labelKey: 'nav.accessConfig' },
      { href: '/dashboard/admin/allocations', icon: KeyRound, labelKey: 'nav.allocations' },
      { href: '/dashboard/messages', icon: MessageSquare, labelKey: 'nav.messages' },
      { href: '/dashboard/admin/settings', icon: Settings, labelKey: 'nav.systemSettings' },
      { href: '/dashboard/admin/verifications', icon: ShieldCheck, labelKey: 'nav.verifications' },
      { href: '/dashboard/admin/activity', icon: ClipboardList, labelKey: 'nav.dashboard', label: 'Activity log', superOnly: true },
      { href: '/dashboard/admin/certificates', icon: Award, labelKey: 'nav.certificates', label: 'Certificates' },
      { href: '/dashboard/admin/badges', icon: Award, labelKey: 'nav.certificates', label: 'Badges', superOnly: true },
      { href: '/dashboard/reports', icon: FileBarChart, labelKey: 'nav.reports' },
      { href: '/dashboard/admin/moderation', icon: Shield, labelKey: 'nav.moderation', flag: 'community' },
      { href: '/dashboard/community', icon: Compass, labelKey: 'nav.community', flag: 'community' },
      { href: '/dashboard/network', icon: Users, labelKey: 'nav.community', label: 'Network' },
      { href: '/dashboard/tutors', icon: Users, labelKey: 'nav.tutors', flag: 'tutorMarketplace' },
      { href: '/dashboard/store', icon: Library, labelKey: 'nav.creatorStore', flag: 'creatorStore' },
    ]},
    { sectionKey: 'nav.section.money', items: [
      { href: '/dashboard/admin/payments', icon: Landmark, labelKey: 'nav.payments', superOnly: true },
      { href: '/dashboard/admin/integrations', icon: Plug, labelKey: 'nav.integrations', superOnly: true },
      { href: '/dashboard/admin/finance', icon: PieChart, labelKey: 'nav.finance', superOnly: true },
      { href: '/dashboard/wallet', icon: Wallet, labelKey: 'nav.wallet' },
      { href: '/dashboard/referrals', icon: Gift, labelKey: 'nav.referrals' },
    ]},
    { sectionKey: 'nav.section.platform', items: [
      { href: '/dashboard/announcements', icon: Megaphone, labelKey: 'nav.announcements' },
      { href: '/dashboard/calendar', icon: Calendar, labelKey: 'nav.calendar', label: 'Calendar & terms' },
      { href: '/dashboard/resources', icon: Library, labelKey: 'nav.resources' },
      { href: '/dashboard/teacher/billing', icon: CreditCard, labelKey: 'nav.billing' },
      { href: '/dashboard/helpdesk', icon: HelpCircle, labelKey: 'nav.helpdesk' },
    ]},
    { sectionKey: 'nav.section.account', items: [
      { href: '/dashboard/profile', icon: UserCircle, labelKey: 'nav.myProfile' },
    ]},
  ],
  institution_admin: [
    { items: [
      { href: '/dashboard/institution', icon: GraduationCap, labelKey: 'nav.myClasses' },
      { href: '/dashboard/institution/approvals', icon: ShieldCheck, labelKey: 'nav.approvals', label: 'Approvals' },
      { href: '/dashboard/institution/publishing', icon: Library, labelKey: 'nav.library', label: 'Course library' },
      { href: '/dashboard/institution/sparks', icon: Sparkles, labelKey: 'nav.sparks', label: 'Sparks pool' },
      { href: '/dashboard/institution/billing', icon: CreditCard, labelKey: 'nav.billing', label: 'Billing' },
      { href: '/dashboard/institution/usage', icon: PieChart, labelKey: 'nav.usage', label: 'Usage' },
      { href: '/dashboard/institution/onboarding', icon: ClipboardList, labelKey: 'nav.onboarding', label: 'Onboarding' },
      { href: '/dashboard/admin/institutions', icon: Users, labelKey: 'nav.institutions' },
      { href: '/dashboard/studio', icon: Sparkles, labelKey: 'nav.aiStudio' },
      { href: '/courses', icon: Store, labelKey: 'nav.marketplace' },
      { href: '/reads', icon: BookMarked, labelKey: 'nav.books' },
      { href: '/dashboard/messages', icon: MessageSquare, labelKey: 'nav.messages' },
      { href: '/dashboard/reports', icon: FileBarChart, labelKey: 'nav.reports' },
      { href: '/dashboard/behaviour', icon: Star, labelKey: 'nav.behaviour' },
      { href: '/dashboard/institution/templates', icon: FileText, labelKey: 'nav.reportStudio' },
      { href: '/dashboard/institution/certificates', icon: Award, labelKey: 'nav.certificates', label: 'Certificates' },
    ]},
    { sectionKey: 'nav.section.school', items: [
      { href: '/dashboard/announcements', icon: Megaphone, labelKey: 'nav.announcements' },
      { href: '/dashboard/calendar', icon: Calendar, labelKey: 'nav.calendar', label: 'Calendar & terms' },
    ]},
    { sectionKey: 'nav.section.account', items: [
      { href: '/dashboard/profile', icon: UserCircle, labelKey: 'nav.myProfile' },
    ]},
  ],
};

function isNavActive(href: string, pathname: string): boolean {
  const roots = ['/dashboard/student', '/dashboard/teacher', '/dashboard/parent', '/dashboard/admin', '/dashboard/institution'];
  if (roots.includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

const NavItem = ({ entry, role, pathname, onClick, router }: {
  entry: NavEntry; role: Role; pathname: string; onClick: () => void; router: ReturnType<typeof useRouter>;
}) => {
  const { t } = useTranslation();
  const active = isNavActive(entry.href, pathname);
  const Icon = entry.icon;

  return (
    <button
      type="button"
      onClick={() => { onClick(); router.push(entry.href); }}
      aria-current={active ? 'page' : undefined}
      className={`relative w-full px-3 h-9 rounded-xl flex items-center gap-3 cursor-pointer transition-colors text-start text-[13px] ${
        active
          ? 'bg-muted text-foreground font-semibold shadow-[var(--shadow-card)]'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground font-medium'
      }`}
    >
      {/* Active marker sits in the gutter, as in the reference design. */}
      {active && (
        <span data-nav-marker className="absolute -start-3 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
      )}
      <Icon className={`w-[17px] h-[17px] shrink-0 ${active ? 'text-primary' : ''}`} />
      <span className="truncate">{entry.label ?? t(entry.labelKey)}</span>
    </button>
  );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const flags = useFeatureFlags();
  const { user, profile, loading, fetchProfile } = useAuthSTORE();
  const account = useAccountMode();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newDevice, setNewDevice] = useState(false);
  const [mfaCheckedUid, setMfaCheckedUid] = useState<string | null>(null);
  const [mfaHold, setMfaHold] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const handleNavClick = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getIdToken().then(async (token) => {
      if (cancelled) return;
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('notice') !== '403') {
      setAccessDenied(false);
      return;
    }
    setAccessDenied(true);
    params.delete('notice');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [pathname]);

  useEffect(() => {
    if (loading || !profile) return;
    const next = decideDashboardAccess(pathname, profile, account.mode);
    if (!next.allowed) router.replace(next.redirectTo);
  }, [loading, profile, pathname, account.mode, router]);

  useEffect(() => {
    if (loading) return;
    const uid = user?.uid ?? '';
    const hold = uid ? adminMfaPending(uid) : false;
    setMfaHold(hold);
    setMfaCheckedUid(uid);
    if (hold) router.replace('/admin/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || user) return;
    // Closing a preview tab can make Firebase report a signed-out user for a
    // moment. Wait, then redirect only if the session is still gone.
    const timer = window.setTimeout(() => {
      if (!useAuthSTORE.getState().user) {
        router.push(pathname.startsWith('/dashboard/admin') ? '/admin/login' : '/login');
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [user, loading, router, pathname]);

  const staffRole = resolveStaffRole(profile ? {
    id: user?.uid,
    email: profile.email,
    role: profile.role,
    adminRole: profile.adminRole,
  } : null);
  useAdminIdle(Boolean(staffRole));
  const viewAs = useViewAs();

  useEffect(() => {
    if (!user || adminMfaPending(user.uid)) return;
    const deviceInfo = `${navigator.userAgent.slice(0, 80)}|${screen.width}x${screen.height}`;
    upsertUserSession(user.uid, deviceInfo).then(result => {
      sessionStorage.setItem('poket-session-at', String(result.createdAtMs));
      if (result.isNew) setNewDevice(true);
      const revokedAt = useAuthSTORE.getState().profile?.sessionsRevokedAt;
      if (sessionRevoked(revokedAt, result.createdAtMs)) {
        void reportActivity({ action: 'auth.logout', targetType: 'session', targetId: user.uid }).finally(() => {
          void signOut(auth).then(() => router.push(pathname.startsWith('/dashboard/admin') ? '/admin/login' : '/login'));
        });
      }
    }).catch(() => {});
  }, [user, router, pathname]);

  useEffect(() => {
    if (!profile || !user || adminMfaPending(user.uid)) return;
    const started = Number(sessionStorage.getItem('poket-session-at') || '0');
    if (sessionRevoked(profile.sessionsRevokedAt, started)) {
      void reportActivity({ action: 'auth.logout', targetType: 'session', targetId: user.uid }).finally(() => {
        void signOut(auth).then(() => router.push(pathname.startsWith('/dashboard/admin') ? '/admin/login' : '/login'));
      });
    }
  }, [profile, user, router, pathname]);

  useEffect(() => {
    if (!user || !profile || adminMfaPending(user.uid)) return;
    const next = learnerSpaceRoles(profile);
    if (!next) return;
    let cancelled = false;
    updateUser(user.uid, { roles: next }).then(() => {
      if (!cancelled) return fetchProfile(user.uid);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, profile, fetchProfile]);

  useEffect(() => {
    if (!account.ready || !account.mode) return;
    if (user && adminMfaPending(user.uid)) return;
    const next = modeRedirect(pathname, account.mode);
    if (next) router.replace(next);
  }, [account.ready, account.mode, pathname, router, user]);

  const mfaUnknown = loading || (user?.uid ? mfaCheckedUid !== user.uid : mfaCheckedUid === null);

  if (mfaUnknown || loading || !user || !profile || !account.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mfaHold) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Confirm the admin second factor before opening the dashboard.
        </p>
      </div>
    );
  }

  if (deletionClosed(profile.deletionRequest, Date.now())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-heading text-3xl">This account is closed</h1>
          <p className="text-sm text-muted-foreground">
            The 14-day grace period ended on {profile.deletionRequest ? formatDeletionDate(profile.deletionRequest) : 'the scheduled date'}.
            Contact support@poketschool.ai if removal should continue, or cancel it if the account is still here.
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              className="h-10 rounded-full bg-[#203337] px-4 text-sm font-semibold text-white"
              onClick={() => {
                void clearUserFields(user.uid, ['deletionRequest']).then(() => fetchProfile(user.uid));
              }}
            >
              Cancel deletion
            </button>
            <button
              type="button"
              className="h-10 rounded-full border border-border px-4 text-sm font-semibold"
              onClick={() => {
                clearViewAs();
                void reportActivity({ action: 'auth.logout', targetType: 'session', targetId: user.uid }).finally(() => {
                  void signOut(auth).then(() => router.push(staffRole ? '/admin/login' : '/login'));
                });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // A suspended account keeps its Firebase session, so without this check a
  // suspended user would carry on using the dashboard until their token expired.
  if (loginBlocked(accountStatusOf(profile))) {
    const closed = accountStatusOf(profile) !== 'suspended';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center card-glow">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 grid place-items-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl text-foreground">
            {closed ? 'This account is closed' : t('account.suspendedTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {closed
              ? 'An administrator closed this account. Contact support if that is a mistake.'
              : t('account.suspendedBody')}
            {profile.statusReason ? ` ${profile.statusReason}` : ''}
          </p>
          <a
            href="mailto:support@poketschool.ai"
            className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-foreground text-background font-bold text-sm"
          >
            {t('account.contactSupport')}
          </a>
          <button
            type="button"
            onClick={() => {
              void reportActivity({ action: 'auth.logout', targetType: 'session', targetId: user.uid }).finally(() => {
                void signOut(auth).then(() => { useAuthSTORE.getState().setUser(null); router.push('/login'); });
              });
            }}
            className="mt-3 text-sm font-semibold text-muted-foreground"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </div>
    );
  }

  const role = (account.mode ?? profile.role ?? 'student') as Role;
  const superAdmin = isSuperAdmin(profile);
  const roleLabel = account.mode
    ? MODE_NAMES[account.mode]
    : t(`roles.${profile.role}`, { defaultValue: ROLE_LABELS[profile.role] ?? profile.role });
  const chooseMode = (next: AccountMode) => {
    account.setMode(next);
    router.push(homeForMode(next));
  };
  const showModes = account.modes.length > 1 || account.canBecome;
  const become = account.canBecome ? () => router.push('/dashboard/student/become-instructor') : undefined;
  const access = decideDashboardAccess(pathname, profile, account.mode);
  if (!access.allowed || (account.mode && modeRedirect(pathname, account.mode))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  const nav = (NAV[role] ?? NAV.student).map((group, index) => {
    const cmsItem: NavEntry = { href: '/dashboard/admin/curriculum', icon: Layers, labelKey: 'nav.curriculumCms' };
    const bookItem: NavEntry = { href: '/dashboard/admin/books', icon: BookOpen, labelKey: 'nav.books', label: 'Book Studio' };
    const withCms = index !== 0 || role === 'admin' || !hasCmsAddon(profile) || (role !== 'teacher' && role !== 'institution_admin')
      ? group.items
      : [...group.items, cmsItem, bookItem];
    return {
      ...group,
      items: withCms.filter((item) => (!item.superOnly || superAdmin) && (!item.flag || isFeatureEnabled(flags, item.flag))),
    };
  }).filter(group => group.items.length > 0);
  const accent = ROLE_ACCENT[role];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AcademySession />
      <a href="#dashboard-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* ── Sidebar — light, profile-led, grouped ── */}
      <aside data-tour="sidebar" className={`relative bg-sidebar border-e border-sidebar-border flex flex-col transition-all duration-300 shrink-0 ${sidebarOpen ? 'w-[264px]' : 'w-0 opacity-0 overflow-hidden'}`}>

        {/* Who you are, at the top — the reference design leads with identity
            rather than a logo lockup. */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          <AccountMenu
            name={profile.displayName || profile.name || 'User'}
            email={user.email || profile.email || ''}
            roleLabel={roleLabel}
            staffHome={Boolean(staffRole)}
            modes={account.modes}
            activeMode={account.mode}
            onSwitchMode={showModes ? chooseMode : undefined}
            onBecomeInstructor={become}
          >
            <span className="flex items-center gap-3 p-2 -m-2 rounded-2xl hover:bg-muted transition-colors">
              <Avatar className="w-10 h-10 border border-border shrink-0">
                <AvatarImage src={profile.avatarUrl ?? user.photoURL ?? undefined} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                  {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-foreground truncate leading-tight">
                  {profile.displayName || profile.name || 'User'}
                </span>
                <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                  {roleLabel}
                </span>
              </span>
              <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </span>
          </AccountMenu>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto px-3 pb-2 space-y-0.5 [scrollbar-width:thin]">
          {nav.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {(group.sectionLabel || group.sectionKey) && (
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.14em] px-3 pt-5 pb-1.5">
                  {group.sectionLabel ?? t(group.sectionKey!)}
                </p>
              )}
              {group.items.map(entry => (
                <NavItem key={entry.href} entry={entry} role={role} pathname={pathname} onClick={handleNavClick} router={router} />
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
            <HelpCircle className="w-[17px] h-[17px] shrink-0" /> {t('nav.helpCenter')}
          </Link>
          <button
            onClick={() => {
              clearViewAs();
              void reportActivity({ action: 'auth.logout', targetType: 'session', targetId: user.uid }).finally(() => {
                void signOut(auth).then(() => {
                  useAuthSTORE.getState().setUser(null);
                  router.push(staffRole ? '/admin/login' : '/login');
                });
              });
            }}
            className="w-full flex items-center gap-3 px-3 h-9 rounded-xl text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-[17px] h-[17px] shrink-0" /> {t('nav.signOut')}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminViewAsBanner />
        {pathname.startsWith('/dashboard/studio') && <ModuleHeader force />}
        {/* Header */}
        <header className="h-[72px] bg-background/80 backdrop-blur-xl flex items-center justify-between gap-4 px-4 lg:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={t('nav.toggleSidebar')} aria-expanded={sidebarOpen}>
              <Menu className="w-5 h-5 text-muted-foreground" />
            </Button>
            <PipGuide role={role as TourRole} />
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Search"
              onClick={() => document.getElementById('dashboard-search')?.focus()}
            >
              <Search className="h-4 w-4" />
            </button>
            <span data-tour="search"><DashboardSearch /></span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {showModes && (
              <ModeSwitch
                modes={account.modes}
                active={account.mode}
                onSwitch={chooseMode}
                onBecomeInstructor={become}
              />
            )}
            <span data-tour="sparks"><SparksChip /></span>
            <span data-tour="language"><LanguageSwitcher /></span>
            <CurrencySwitcher />
            <span data-tour="notifications"><NotificationsBell /></span>
            <span className="ms-1" data-tour="profile">
              <AccountMenu
                name={profile.displayName || profile.name || 'User'}
                email={user.email || profile.email || ''}
                roleLabel={roleLabel}
                staffHome={Boolean(staffRole)}
                modes={account.modes}
                activeMode={account.mode}
                onSwitchMode={showModes ? chooseMode : undefined}
                onBecomeInstructor={become}
              >
                <Avatar className="w-9 h-9 border-2 border-border cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                  <AvatarImage src={profile.avatarUrl ?? user.photoURL ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                    {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
              </AccountMenu>
            </span>
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
        <div className="px-4 lg:px-6 pb-2">
          <Breadcrumbs />
        </div>
        <main id="dashboard-main" className="flex-1 overflow-y-auto relative pb-20 lg:pb-0">
          {/* A faint teal wash at the top, echoing the homepage sky. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(30,106,131,0.06)_0%,transparent_100%)]" />
          <OfflineBanner />
          <div className="relative px-4 pb-6 pt-1 lg:px-6 lg:pb-10">
            {accessDenied && (
              <div role="alert" className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {ACCESS_DENIED_MESSAGE}
              </div>
            )}
            <RoleChecklist role={role} />
            <PagePurpose pathname={pathname} />
            {children}
          </div>
        </main>
      </div>

      <MobileNav role={role} onMore={() => setSidebarOpen(true)} />
      {viewAs ? null : <AITutor />}
    </div>
  );
}

'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Search, Bell, Menu, Home, BookOpen, Clock, Activity, MessageSquare, ClipboardList, Presentation, Shield, BarChart, Settings, FileText, CheckCircle, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AITutor } from '@/components/ai-tutor';
import Link from 'next/link';

const NavItem = ({ href, icon: Icon, label, activeBgClass, activeTextClass, pathname, onClick, router }: any) => {
  const isActive = pathname === href;
  const activeClass = isActive 
    ? `${activeBgClass} ${activeTextClass} font-bold` 
    : 'text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium';
  
  return (
    <button 
      type="button"
      onClick={(e) => {
        if (onClick) onClick(e);
        router.push(href);
      }}
      className={`w-full p-3 rounded-xl flex items-center cursor-pointer transition-colors text-left ${activeClass}`}
    >
       <Icon className="w-5 h-5 mr-3 shrink-0" /> {label}
    </button>
  );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuthSTORE();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Close sidebar on mobile when navigating
  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-google-blue" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-[#DADCE0] transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 opacity-0 overflow-hidden shrink-0'}`}>
        <div className="h-16 flex items-center px-6 border-b border-[#DADCE0]">
          <span className="font-bold text-xl text-google-blue">Pocket School</span>
        </div>
        <nav className="p-4 space-y-1">
          <div className="text-xs font-bold text-[#5F6368] uppercase tracking-wider mb-4 px-3 mt-2">{profile.role} Portal</div>
          
          {profile.role === 'student' && (
            <>
              <NavItem href="/dashboard/student" icon={Home} label="Dashboard" activeBgClass="bg-[#E8F0FE]" activeTextClass="text-[#1967D2]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/student/courses" icon={BookOpen} label="My Courses" activeBgClass="bg-[#E8F0FE]" activeTextClass="text-[#1967D2]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/student/live" icon={Video} label="Live Classes" activeBgClass="bg-[#E8F0FE]" activeTextClass="text-[#1967D2]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/student/achievements" icon={CheckCircle} label="Achievements" activeBgClass="bg-[#E8F0FE]" activeTextClass="text-[#1967D2]" pathname={pathname} onClick={handleNavClick} router={router} />
            </>
          )}

          {profile.role === 'teacher' && (
            <>
              <NavItem href="/dashboard/teacher" icon={Home} label="Overview" activeBgClass="bg-[#E0F2F1]" activeTextClass="text-[#00796B]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/teacher/courses" icon={Presentation} label="Course Mgmt" activeBgClass="bg-[#E0F2F1]" activeTextClass="text-[#00796B]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/teacher/gradebook" icon={ClipboardList} label="Gradebook" activeBgClass="bg-[#E0F2F1]" activeTextClass="text-[#00796B]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/teacher/analytics" icon={Activity} label="Student Analytics" activeBgClass="bg-[#E0F2F1]" activeTextClass="text-[#00796B]" pathname={pathname} onClick={handleNavClick} router={router} />
            </>
          )}

          {profile.role === 'parent' && (
            <>
              <NavItem href="/dashboard/parent" icon={Home} label="Child Progress" activeBgClass="bg-[#FFF8E1]" activeTextClass="text-[#E65100]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/parent/communications" icon={MessageSquare} label="Communications" activeBgClass="bg-[#FFF8E1]" activeTextClass="text-[#E65100]" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/parent/duedates" icon={Clock} label="Due Dates" activeBgClass="bg-[#FFF8E1]" activeTextClass="text-[#E65100]" pathname={pathname} onClick={handleNavClick} router={router} />
            </>
          )}

          {profile.role === 'admin' && (
            <>
              <NavItem href="/dashboard/admin" icon={BarChart} label="Analytics" activeBgClass="bg-gray-900" activeTextClass="text-white" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/admin/institutions" icon={FileText} label="Institutions" activeBgClass="bg-gray-900" activeTextClass="text-white" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/admin/access" icon={Shield} label="Access Config" activeBgClass="bg-gray-900" activeTextClass="text-white" pathname={pathname} onClick={handleNavClick} router={router} />
              <NavItem href="/dashboard/admin/settings" icon={Settings} label="System Settings" activeBgClass="bg-gray-900" activeTextClass="text-white" pathname={pathname} onClick={handleNavClick} router={router} />
            </>
          )}

          <div className="mt-8 pt-4 border-t border-[#DADCE0]">
             <button
               onClick={() => {
                 useAuthSTORE.getState().logout();
                 router.push('/login');
               }}
               className="w-full p-3 rounded-xl flex items-center cursor-pointer transition-colors text-red-600 hover:bg-red-50 font-medium"
             >
                <div className="w-5 h-5 mr-3 flex items-center justify-center border-2 border-red-600 rounded-full" style={{ paddingLeft: '2px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </div>
                Logout
             </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-[#DADCE0] flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5 text-gray-600" />
            </Button>
            <div className="relative hidden md:block w-96">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search courses, lessons, flashcards..." className="pl-10 h-10 bg-[#F1F3F4] border-transparent focus:bg-white rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-gray-600">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-google-amber rounded-full"></span>
            </Button>
            <Avatar className="w-9 h-9 border border-gray-200 cursor-pointer">
              <AvatarImage src={profile.avatarUrl || user.photoURL || undefined} />
              <AvatarFallback>{profile.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          {children}
        </main>
      </div>
      
      {/* Global AI Tutor Component */}
      <AITutor />
    </div>
  );
}

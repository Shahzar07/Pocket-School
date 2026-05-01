'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Search, Bell, Menu, Home, BookOpen, Clock, Activity, MessageSquare, ClipboardList, Presentation, Shield, BarChart, Settings, FileText, CheckCircle, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AITutor } from '@/components/ai-tutor';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuthSTORE();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
              <div className="p-3 rounded-xl bg-google-blue/10 text-[#1967D2] font-bold flex items-center cursor-pointer hover:bg-google-blue/20 transition-colors" onClick={() => router.push('/dashboard/student')}>
                 <Home className="w-5 h-5 mr-3" /> Dashboard
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <BookOpen className="w-5 h-5 mr-3" /> My Courses
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <Video className="w-5 h-5 mr-3" /> Live Classes
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <CheckCircle className="w-5 h-5 mr-3" /> Achievements
              </div>
            </>
          )}

          {profile.role === 'teacher' && (
            <>
              <div className="p-3 rounded-xl bg-google-teal/10 text-[#00796B] font-bold flex items-center cursor-pointer hover:bg-google-teal/20 transition-colors" onClick={() => router.push('/dashboard/teacher')}>
                 <Home className="w-5 h-5 mr-3" /> Overview
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <Presentation className="w-5 h-5 mr-3" /> Course Mgmt
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <ClipboardList className="w-5 h-5 mr-3" /> Gradebook
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <Activity className="w-5 h-5 mr-3" /> Student Analytics
              </div>
            </>
          )}

          {profile.role === 'parent' && (
            <>
              <div className="p-3 rounded-xl bg-google-amber/10 text-[#E65100] font-bold flex items-center cursor-pointer hover:bg-google-amber/20 transition-colors" onClick={() => router.push('/dashboard/parent')}>
                 <Home className="w-5 h-5 mr-3" /> Child Progress
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <MessageSquare className="w-5 h-5 mr-3" /> Communications
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <Clock className="w-5 h-5 mr-3" /> Due Dates
              </div>
            </>
          )}

          {profile.role === 'admin' && (
            <>
              <div className="p-3 rounded-xl bg-gray-900 text-white font-bold flex items-center cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => router.push('/dashboard/admin')}>
                 <BarChart className="w-5 h-5 mr-3" /> Analytics
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <FileText className="w-5 h-5 mr-3" /> Institutions
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <Shield className="w-5 h-5 mr-3" /> Access Config
              </div>
              <div className="p-3 rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] font-medium flex items-center cursor-pointer transition-colors">
                 <Settings className="w-5 h-5 mr-3" /> System Settings
              </div>
            </>
          )}
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

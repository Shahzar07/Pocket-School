'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { BookOpen, Search, ArrowRight, PlayCircle } from 'lucide-react';

export default function CoursesPage() {
  const router = useRouter();

  const courses = [
    { id: 'c1', title: 'Biology 101: Cell Systems', teacher: 'Dr. Sarah Webb', progress: 65, color: '#1A73E8', bg: '#E8F0FE', modules: 12 },
    { id: 'c2', title: 'World History: The Ancients', teacher: 'Prof. Marcus Roe', progress: 30, color: '#F9AB00', bg: '#FFF8E1', modules: 8 },
    { id: 'c3', title: 'Physics: Kinematics', teacher: 'Dr. Sarah Webb', progress: 10, color: '#00897B', bg: '#E0F2F1', modules: 14 },
    { id: 'c4', title: 'Creative Writing Workshop', teacher: 'Emma Wilson', progress: 0, color: '#8E24AA', bg: '#F3E5F5', modules: 6 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#202124]">My Courses</h1>
          <p className="text-[#5F6368]">Continue learning across your enrolled subjects.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map(c => (
          <Card key={c.id} className="p-0 overflow-hidden rounded-[20px] shadow-sm border border-[#DADCE0] hover:shadow-google-hover transition-shadow cursor-pointer flex flex-col" onClick={() => router.push(`/dashboard/student/courses/${c.id}`)}>
             <div className="h-32 flex flex-col justify-end p-6 relative" style={{ backgroundColor: c.bg }}>
               <BookOpen className="w-16 h-16 absolute -right-2 -bottom-2 opacity-20" style={{ color: c.color }} />
               <span className="text-sm font-bold tracking-wider uppercase mb-1" style={{ color: c.color }}>{c.modules} Modules</span>
             </div>
             <div className="p-6 flex-1 flex flex-col justify-between">
               <div>
                  <h3 className="font-bold text-xl text-[#202124] mb-2">{c.title}</h3>
                  <p className="text-sm text-[#5F6368] mb-6">{c.teacher}</p>
               </div>
               <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-[#202124]">{c.progress > 0 ? `${c.progress}% Completed` : 'Not Started'}</span>
                  </div>
                  <Progress value={c.progress} className="h-2" style={{ ['--progress-background' as any]: c.bg }} />
                  <Button variant="outline" className="w-full mt-4 rounded-full font-medium" style={{ color: c.color, borderColor: c.color }}>
                    {c.progress > 0 ? 'Continue' : 'Start Course'} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
               </div>
             </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

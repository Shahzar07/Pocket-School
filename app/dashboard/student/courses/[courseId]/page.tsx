'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, PlayCircle, BookOpen, CheckCircle2, Lock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function CourseDetail() {
  const router = useRouter();
  const params = useParams();

  const syllabus = [
    { module: 'Module 1: Introduction to Cells', lessons: [
      { id: 'l1', title: 'What is a cell?', completed: true },
      { id: 'l2', title: 'Prokaryotic vs Eukaryotic', completed: true },
      { id: 'l3', title: 'Cell Organelles Basics', completed: true },
    ]},
    { module: 'Module 2: Cellular Energy', lessons: [
      { id: 'l4', title: 'Photosynthesis', completed: true },
      { id: 'l5', title: 'Cellular Respiration in Details', completed: false, current: true },
      { id: 'l6', title: 'ATP and Energy Transfer', completed: false, locked: true },
    ]},
    { module: 'Module 3: Cell Division', locked: true, lessons: [] }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5 text-[#5F6368]" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-[#202124]">Biology 101: Cell Systems</h1>
          <p className="text-[#5F6368]">Dr. Sarah Webb • 12 Modules</p>
        </div>
      </div>

      <Card className="p-8 rounded-[24px] shadow-sm border border-[#DADCE0] bg-white flex flex-col md:flex-row gap-8 items-center">
        <div className="w-full md:w-1/3 aspect-video bg-[#E8F0FE] rounded-2xl flex items-center justify-center">
           <BookOpen className="w-16 h-16 text-google-blue opacity-50" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[#202124] mb-4">Course Progress</h2>
          <div className="flex items-center gap-4 mb-2">
            <Progress value={65} className="h-3 flex-1" />
            <span className="font-bold text-google-blue">65%</span>
          </div>
          <p className="text-[#5F6368] mb-6">You're doing great! You've completed 5 lessons so far.</p>
          <Button size="lg" className="rounded-full bg-google-blue h-12 px-8" onClick={() => router.push(`/dashboard/student/courses/${params.courseId}/lessons/l5`)}>
             Continue Learning <PlayCircle className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </Card>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-[#202124]">Course Syllabus</h2>
        <div className="space-y-4">
          {syllabus.map((mod, i) => (
            <Card key={i} className={`p-0 rounded-[20px] shadow-sm border ${mod.locked ? 'border-[#DADCE0] bg-[#F8F9FA] opacity-75' : 'border-[#DADCE0] bg-white'}`}>
              <div className="p-4 border-b border-[#DADCE0] flex items-center justify-between">
                <h3 className="font-bold text-[#202124] flex items-center gap-2">
                  {mod.locked && <Lock className="w-4 h-4 text-[#5F6368]" />}
                  {mod.module}
                </h3>
              </div>
              {!mod.locked && (
                <div className="p-2 space-y-1">
                  {mod.lessons.map(lesson => (
                    <div 
                      key={lesson.id} 
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors ${lesson.current ? 'bg-[#E8F0FE] hover:bg-[#D2E3FC] cursor-pointer' : lesson.completed ? 'hover:bg-[#F8F9FA] cursor-pointer' : lesson.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F8F9FA] cursor-pointer'}`}
                      onClick={() => !lesson.locked && router.push(`/dashboard/student/courses/${params.courseId}/lessons/${lesson.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        {lesson.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-google-teal" />
                        ) : lesson.locked ? (
                          <Lock className="w-5 h-5 text-[#5F6368]" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-[#DADCE0]" />
                        )}
                        <span className={`font-medium ${lesson.current ? 'text-google-blue font-bold' : 'text-[#202124]'}`}>{lesson.title}</span>
                      </div>
                      {lesson.current && <span className="text-xs font-bold bg-white text-google-blue px-2 py-1 rounded-full shadow-sm">Current</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

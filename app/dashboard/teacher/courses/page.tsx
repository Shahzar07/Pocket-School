'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherCourseMgmt() {
  const courses = [
    { title: 'Biology 101', students: 34, status: 'Published' },
    { title: 'Advanced Chemistry', students: 28, status: 'Published' },
    { title: 'Introduction to Physics', students: 0, status: 'Draft' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#202124]">Course Management</h1>
          <p className="text-[#5F6368]">Create and manage your classes and learning materials.</p>
        </div>
        <Button onClick={() => toast.info('Redirecting to course creation...')} className="bg-google-blue hover:bg-[#1967D2] text-white">
          <Plus className="w-5 h-5 mr-2" /> New Course
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course, idx) => (
          <Card key={idx} className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0] flex flex-col">
            <div className="flex-1">
               <div className="w-12 h-12 bg-google-blue/10 rounded-xl flex items-center justify-center mb-4">
                 <BookOpen className="w-6 h-6 text-google-blue" />
               </div>
               <h3 className="font-bold text-lg text-[#202124] mb-1">{course.title}</h3>
               <p className="text-sm text-[#5F6368] mb-4">{course.students} enrolled students</p>
               <span className={`text-xs px-2 py-1 rounded-full font-medium ${course.status === 'Published' ? 'bg-[#E8F0FE] text-[#1967D2]' : 'bg-[#F1F3F4] text-[#5F6368]'}`}>
                 {course.status}
               </span>
            </div>
            
            <div className="mt-6 flex justify-end gap-2 border-t border-[#DADCE0] pt-4">
              <Button variant="ghost" size="sm" onClick={() => toast.info(`Editing ${course.title}...`)}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => toast.error(`Deleted ${course.title}.`)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

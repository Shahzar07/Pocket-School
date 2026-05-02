'use client';

import { Card } from '@/components/ui/card';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ParentDueDates() {
  const assignments = [
    { title: 'Cell Structure Quiz', course: 'Biology', date: 'Oct 27, 2026', time: '11:59 PM', urgency: 'high' },
    { title: 'History Essay Draft', course: 'History', date: 'Oct 30, 2026', time: '11:59 PM', urgency: 'medium' },
    { title: 'Math Problem Set 4', course: 'Mathematics', date: 'Nov 02, 2026', time: '11:59 PM', urgency: 'low' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#202124]">Upcoming Due Dates</h1>
          <p className="text-[#5F6368]">Track your child's assignments and quizzes.</p>
        </div>
      </div>

      <div className="space-y-4">
        {assignments.map((item, idx) => (
          <Card key={idx} className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0] flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                item.urgency === 'high' ? 'bg-red-50 text-red-500' :
                item.urgency === 'medium' ? 'bg-google-amber/10 text-google-amber' :
                'bg-google-teal/10 text-google-teal'
              }`}>
                {item.urgency === 'high' ? <AlertCircle className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-bold text-[#202124] text-lg">{item.title}</h3>
                <p className="text-[#5F6368] font-medium">{item.course}</p>
                <div className="flex items-center gap-3 mt-2 text-sm text-[#5F6368]">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {item.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {item.time}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" onClick={() => toast.info('Setting a reminder for this due date...')} className="text-google-blue">Remind Me</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

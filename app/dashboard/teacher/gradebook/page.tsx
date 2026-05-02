'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherGradebook() {
  const grades = [
    { student: 'Alex Johnson', assignment: 'Cell Biology Quiz', score: '92/100', date: 'Oct 24' },
    { student: 'Sarah Smith', assignment: 'Cell Biology Quiz', score: '88/100', date: 'Oct 24' },
    { student: 'Michael Brown', assignment: 'Chemistry Lab Report', score: '95/100', date: 'Oct 23' },
    { student: 'Emily Davis', assignment: 'Chemistry Lab Report', score: '85/100', date: 'Oct 23' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#202124]">Gradebook</h1>
          <p className="text-[#5F6368]">Review student scores and grade assignments.</p>
        </div>
        <Button onClick={() => toast.success('Grades exported to CSV.')} variant="outline">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card className="rounded-[24px] shadow-sm border border-[#DADCE0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F8F9FA] text-[#5F6368] font-medium border-b border-[#DADCE0]">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Assignment</th>
                <th className="px-6 py-4">Date Submitted</th>
                <th className="px-6 py-4 text-right">Score</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DADCE0]">
               {grades.map((grade, idx) => (
                 <tr key={idx} className="hover:bg-[#F8F9FA] transition-colors">
                   <td className="px-6 py-4 font-medium text-[#202124]">{grade.student}</td>
                   <td className="px-6 py-4 text-[#5F6368]">{grade.assignment}</td>
                   <td className="px-6 py-4 text-[#5F6368]">{grade.date}</td>
                   <td className="px-6 py-4 text-right font-bold text-[#202124]">{grade.score}</td>
                   <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-google-blue" onClick={() => toast.info(`Viewing submission for ${grade.student}`)}>Review</Button>
                   </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

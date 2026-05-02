'use client';

import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function TeacherAnalytics() {
  const data = [
    { week: 'Week 1', avgScore: 78, attendance: 95 },
    { week: 'Week 2', avgScore: 82, attendance: 92 },
    { week: 'Week 3', avgScore: 85, attendance: 96 },
    { week: 'Week 4', avgScore: 84, attendance: 90 },
    { week: 'Week 5', avgScore: 88, attendance: 94 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">Student Analytics</h1>
        <p className="text-[#5F6368]">Monitor class performance and individual student progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
           <h2 className="text-lg font-bold text-[#202124] mb-2">Class Average Score</h2>
           <div className="text-4xl font-bold text-google-blue mb-6">84.5%</div>
           <div className="h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <XAxis dataKey="week" stroke="#5F6368" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5F6368" fontSize={12} tickLine={false} axisLine={false} hide />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgScore" stroke="#1A73E8" strokeWidth={3} dot={{r: 4, fill: '#1A73E8', strokeWidth: 0}} />
                </LineChart>
             </ResponsiveContainer>
           </div>
         </Card>

         <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
           <h2 className="text-lg font-bold text-[#202124] mb-2">Class Attendance</h2>
           <div className="text-4xl font-bold text-google-teal mb-6">93.4%</div>
           <div className="h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <XAxis dataKey="week" stroke="#5F6368" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5F6368" fontSize={12} tickLine={false} axisLine={false} hide />
                  <Tooltip />
                  <Line type="monotone" dataKey="attendance" stroke="#00897B" strokeWidth={3} dot={{r: 4, fill: '#00897B', strokeWidth: 0}} />
                </LineChart>
             </ResponsiveContainer>
           </div>
         </Card>
      </div>
    </div>
  );
}

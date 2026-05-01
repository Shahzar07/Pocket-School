'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function ParentDashboard() {
  const { profile } = useAuthSTORE();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">Parent Portal</h1>
        <p className="text-[#5F6368]">Monitor your child's progress and achievements.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-4">
               <Avatar className="w-16 h-16">
                 <AvatarFallback className="bg-google-blue text-white text-xl">S</AvatarFallback>
               </Avatar>
               <div>
                 <h2 className="text-2xl font-bold text-[#202124]">Sarah's Progress</h2>
                 <p className="text-[#5F6368]">Grade 8 • 4,250 XP total</p>
               </div>
             </div>
             <Button onClick={() => toast.info('Opening messaging interface...')} variant="outline" className="rounded-full">
               <MessageSquare className="w-4 h-4 mr-2" /> Message Teacher
             </Button>
          </div>

          <div className="space-y-6">
            <div onClick={() => toast.info('Viewing Mathematics detals...')} className="cursor-pointer hover:bg-[#F8F9FA] p-2 -mx-2 rounded-lg transition-colors">
              <div className="flex justify-between font-medium mb-2">
                <span className="text-[#202124]">Mathematics</span>
                <span className="text-google-teal">A- (92%)</span>
              </div>
              <Progress value={92} className="h-3 bg-[#E0F2F1] [&>div]:bg-[#00897B]" />
            </div>
            <div onClick={() => toast.info('Viewing Science details...')} className="cursor-pointer hover:bg-[#F8F9FA] p-2 -mx-2 rounded-lg transition-colors">
              <div className="flex justify-between font-medium mb-2">
                <span className="text-[#202124]">Science</span>
                <span className="text-google-blue">B+ (88%)</span>
              </div>
              <Progress value={88} className="h-3" />
            </div>
            <div onClick={() => toast.info('Viewing History details...')} className="cursor-pointer hover:bg-[#F8F9FA] p-2 -mx-2 rounded-lg transition-colors">
              <div className="flex justify-between font-medium mb-2">
                <span className="text-[#202124]">World History</span>
                <span className="text-google-amber">B (85%)</span>
              </div>
              <Progress value={85} className="h-3 bg-[#FFF8E1] [&>div]:bg-[#F9AB00]" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0]">
          <h3 className="font-bold text-[#202124] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-google-blue" /> Upcoming Due Dates
          </h3>
          <div className="space-y-4">
            {[
               { title: 'Algebra Worksheet', course: 'Math', date: 'Tomorrow' },
               { title: 'Cell Structure Quiz', course: 'Science', date: 'Friday, Oct 27' },
               { title: 'History Essay', course: 'History', date: 'Monday, Oct 30' },
            ].map((d, i) => (
              <div key={i} onClick={() => toast.info(`Viewing details for ${d.title}`)} className="cursor-pointer hover:shadow-google-soft flex flex-col p-3 rounded-xl bg-[#F8F9FA] border border-[#DADCE0]">
                <span className="font-bold text-[#202124] text-sm">{d.title}</span>
                <span className="text-xs text-[#5F6368]">{d.course} • Due {d.date}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

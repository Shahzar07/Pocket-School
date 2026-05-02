'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentLiveClasses() {
  const upcomingClasses = [
    { title: 'Biology: Cellular Structure Q&A', time: '10:00 AM Today', duration: '45 min', instructor: 'Mr. Smith' },
    { title: 'Calculus: Derivatives', time: '1:00 PM Today', duration: '60 min', instructor: 'Ms. Davis' },
    { title: 'World History Review', time: '9:00 AM Tomorrow', duration: '50 min', instructor: 'Dr. John' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
       <div>
        <h1 className="text-3xl font-bold text-[#202124]">Live Classes</h1>
        <p className="text-[#5F6368]">Join upcoming virtual classrooms and review past recordings.</p>
      </div>

      <div className="space-y-4">
        {upcomingClasses.map((cls, idx) => (
          <Card key={idx} className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-red-50 text-red-500 rounded-full shrink-0">
                  <Video className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="font-bold text-[#202124] text-lg">{cls.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-[#5F6368]">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {cls.time}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {cls.duration}</span>
                    <span>Instructor: {cls.instructor}</span>
                  </div>
               </div>
            </div>
            <Button onClick={() => toast.success('Joining class in new window...')} className="bg-google-blue hover:bg-[#1967D2] text-white shrink-0">
               Join Class
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

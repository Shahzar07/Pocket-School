'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getEnrolledCourses, getLiveClassesForStudent, LiveClass } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Calendar, Clock, Radio } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentLiveClasses() {
  const { user } = useAuthSTORE();
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const enrolled = await getEnrolledCourses(user.uid);
      const courseIds = enrolled.map(e => e.course.id!).filter(Boolean);
      const live = await getLiveClassesForStudent(courseIds);
      // Defensive client-side sort (soonest first)
      live.sort((a, b) => (a.scheduledAt?.toDate?.()?.getTime() ?? 0) - (b.scheduledAt?.toDate?.()?.getTime() ?? 0));
      setClasses(live);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = (cls: LiveClass) => {
    if (cls.joinUrl) {
      window.open(cls.joinUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.info("Your teacher hasn't shared a meeting link for this class yet.");
    }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 flex justify-center">
      <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-md w-full">
        <p className="font-bold text-xl text-foreground mb-2">Couldn&apos;t load this page.</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Live Classes</h1>
        <p className="text-muted-foreground text-sm mt-1">Join upcoming virtual classrooms with your teachers.</p>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No live classes scheduled</p>
          <p className="text-sm mt-1">Your teachers haven&apos;t scheduled any live sessions yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map((cls, idx) => {
            const date = cls.scheduledAt?.toDate?.();
            return (
              <motion.div key={cls.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className="p-6 rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl shrink-0 ${cls.status === 'live' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                      {cls.status === 'live' ? <Radio className="w-6 h-6 animate-pulse" /> : <Video className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground text-lg">{cls.title}</h3>
                        {cls.status === 'live' && <Badge className="bg-red-100 text-red-700 rounded-full">LIVE NOW</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                        {date && (
                          <>
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                          </>
                        )}
                        {cls.teacherName && <span>Instructor: {cls.teacherName}</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleJoin(cls)}
                    className={`shrink-0 text-white ${cls.status === 'live' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}
                  >
                    {cls.status === 'live' ? 'Join Now' : 'Join Class'}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

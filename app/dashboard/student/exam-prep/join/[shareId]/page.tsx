'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Users, CalendarDays, Sparkles, Loader2, Lock, BookOpen } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashPage, Panel } from '@/components/dash-ui';
import { createPrep, getSharedPrep, type SharedPrep } from '@/lib/study/db';
import { addDays, buildSchedule, isoDay } from '@/lib/study/schedule';
import { GRADE_SCALES, scoreForGrade } from '@/lib/study/grades';

/**
 * Start your own copy of a classmate's plan. The topics and material come
 * across; their progress never does. Joining is free — the analysis was
 * already paid for by the person who shared it.
 */
export default function JoinPrepPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = use(params);
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [shared, setShared] = useState<SharedPrep | null | undefined>(undefined);
  const [examDate, setExamDate] = useState(addDays(isoDay(), 14));
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getSharedPrep(shareId).then(s => { setShared(s); if (s) setTarget(GRADE_SCALES[s.gradeScale ?? 'percent'].grades[1].grade); }).catch(() => setShared(null)); }, [shareId]);

  const join = async () => {
    if (!user || !shared) return;
    setBusy(true);
    try {
      const scale = shared.gradeScale ?? 'percent';
      const id = await createPrep(user.uid, {
        ownerId: user.uid, title: shared.title, subject: shared.subject, examDate,
        targetGrade: target, targetScore: scoreForGrade(scale, target), gradeScale: scale,
        level: profile?.level ?? shared.level ?? '', language: shared.language ?? 'en', minutesPerDay: 30,
        sourceNames: shared.sourceNames ?? [], sourceChars: shared.material?.length ?? 0,
        topics: shared.topics, plan: buildSchedule(shared.topics, examDate), mastery: {}, completed: {},
        streak: 0, studyDays: [], sharedFrom: shareId,
      }, shared.material ?? '');
      toast.success('Your copy is ready.');
      router.push(`/dashboard/student/exam-prep/${id}`);
    } catch {
      toast.error('Could not create your copy.');
      setBusy(false);
    }
  };

  if (shared === undefined) return <DashPage><div className="h-64 rounded-2xl bg-muted animate-pulse" /></DashPage>;
  if (!shared) return <DashPage><Panel><p className="font-semibold">This share link isn&apos;t valid any more.</p></Panel></DashPage>;
  const scale = shared.gradeScale ?? 'percent';

  return (
    <DashPage>
      <div className="max-w-2xl mx-auto w-full space-y-5">
        <Panel>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Shared by {shared.ownerName}</p>
          <h1 className="font-heading text-[30px] leading-tight tracking-[-0.03em] mt-2">{shared.title}</h1>
          <p className="text-[14px] text-muted-foreground mt-1">{shared.subject} · {shared.topics.length} topics · built from {shared.sourceNames?.length ?? 0} sources</p>
          <ul className="mt-5 grid sm:grid-cols-2 gap-2">
            {shared.topics.map((t, i) => (
              <li key={t.id} className="flex gap-2 text-[14px]"><BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span><span className="text-muted-foreground tabular-nums">{i + 1}.</span> {t.title}</span></li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[13px] font-semibold mb-1.5 inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Your exam date</span>
              <input type="date" value={examDate} min={addDays(isoDay(), 1)} onChange={e => setExamDate(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            </label>
            <div>
              <span className="block text-[13px] font-semibold mb-1.5">Your target</span>
              <div className="flex flex-wrap gap-1.5">
                {GRADE_SCALES[scale].grades.slice(0, 6).map(g => (
                  <button key={g.grade} onClick={() => setTarget(g.grade)} className={`h-10 min-w-10 px-3 rounded-xl border text-sm font-bold ${target === g.grade ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{g.grade}</button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Your progress and results stay private to you.</p>
          <button onClick={join} disabled={busy} className="mt-4 w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Start my own plan — free
          </button>
        </Panel>
      </div>
    </DashPage>
  );
}

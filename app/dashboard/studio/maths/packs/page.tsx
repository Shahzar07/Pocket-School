'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, BookMarked, Gift } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashPage, DashHeader } from '@/components/dash-ui';
import { authedFetch } from '@/lib/authed-fetch';
import { PackBoardLabel, PackStrip } from '@/components/study/pack-accent';
import { packTopics, showsFreeTopic, type ExamPack } from '@/lib/study/exam-packs';
import { listPacks } from '@/lib/study/pack-admin';
import { isSuperAdmin } from '@/lib/roles';
import { getPackProgress, type PackProgress } from '@/lib/study/db';

export default function PacksPage() {
  const { user, profile } = useAuthSTORE();
  const [progress, setProgress] = useState<Record<string, PackProgress>>({});
  const [packs, setPacks] = useState<ExamPack[]>(() => listPacks());
  useEffect(() => {
    let cancel = false;
    authedFetch('/api/study/exam-packs').then(async res => {
      if (!res.ok || cancel) return;
      const data = await res.json() as { packs?: ExamPack[] };
      if (Array.isArray(data.packs)) setPacks(data.packs);
    }).catch(() => undefined);
    return () => { cancel = true; };
  }, []);
  useEffect(() => {
    if (!user) return;
    Promise.all(packs.map(p => getPackProgress(user.uid, p.id).then(pr => [p.id, pr] as const).catch(() => [p.id, { mastery: {}, setsDone: 0 }] as const)))
      .then(rows => setProgress(Object.fromEntries(rows)));
  }, [user, packs]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="ET Maths · Official exams"
        title="Your exam's syllabus,"
        accent="topic by topic."
        description="Exam-style questions for every topic on the real syllabus, with worked solutions marked the way examiners mark them. Work through any question with ET AI, step by step. The first topic of every pack is free. Admins add and delete packs at the exam pack desk."
      />
      {isSuperAdmin(profile) ? <p className="text-sm"><Link href="/dashboard/admin/exam-packs" data-admin-pack-desk className="font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">Admin exam pack desk</Link></p> : null}
      <div data-exam-pack-list className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {packs.map((p, i) => {
          const topics = packTopics(p);
          const pr = progress[p.id];
          const tried = pr ? Object.keys(pr.mastery).length : 0;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/dashboard/studio/maths/packs/${p.id}`} className="group block h-full bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] overflow-hidden hover:border-primary/40 transition-colors">
                <PackStrip board={p.board} />
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <PackBoardLabel>{p.board}</PackBoardLabel>
                    {showsFreeTopic(p) ? <span className="text-[11px] font-semibold text-success bg-success/15 px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Gift className="w-3 h-3" /> 1st topic free</span> : null}
                  </div>
                  <p className="font-heading text-[20px] leading-tight mt-2">{p.name}</p>
                  <p className="text-[13px] text-muted-foreground mt-1.5 line-clamp-2">{p.blurb}</p>
                  <div className="mt-4 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5"><BookMarked className="w-4 h-4" /> {p.units.length} units · {topics.length} topics</span>
                    <span className="font-semibold text-primary inline-flex items-center gap-1">{tried ? `${tried} practised` : 'Start'} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </DashPage>
  );
}

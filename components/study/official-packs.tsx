'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, BookMarked, Gift } from 'lucide-react';
import { LevelMenu } from '@/components/level-menu';
import { DashPage } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/authed-fetch';
import { boardsForLevel, BOARD_STYLES } from '@/lib/essay/board-styles';
import { PackBoardLabel, PackStrip } from '@/components/study/pack-accent';
import { packTopics, showsFreeTopic, type ExamPack } from '@/lib/study/exam-packs';
import { listPacks } from '@/lib/study/pack-admin';
import { filterPacks, officialSubjectOptions, subjectSlug } from '@/lib/study/pack-catalog';
import { packCatalogCopy as copy } from '@/lib/study/pack-catalog-copy';
import { isSuperAdmin } from '@/lib/roles';
import { getPackProgress, type PackProgress } from '@/lib/study/db';

const field = 'mt-1 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm';

export function OfficialPacks() {
  const router = useRouter();
  const params = useSearchParams();
  const subject = params.get('subject') ?? '';
  const level = params.get('level') ?? '';
  const board = params.get('board') ?? '';
  const { user, profile } = useAuthSTORE();
  const [progress, setProgress] = useState<Record<string, PackProgress>>({});
  const [packs, setPacks] = useState<ExamPack[]>(() => listPacks());
  const subjects = officialSubjectOptions();
  const boards = level ? boardsForLevel(level) : BOARD_STYLES;
  const visible = useMemo(
    () => filterPacks(packs, { subject, level, board }),
    [packs, subject, level, board],
  );

  useEffect(() => {
    let cancel = false;
    authedFetch('/api/study/exam-packs').then(async (res) => {
      if (!res.ok || cancel) return;
      const data = await res.json() as { packs?: ExamPack[] };
      if (Array.isArray(data.packs)) setPacks(data.packs);
    }).catch(() => undefined);
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all(packs.map((pack) => getPackProgress(user.uid, pack.id).then((row) => [pack.id, row] as const).catch(() => [pack.id, { mastery: {}, setsDone: 0 }] as const)))
      .then((rows) => setProgress(Object.fromEntries(rows)));
  }, [user, packs]);

  function replaceQuery(next: { subject?: string; level?: string; board?: string }) {
    const query = new URLSearchParams();
    const subjectValue = next.subject ?? subject;
    const levelValue = next.level ?? level;
    const boardValue = next.board ?? board;
    if (subjectValue) query.set('subject', subjectSlug(subjectValue));
    if (levelValue) query.set('level', levelValue);
    if (boardValue) query.set('board', boardValue);
    const suffix = query.toString();
    router.replace(suffix ? `/dashboard/studio/exams/packs?${suffix}` : '/dashboard/studio/exams/packs');
  }

  return (
    <DashPage className="w-full px-4 sm:px-6">
      <div data-official-exams>
        <h1 className="font-heading text-[28px] leading-tight tracking-[-0.04em] text-foreground sm:text-[34px]">{copy.headline}</h1>
        {isSuperAdmin(profile) ? (
          <p className="mt-3 text-sm">
            <Link href="/dashboard/admin/exam-packs" data-admin-pack-desk className="font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{copy.adminDesk}</Link>
          </p>
        ) : null}
        <div data-pack-filters className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted-foreground">
            {copy.subject}
            <select className={field} aria-label={copy.subject} value={subjectSlug(subject)} onChange={(event) => replaceQuery({ subject: event.target.value })}>
              <option value="">{copy.allSubjects}</option>
              {subjects.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
            </select>
          </label>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{copy.level}</p>
            <div className="mt-1">
              <LevelMenu
                value={level}
                allowEmpty
                emptyLabel={copy.allLevels}
                ariaLabel={copy.level}
                className="w-full"
                onChange={(next) => {
                  const stillThere = !next || boardsForLevel(next).some((item) => item.id === board);
                  replaceQuery({ level: next, board: stillThere ? board : '' });
                }}
              />
            </div>
          </div>
          <label className="text-xs font-semibold text-muted-foreground">
            {copy.board}
            <select className={field} aria-label={copy.board} value={board} onChange={(event) => replaceQuery({ board: event.target.value })}>
              <option value="">{copy.allBoards}</option>
              {boards.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        {visible.length === 0 ? (
          <div data-coming-soon className="mt-6 rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <p className="font-heading text-2xl text-foreground">{copy.comingSoon}</p>
            <p className="mt-2 text-sm text-muted-foreground">{copy.comingSoonDetail}</p>
          </div>
        ) : (
          <div data-exam-pack-list className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((pack, index) => {
              const topics = packTopics(pack);
              const row = progress[pack.id];
              const tried = row ? Object.keys(row.mastery).length : 0;
              return (
                <motion.div key={pack.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                  <Link href={`/dashboard/studio/exams/packs/${pack.id}`} className="group block h-full overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-colors hover:border-primary/40">
                    <PackStrip board={pack.board} />
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <PackBoardLabel>{pack.board}</PackBoardLabel>
                        {showsFreeTopic(pack) ? <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success"><Gift className="h-3 w-3" /> {copy.freeTopic}</span> : null}
                      </div>
                      <p className="mt-2 font-heading text-[20px] leading-tight">{pack.name}</p>
                      <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">{pack.blurb}</p>
                      <div className="mt-4 flex items-center justify-between text-[13px]">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><BookMarked className="h-4 w-4" /> {pack.units.length} {copy.units} · {topics.length} {copy.topics}</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-primary">{tried ? `${tried} ${copy.practised}` : copy.start} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashPage>
  );
}

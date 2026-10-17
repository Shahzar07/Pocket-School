'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getUserBadges, getTopStudentsByXp, updateUser, Badge, UserProfile } from '@/lib/db';
import { privacyBoard } from '@/lib/platform/privacy-board';
import { BadgeArt } from '@/components/gamification/badge-art';
import { Zap, Star, Crown } from 'lucide-react';
import { LeaderboardPodium } from '@/components/leaderboard/podium';
import { streakFromDates } from '@/lib/learning';
import { Progress } from '@/components/ui/progress';
import { STARTER_BADGES, levelForXp } from '@/lib/gamification/catalog';
import { BadgeShelf } from '@/components/gamification/badge-shelf';
import { BadgeShareLinks } from '@/components/gamification/badge-share';
import { ProgressRing } from '@/components/gamification/progress-ring';
import { QuestList } from '@/components/gamification/quest-list';
import { isoWeekKey } from '@/lib/gamification/engine';
import { authedFetch } from '@/lib/api-client';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

export default function AchievementsPage() {
  const { user, profile, setProfile } = useAuthSTORE();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ id: string; data: UserProfile }[]>([]);
  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<Record<string, number>>({});
  const [questsDone, setQuestsDone] = useState<string[]>([]);
  const [freezes, setFreezes] = useState(0);

  useEffect(() => {
    if (!user) return;
    Promise.all([getUserBadges(user.uid), getTopStudentsByXp(10)]).then(([bs, lb]) => {
      setBadges(bs);
      setLeaderboard(lb);
      setLoading(false);
    });
    authedFetch('/api/gamification/state').then(data => {
      if (data.quests && typeof data.quests === 'object') setQuests(data.quests as Record<string, number>);
      if (Array.isArray(data.questsDone)) setQuestsDone(data.questsDone.filter((item): item is string => typeof item === 'string'));
      if (typeof data.freezes === 'number') setFreezes(data.freezes);
    }).catch(() => undefined);
  }, [user]);

  const xp = profile?.xp ?? 0;
  const earnedTypes = new Set(badges.map(b => b.type));
  const rank = levelForXp(xp);
  const today = new Date().toISOString().slice(0, 10);
  const shelf = STARTER_BADGES.filter(badge => badge.audience === 'student');
  const nextBadge = shelf.find(badge => !earnedTypes.has(badge.id) && badge.criteria.type === 'xp');
  const nextBadgeProgress = nextBadge && nextBadge.criteria.type === 'xp' ? Math.min((xp / nextBadge.criteria.atLeast) * 100, 100) : 100;
  const board = privacyBoard(
    leaderboard.map(({ id, data }) => ({
      id,
      name: data.name,
      score: data.xp ?? 0,
      shareBoard: data.shareBoard,
    })),
    user?.uid ?? null,
  );
  const myRank = board.findIndex(row => row.isYou) + 1;
  const streak = streakFromDates(profile?.studyDates ?? [], new Date().toISOString().slice(0, 10)).current;
  const boardKey = board.map(row => row.id).join('|');
  const [rankDelta, setRankDelta] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!boardKey) return;
    const key = 'poket-achievement-ranks';
    let previous: Record<string, number> = {};
    try {
      previous = JSON.parse(sessionStorage.getItem(key) ?? '{}') as Record<string, number>;
    } catch {
      previous = {};
    }
    const next: Record<string, number> = {};
    const delta: Record<string, number> = {};
    boardKey.split('|').forEach((id, index) => {
      const rank = index + 1;
      next[id] = rank;
      if (typeof previous[id] === 'number') delta[id] = previous[id] - rank;
    });
    sessionStorage.setItem(key, JSON.stringify(next));
    setRankDelta(delta);
  }, [boardKey]);
  const sharing = profile?.shareBoard !== false;

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="space-y-4 pt-8">
        <div className="h-4 w-32 bg-muted animate-pulse rounded-full" />
        <div className="h-12 w-64 bg-muted animate-pulse rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-3xl" />)}
      </div>
      <div className="h-32 bg-muted animate-pulse rounded-3xl" />
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map(i => <div key={i} className="h-72 bg-muted animate-pulse rounded-3xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          Your Progress
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          <span className="gradient-text italic">Achievements</span>
        </h1>
      </motion.div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total XP', value: xp.toLocaleString(), icon: <Zap className="w-6 h-6 text-primary" />, accent: 'bg-primary' },
          { label: 'Badges', value: badges.length, icon: <Star className="w-6 h-6 text-violet-500" />, accent: 'bg-violet-500' },
          { label: 'Leaderboard', value: myRank > 0 ? `#${myRank}` : '—', icon: <Crown className="w-6 h-6 text-amber-500" />, accent: 'bg-amber-500' },
        ].map((s, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={i + 1}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow text-center"
          >
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${s.accent} opacity-80`} />
            <div className="flex justify-center mb-3">{s.icon}</div>
            <p className="font-heading text-4xl sm:text-5xl text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Next Badge */}
      {nextBadge && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow"
        >
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-primary opacity-80" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Next Badge</h2>
          <p className="font-heading text-3xl text-foreground mt-1.5 mb-4">Up Next</p>
          <div className="flex items-center gap-4">
            <BadgeArt icon={nextBadge.icon} size={56} title={nextBadge.name} />
            <div className="flex-1">
              <p className="font-heading text-lg text-foreground">{nextBadge.name}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {nextBadge.description} ({xp.toLocaleString()} XP)
              </p>
              <Progress value={nextBadgeProgress} className="h-2" />
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Badges */}
        <div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Collection</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5 mb-4">All Badges</h2>
          </motion.div>
          <ProgressRing value={rank.progress} label={rank.name} sub={rank.nextName ? `Next is ${rank.nextName}` : 'Top level'} />
          <div className="mt-4">
            <BadgeShelf definitions={shelf} earnedIds={[...earnedTypes]} />
          </div>
          {user && (
            <ul className="mt-4 space-y-3">
              {shelf.filter(badge => earnedTypes.has(badge.id)).map(badge => (
                <li key={badge.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{badge.name}</span>
                  <BadgeShareLinks awardId={`${user.uid}_${badge.id}`} name={badge.name} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6">
            <h3 className="font-heading text-2xl mb-3">Quests</h3>
            <QuestList progress={quests} done={questsDone} periodDay={today} periodWeek={isoWeekKey(today)} />
            <p className="text-xs text-muted-foreground mt-3">{freezes} streak freeze earned. A freeze is earned, not bought.</p>
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Rankings</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5 mb-4">Top Learners</h2>
          </motion.div>
          <div className="space-y-2">
            <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={sharing}
                onChange={async event => {
                  if (!user || !profile) return;
                  const shareBoard = event.target.checked;
                  setProfile({ ...profile, shareBoard });
                  await updateUser(user.uid, { shareBoard });
                }}
              />
              Show me on the leaderboard
            </label>
            <LeaderboardPodium
              empty="Leaderboard data will appear here soon."
              entries={board.map(row => ({
                id: row.id,
                label: row.label,
                score: row.score,
                scoreLabel: `${row.score.toLocaleString()} XP`,
                isYou: row.isYou,
                streak: row.isYou ? streak : 0,
                rankDelta: rankDelta[row.id] ?? 0,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

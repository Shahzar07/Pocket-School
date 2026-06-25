'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getUserBadges, getTopStudentsByXp, Badge, UserProfile } from '@/lib/db';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { Trophy, Zap, Star, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

const ALL_BADGES = [
  { type: 'first_steps', name: 'First Steps', description: 'Earn your first 100 XP', icon: '🌱', threshold: 100 },
  { type: 'rising_star', name: 'Rising Star', description: 'Earn 500 XP', icon: '⭐', threshold: 500 },
  { type: 'knowledge_seeker', name: 'Knowledge Seeker', description: 'Earn 1,000 XP', icon: '📚', threshold: 1000 },
  { type: 'scholar', name: 'Scholar', description: 'Earn 5,000 XP', icon: '🎓', threshold: 5000 },
  { type: 'master', name: 'Master Learner', description: 'Earn 10,000 XP', icon: '👑', threshold: 10000 },
];

export default function AchievementsPage() {
  const { user, profile } = useAuthSTORE();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ id: string; data: UserProfile }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getUserBadges(user.uid), getTopStudentsByXp(10)]).then(([bs, lb]) => {
      setBadges(bs);
      setLeaderboard(lb);
      setLoading(false);
    });
  }, [user]);

  const xp = profile?.xp ?? 0;
  const earnedTypes = new Set(badges.map(b => b.type));
  const nextBadge = ALL_BADGES.find(b => !earnedTypes.has(b.type));
  const nextBadgeProgress = nextBadge ? Math.min((xp / nextBadge.threshold) * 100, 100) : 100;
  const myRank = leaderboard.findIndex(u => u.id === user?.uid) + 1;

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
            <div className="text-4xl">{nextBadge.icon}</div>
            <div className="flex-1">
              <p className="font-heading text-lg text-foreground">{nextBadge.name}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {nextBadge.description} ({xp.toLocaleString()} / {nextBadge.threshold.toLocaleString()} XP)
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
          <div className="space-y-3">
            {ALL_BADGES.map((b, i) => {
              const earned = earnedTypes.has(b.type);
              return (
                <motion.div
                  key={b.type}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={6 + i}
                  className={`bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow ${!earned ? 'opacity-50' : ''}`}
                >
                  <div className={`text-3xl ${!earned && 'grayscale'}`}>{b.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-sm text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.description}</p>
                  </div>
                  {earned ? (
                    <BadgeUI className="rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold">Earned</BadgeUI>
                  ) : (
                    <BadgeUI className="rounded-full bg-muted text-muted-foreground border-border text-[10px] font-semibold">Locked</BadgeUI>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Rankings</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5 mb-4">Top Learners</h2>
          </motion.div>
          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <div className="bg-card border border-border rounded-3xl p-10 text-center relative overflow-hidden">
                <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
                <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-heading text-2xl text-foreground">No Rankings Yet</p>
                <p className="text-sm text-muted-foreground mt-1">Leaderboard data will appear here soon.</p>
              </div>
            ) : leaderboard.map(({ id, data }, i) => (
              <motion.div
                key={id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={6 + i}
                className={`bg-card border rounded-2xl p-4 flex items-center gap-4 card-glow transition-colors ${
                  id === user?.uid ? 'bg-primary/5 border-primary/20' : 'border-border'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  i === 0 ? 'bg-amber-500/10 text-amber-600' :
                  i === 1 ? 'bg-muted text-muted-foreground' :
                  i === 2 ? 'bg-amber-500/10 text-amber-600' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-violet-500 text-white font-bold">
                    {data.name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {id === user?.uid ? `${data.name} (You)` : data.name}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-primary text-sm font-bold shrink-0">
                  <Zap className="w-3.5 h-3.5" />{(data.xp ?? 0).toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

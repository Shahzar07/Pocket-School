'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getUserBadges, getTopStudentsByXp, Badge, UserProfile } from '@/lib/db';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { Trophy, Zap, Star, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Achievements</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total XP', value: xp.toLocaleString(), icon: <Zap className="w-5 h-5 text-amber-500" />, color: 'bg-amber-50 border-amber-200' },
          { label: 'Badges', value: badges.length, icon: <Star className="w-5 h-5 text-violet-500" />, color: 'bg-violet-50 border-violet-200' },
          { label: 'Leaderboard', value: myRank > 0 ? `#${myRank}` : '—', icon: <Crown className="w-5 h-5 text-yellow-500" />, color: 'bg-yellow-50 border-yellow-200' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`${s.color} border rounded-2xl p-5 text-center`}
          >
            <div className="flex justify-center mb-2">{s.icon}</div>
            <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Next Badge */}
      {nextBadge && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Next Badge</h2>
          <div className="flex items-center gap-4">
            <div className="text-4xl">{nextBadge.icon}</div>
            <div className="flex-1">
              <p className="font-bold text-foreground">{nextBadge.name}</p>
              <p className="text-xs text-muted-foreground mb-2">{nextBadge.description} ({xp.toLocaleString()} / {nextBadge.threshold.toLocaleString()} XP)</p>
              <Progress value={nextBadgeProgress} className="h-2" />
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Badges */}
        <div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">All Badges</h2>
          <div className="space-y-3">
            {ALL_BADGES.map((b, i) => {
              const earned = earnedTypes.has(b.type);
              return (
                <motion.div key={b.type} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border ${earned ? 'bg-card border-border' : 'bg-muted/30 border-border opacity-50'}`}
                >
                  <div className={`text-3xl ${!earned && 'grayscale'}`}>{b.icon}</div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground text-sm">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.description}</p>
                  </div>
                  {earned ? (
                    <BadgeUI className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Earned</BadgeUI>
                  ) : (
                    <BadgeUI className="rounded-full bg-muted text-muted-foreground border-border text-[10px]">Locked</BadgeUI>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Top Learners</h2>
          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No leaderboard data yet.</p>
            ) : leaderboard.map(({ id, data }, i) => (
              <motion.div key={id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${id === user?.uid ? 'bg-primary/10 border-primary/30' : 'bg-card border-border'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-slate-100 text-slate-600' :
                  i === 2 ? 'bg-amber-100 text-amber-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold">
                    {data.name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{id === user?.uid ? `${data.name} (You)` : data.name}</p>
                </div>
                <div className="flex items-center gap-1 text-amber-600 text-sm font-bold shrink-0">
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

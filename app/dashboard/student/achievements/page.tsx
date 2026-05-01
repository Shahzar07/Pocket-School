'use client';

import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Flame, Star, Crown, Zap, Shield } from 'lucide-react';

export default function GamificationHub() {
  const leaderboard = [
    { name: 'Alex Johnson', xp: 12450, rank: 1 },
    { name: 'Sarah Chen', xp: 11900, rank: 2 },
    { name: 'Marcus Doe', xp: 10500, rank: 3 },
    { name: 'You', xp: 9240, rank: 4, me: true },
    { name: 'Emma Wilson', xp: 8100, rank: 5 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202124]">Achievements</h1>
        <p className="text-[#5F6368]">Track your progress, earn badges, and compete on the leaderboard.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0] bg-gradient-to-br from-google-blue to-[#1967D2] text-white">
          <div className="flex justify-between items-start mb-4">
            <Trophy className="w-8 h-8 text-white/80" />
            <span className="font-bold text-lg bg-white/20 px-3 py-1 rounded-full">Silver Tier</span>
          </div>
          <div className="text-4xl font-extrabold mb-1">9,240 XP</div>
          <div className="text-white/80 text-sm">760 XP to Gold Tier</div>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0] bg-gradient-to-br from-[#F9AB00] to-[#F57F17] text-white">
          <div className="flex justify-between items-start mb-4">
            <Flame className="w-8 h-8 text-white/80" />
            <span className="font-bold text-lg bg-white/20 px-3 py-1 rounded-full">On Fire!</span>
          </div>
          <div className="text-4xl font-extrabold mb-1">12 Days</div>
          <div className="text-white/80 text-sm">Current learning streak</div>
        </Card>

        <Card className="p-6 rounded-[24px] shadow-sm border border-[#DADCE0] bg-gradient-to-br from-google-teal to-[#00796B] text-white">
          <div className="flex justify-between items-start mb-4">
            <Star className="w-8 h-8 text-white/80" />
            <span className="font-bold text-lg bg-white/20 px-3 py-1 rounded-full">Top 15%</span>
          </div>
          <div className="text-4xl font-extrabold mb-1">745 / 1000</div>
          <div className="text-white/80 text-sm">Mastery Score</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-[#202124]">Your Badges</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'First Steps', icon: <Star className="w-6 h-6 text-yellow-500" />, active: true },
              { name: '7-Day Streak', icon: <Flame className="w-6 h-6 text-orange-500" />, active: true },
              { name: 'Quiz Master', icon: <Crown className="w-6 h-6 text-purple-500" />, active: true },
              { name: 'Speed Demon', icon: <Zap className="w-6 h-6 text-blue-500" />, active: false },
              { name: 'Perfect Score', icon: <Shield className="w-6 h-6 text-green-500" />, active: false },
            ].map((badge, i) => (
              <div key={i} className={`flex flex-col items-center justify-center p-4 rounded-2xl border ${badge.active ? 'bg-white border-[#DADCE0] shadow-sm' : 'bg-[#F8F9FA] border-dashed border-[#DADCE0] opacity-50'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${badge.active ? 'bg-[#E8F0FE]' : 'bg-[#E8EAED]'}`}>
                  {badge.icon}
                </div>
                <span className="text-sm font-bold text-center text-[#202124]">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#202124] mb-4">Weekly Leaderboard</h2>
          <Card className="rounded-[24px] shadow-sm border border-[#DADCE0] overflow-hidden">
             {leaderboard.map((item, i) => (
               <div key={i} className={`flex items-center gap-4 p-4 border-b border-[#DADCE0] last:border-0 ${item.me ? 'bg-[#E8F0FE]' : 'bg-white'}`}>
                 <div className={`w-8 font-bold text-center ${i===0?'text-yellow-500':i===1?'text-gray-400':i===2?'text-amber-700':'text-[#5F6368]'}`}>
                   #{item.rank}
                 </div>
                 <Avatar className="w-10 h-10 border border-[#DADCE0]">
                   <AvatarFallback className={item.me ? 'bg-google-blue text-white' : 'bg-[#F1F3F4]'}>{item.name.charAt(0)}</AvatarFallback>
                 </Avatar>
                 <div className="flex-1">
                   <div className={`font-bold ${item.me ? 'text-google-blue' : 'text-[#202124]'}`}>{item.name}</div>
                 </div>
                 <div className="font-bold text-[#5F6368]">{item.xp} <span className="text-xs">XP</span></div>
               </div>
             ))}
          </Card>
        </div>
      </div>

    </div>
  );
}

'use client';

import { useAuthSTORE } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Flame, Trophy, Calendar, ArrowRight, PlayCircle, BookOpen, Headphones, Presentation, Brain, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function StudentDashboard() {
  const { profile } = useAuthSTORE();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[24px] p-8 border border-[#DADCE0] shadow-google-soft flex flex-col md:flex-row items-center gap-8"
      >
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[#202124] mb-2">Welcome back, {profile?.name?.split(' ')[0] || 'Student'}!</h1>
          <p className="text-[#5F6368] mb-6">You're making great progress. Let's keep the momentum going.</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#FFF8E1] flex items-center justify-center">
                <Flame className="w-5 h-5 text-google-amber" />
              </div>
              <div>
                <div className="text-sm text-[#5F6368]">Streak</div>
                <div className="font-bold text-[#202124]">5 Days</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#E8F0FE] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-google-blue" />
              </div>
              <div>
                <div className="text-sm text-[#5F6368]">Total XP</div>
                <div className="font-bold text-[#202124]">{profile?.xp || 1500} XP</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Daily Goal Ring relative simulation */}
        <div className="w-48 bg-[#F8F9FA] rounded-[20px] p-4 flex flex-col items-center justify-center shrink-0 border border-[#DADCE0]">
          <div className="text-sm font-medium text-[#5F6368] mb-2">Daily Goal</div>
          <div className="relative w-24 h-24 mb-2">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="#E8EAED" strokeWidth="8" fill="none" />
              <circle cx="48" cy="48" r="40" stroke="#00897B" strokeWidth="8" fill="none" strokeDasharray="250" strokeDashoffset="50" className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xl font-bold text-[#202124]">80%</span>
            </div>
          </div>
          <div className="text-xs text-[#5F6368]">4/5 Lessons</div>
        </div>
      </motion.div>

      {/* Continue Learning */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#202124]">Continue Learning</h2>
          <Button variant="ghost" className="text-google-blue font-medium" onClick={() => toast.info('Loading full course list...')}>View All</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 rounded-[20px] shadow-google-soft hover:shadow-google-hover transition-shadow border cursor-pointer border-[#DADCE0]">
              <div className="w-full h-32 bg-[#E8F0FE] rounded-xl mb-4 flex items-center justify-center">
                <PlayCircle className="w-10 h-10 text-google-blue opacity-50" />
              </div>
              <div className="text-xs font-bold text-google-teal uppercase tracking-wider mb-2">Module {i}</div>
              <h3 className="font-bold text-[#202124] mb-2">Advanced Biological Structures</h3>
              <div className="flex items-center gap-2 mb-4">
                <Progress value={65} className="h-2 flex-1" />
                <span className="text-xs font-medium text-[#5F6368]">65%</span>
              </div>
              <Button onClick={() => toast.success(`Resuming Module ${i}...`)} className="w-full bg-white text-google-blue border border-[#DADCE0] hover:bg-[#E8F0FE] rounded-full">
                Resume <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Upcoming Live Classes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#202124]">Upcoming Live Classes</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0] flex items-center gap-6">
            <div className="bg-[#F8F9FA] p-4 rounded-2xl flex flex-col items-center justify-center min-w-[80px]">
              <span className="text-sm font-bold text-[#E53935] uppercase">Today</span>
              <span className="text-2xl font-bold text-[#202124]">2:00</span>
              <span className="text-sm text-[#5F6368]">PM</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#202124] text-lg">Cell Biology Lab Review</h3>
              <p className="text-[#5F6368] mb-3">Live Q&A with Dr. Sarah Jenkins</p>
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-google-blue text-white text-xs">SJ</AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <span className="bg-[#E8F0FE] text-[#1967D2] text-xs font-bold px-2 py-1 rounded-md">Biology</span>
                  <span className="bg-[#F1F3F4] text-[#5F6368] text-xs font-bold px-2 py-1 rounded-md">45 mins</span>
                </div>
              </div>
            </div>
            <Button onClick={() => toast.success('Joining class in a new window...')} className="shrink-0 bg-google-blue hover:bg-[#1967D2] rounded-full px-6">
              <Video className="w-4 h-4 mr-2" /> Join
            </Button>
          </Card>
          
          <Card className="p-6 rounded-[20px] shadow-sm border border-[#DADCE0] flex items-center gap-6 opacity-70">
            <div className="bg-[#F8F9FA] p-4 rounded-2xl flex flex-col items-center justify-center min-w-[80px]">
              <span className="text-sm font-bold text-[#5F6368] uppercase">Tmrw</span>
              <span className="text-2xl font-bold text-[#202124]">10:00</span>
              <span className="text-sm text-[#5F6368]">AM</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#202124] text-lg">Quantum Mechanics Intro</h3>
              <p className="text-[#5F6368] mb-3">Prof. Robert Chen</p>
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-google-teal text-white text-xs">RC</AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <span className="bg-[#E0F2F1] text-[#00796B] text-xs font-bold px-2 py-1 rounded-md">Physics</span>
                  <span className="bg-[#F1F3F4] text-[#5F6368] text-xs font-bold px-2 py-1 rounded-md">60 mins</span>
                </div>
              </div>
            </div>
            <Button onClick={() => toast.success('RSVP confirmed!')} variant="outline" className="shrink-0 rounded-full px-6">
              <Calendar className="w-4 h-4 mr-2" /> RSVP
            </Button>
          </Card>
        </div>
      </section>

      {/* AI Recommendations & Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#202124]">AI Recommendations</h2>
            <div className="bg-[#E8F0FE] text-[#1967D2] text-xs px-2 py-1 rounded-full font-bold">Based on your weakness</div>
          </div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div onClick={() => toast.info('Loading interactive recommendation...')} key={i} className="p-4 bg-white rounded-[16px] border border-[#DADCE0] shadow-sm flex gap-4 hover:shadow-google-soft transition-shadow cursor-pointer">
                <div className="w-16 h-16 rounded-xl bg-[#FFF8E1] flex items-center justify-center shrink-0">
                  <Brain className="w-8 h-8 text-google-amber" />
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <h4 className="font-bold text-[#202124]">Cellular Respiration Review</h4>
                  <p className="text-sm text-[#5F6368]">You struggled with this on the last quiz. Try this interactive mind map.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#202124] mb-4">Quick Formats</h2>
          <div className="bg-white rounded-[20px] p-4 border border-[#DADCE0] shadow-sm space-y-2">
            <Button onClick={() => toast.success('Generating Audio Podcast context...')} variant="ghost" className="w-full justify-start h-12 rounded-xl text-left font-medium text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4]">
              <Headphones className="w-5 h-5 mr-3 text-google-teal" /> Audio Podcasts
            </Button>
            <Button onClick={() => toast.success('Generating Presentation Slides context...')} variant="ghost" className="w-full justify-start h-12 rounded-xl text-left font-medium text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4]">
              <Presentation className="w-5 h-5 mr-3 text-google-amber" /> Presentation Slides
            </Button>
            <Button onClick={() => toast.success('Generating Flashcards context...')} variant="ghost" className="w-full justify-start h-12 rounded-xl text-left font-medium text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4]">
              <BookOpen className="w-5 h-5 mr-3 text-google-blue" /> Flashcards
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

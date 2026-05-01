'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Brain, Presentation, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-xl">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Pocket School</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign In
          </Link>
          <Button onClick={() => router.push('/signup')} className="rounded-full shadow-google-soft hover:shadow-google-hover transition-all">
            Get Started
          </Button>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-16 md:py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F0FE] text-[#1967D2] text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-[#1A73E8] animate-pulse" />
            AI-Powered Adaptive Learning
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-[#202124] mb-6 leading-tight">
            <span className="text-[#1A73E8]">Pocket</span> School
          </h1>
          <p className="text-xl md:text-2xl text-[#5F6368] mb-12 max-w-2xl mx-auto leading-relaxed">
            Upload any material. Our AI transforms it into podcasts, interactive mind maps, flashcards, and quizzes perfectly tailored to how you learn best.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="rounded-full h-14 px-8 text-lg shadow-google-hover" onClick={() => router.push('/signup')}>
              Start Learning for Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg border-[#DADCE0] text-[#1A73E8] hover:bg-[#E8F0FE]" onClick={() => router.push('/#features')}>
              See How It Works
            </Button>
          </div>
        </motion.div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 w-full" id="features">
          {[
            {
              icon: <BookOpen className="w-8 h-8 text-[#1A73E8]" />,
              title: "11 Different Formats",
              desc: "From podcasts to slide decks, our platform generates 11 versatile formats for every single lesson."
            },
            {
              icon: <Brain className="w-8 h-8 text-[#00897B]" />,
              title: "Socratic AI Tutor",
              desc: "Don't just get answers. Our AI tutor guides you to the solution, building deep understanding."
            },
            {
              icon: <Zap className="w-8 h-8 text-[#F9AB00]" />,
              title: "Gamified Progress",
              desc: "Earn XP, unlock badges, and compete globally on the leaderboards as you master new skills."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="p-8 rounded-[24px] bg-white border border-[#DADCE0] shadow-google-soft hover:shadow-google-hover transition-shadow text-left"
            >
              <div className="bg-[#E8F0FE] w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-[#202124] mb-3">{feature.title}</h3>
              <p className="text-[#5F6368] leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
      
      <footer className="w-full py-8 text-center text-[#5F6368] border-t border-[#DADCE0]">
        <p>powered by Rochford's Education for enhanced learnings!</p>
      </footer>
    </div>
  );
}

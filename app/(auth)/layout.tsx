'use client';

import { motion } from 'motion/react';
import { Brain, BookOpen, Sparkles, Trophy, Users } from 'lucide-react';
import Link from 'next/link';

const FEATURES = [
  { icon: <Brain className="w-4 h-4" />, title: 'Mojo — Your AI Tutor', desc: 'Adapts to how you think, 24 / 7' },
  { icon: <BookOpen className="w-4 h-4" />, title: 'IGCSE · A-Levels · Degrees', desc: 'Full academic pathways, your pace' },
  { icon: <Sparkles className="w-4 h-4" />, title: 'Visual Learning Engine', desc: 'Mind maps, diagrams & interactive lessons' },
  { icon: <Trophy className="w-4 h-4" />, title: 'Smart Exam Prep', desc: 'Past papers, gap analysis, revision plans' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#06060F]">
      {/* ── Left: video hero panel ── */}
      <div className="hidden lg:block w-[52%] shrink-0 p-5">
        <div className="relative w-full h-full rounded-3xl overflow-hidden bg-black min-h-[calc(100vh-2.5rem)]">
          {/* Video — NO overlay/tint */}
          <video
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Floating content — no full-screen overlay, text/cards carry their own blur */}
          <div className="relative z-10 h-full flex flex-col justify-between p-10">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 w-fit">
              <div className="bg-black/30 backdrop-blur-md p-2 rounded-xl border border-white/20">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                Pocket School
              </span>
            </Link>

            {/* Hero text + feature cards */}
            <div className="space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1
                  className="text-[2.6rem] leading-[1.1] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] mb-3"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  Your Smartest<br />
                  <em>Classroom in Your Pocket</em>
                </h1>
                <p className="text-white/70 text-sm leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                  AI-powered learning for IGCSE, A-Levels, degrees &amp; beyond.
                </p>
              </motion.div>

              <div className="space-y-2.5">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.35 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3 bg-black/25 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10"
                  >
                    <div className="bg-[#1A73E8]/80 backdrop-blur-sm p-2 rounded-lg text-white shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold leading-tight">{f.title}</p>
                      <p className="text-white/50 text-xs mt-0.5">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: form area ── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-[#06060F]">
        <div className="w-full max-w-md">
          {/* Mobile-only logo */}
          <div className="lg:hidden mb-10 flex items-center gap-2">
            <div className="bg-[#1A73E8]/20 p-2 rounded-xl border border-[#1A73E8]/30">
              <Brain className="w-5 h-5 text-[#1A73E8]" />
            </div>
            <span className="text-white font-bold text-xl">Pocket School</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

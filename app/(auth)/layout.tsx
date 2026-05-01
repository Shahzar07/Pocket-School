'use client';

import { motion } from 'motion/react';
import { Brain } from 'lucide-react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Branding / Decorative */}
      <div className="hidden lg:flex w-1/2 bg-[#F8F9FA] relative flex-col justify-between p-12 overflow-hidden border-r border-[#DADCE0]">
        <Link href="/" className="flex items-center gap-2 relative z-10 w-fit">
          <div className="bg-google-blue/10 p-2 rounded-xl">
            <Brain className="w-6 h-6 text-google-blue" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#202124]">Pocket School</span>
        </Link>

        {/* Abstract decorative elements simulating learning paths */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute w-[600px] h-[600px] bg-gradient-to-tr from-google-blue/10 to-google-teal/10 rounded-full blur-[80px] -translate-x-1/4 -translate-y-1/4" />
          <div className="absolute w-[400px] h-[400px] bg-gradient-to-tr from-google-amber/10 to-google-blue/5 rounded-full blur-[60px] translate-x-1/3 translate-y-1/3" />
        </div>

        <div className="relative z-10 max-w-lg mt-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl font-extrabold tracking-tight text-[#202124] leading-tight mb-6"
          >
            Master any subject, <span className="text-google-blue">your way.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl text-[#5F6368] leading-relaxed"
          >
            AI-powered learning paths, micro-lessons, and an adaptive tutor that understands your unique pace.
          </motion.p>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md">
           {children}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'ps-preloader-shown';
const WORDS = ['Welcome', 'To', 'Pocket', 'AI', 'School'];

export function HomePreloader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alreadyShown = sessionStorage.getItem(STORAGE_KEY);
    if (alreadyShown) return;

    setVisible(true);
    document.body.style.overflow = 'hidden';

    const t = window.setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setVisible(false);
    }, 2800);

    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) {
      document.body.style.overflow = '';
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#06060F]"
        >
          {/* Subtle drifting blobs for depth */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#1A73E8]/15 blur-[120px] blob-1" />
            <div className="absolute top-1/2 -right-32 w-[440px] h-[440px] rounded-full bg-[#7C3AED]/12 blur-[110px] blob-2" />
            <div className="absolute -bottom-40 left-1/4 w-[460px] h-[460px] rounded-full bg-[#F5B400]/10 blur-[120px] blob-3" />
          </div>

          {/* Word-by-word reveal */}
          <div className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 max-w-4xl text-center">
            {WORDS.map((w, i) => (
              <motion.span
                key={w + i}
                initial={{ y: 28, opacity: 0, filter: 'blur(8px)' }}
                animate={{
                  y: 0,
                  opacity: 1,
                  filter: 'blur(0px)',
                  transition: { delay: 0.15 + i * 0.13, duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                }}
                className="font-heading text-white text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05]"
                style={{ letterSpacing: '-0.02em' }}
              >
                {w === 'AI' ? <em className="bg-gradient-to-r from-[#60A5FA] to-[#F5B400] bg-clip-text text-transparent not-italic">AI</em> : w}
              </motion.span>
            ))}
          </div>

          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              transition: { delay: 1.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] },
            }}
            className="relative mt-7 text-white/55 text-sm sm:text-base tracking-[0.18em] uppercase font-medium"
          >
            Where every mind finds its pathway.
          </motion.p>

          {/* Bottom progress line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1, transition: { duration: 2.4, ease: 'easeInOut' } }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 origin-left w-40 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

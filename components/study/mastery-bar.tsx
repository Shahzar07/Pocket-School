'use client';

import { motion } from 'motion/react';
import { Target } from 'lucide-react';

/** Where the student is (avatar dot) against where they're aiming (target). */
export function MasteryBar({ value, target, initial = 'Me', label }: { value: number; target: number; initial?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const t = Math.max(0, Math.min(100, target));
  return (
    <div>
      <div className="relative h-3 rounded-full bg-muted my-4">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/70 to-primary"
          initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
        <motion.span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-card border-2 border-primary grid place-items-center text-[11px] font-bold text-primary shadow"
          initial={{ left: 0 }} animate={{ left: `${v}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20 }}>
          {initial.slice(0, 2).toUpperCase()}
        </motion.span>
        <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-rose-50 border-2 border-rose-400 grid place-items-center" style={{ left: `${t}%` }} title={`Target ${t}%`}>
          <Target className="w-3.5 h-3.5 text-rose-500" />
        </span>
      </div>
      {label && <p className="text-[12px] text-muted-foreground text-center">{label}</p>}
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';

const ConfettiBurst = dynamic(
  () => import('@/components/gamification/confetti-burst').then(mod => mod.ConfettiBurst),
  { ssr: false },
);

export function Celebration({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  if (!show || reduce) return null;
  return <ConfettiBurst />;
}

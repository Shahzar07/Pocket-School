import type { ReactNode } from 'react';
import { packFamily, packStrip } from '@/lib/study/pack-accent';

/** Top bar on a pack card. Decorative; the board name is the accessible label. */
export function PackStrip({ board, className = 'h-2' }: { board: string; className?: string }) {
  return (
    <div
      aria-hidden
      data-pack-family={packFamily(board)}
      className={className}
      style={{ background: packStrip(board) }}
    />
  );
}

/** Category name. Blue on a light card, cyan on a dark card. */
export function PackBoardLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0] ${className}`}>
      {children}
    </span>
  );
}

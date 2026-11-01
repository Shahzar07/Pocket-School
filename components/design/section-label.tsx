import type { ReactNode } from 'react';

/** Small pill above a section title. Blue on light, mist on ink. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex max-w-full items-center rounded-full border border-[#1E6A83]/15 bg-white px-3 py-1 text-xs font-semibold text-[#1E6A83] shadow-[0_8px_24px_rgba(32,51,55,0.05)] dark:border-[#E7F4F2]/20 dark:bg-[#122226] dark:text-[#E7F4F2]">
      {children}
    </p>
  );
}

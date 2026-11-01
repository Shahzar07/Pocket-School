import type { ReactNode } from 'react';

/** Quiet section label. Sentence case, no pill, no tracking. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-normal leading-5 text-[#5F7074] dark:text-[#93A7AB]">
      {children}
    </p>
  );
}

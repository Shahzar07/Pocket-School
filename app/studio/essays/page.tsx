import type { Metadata } from 'next';
import { EssaysDesk } from '@/components/essays/essays-desk';

export const metadata: Metadata = {
  title: 'ET Essays',
  description: 'ET AI drafts an essay or marks one you paste or upload.',
};

export default function EssaysPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">ET AI</p>
      <h1 className="mt-1 font-heading text-4xl tracking-[-0.04em]">ET Essays</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        Draft with ET AI, or paste and upload an essay for a percentage, a 9–1 grade, and an A*–U grade.
      </p>
      <div className="mt-6">
        <EssaysDesk />
      </div>
    </main>
  );
}

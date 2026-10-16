import type { Metadata } from 'next';
import { EssayReview } from '@/components/essays/essay-review';

export const metadata: Metadata = {
  title: 'ET Essays review',
  description: 'Teachers review ET Essays flags and can release marking.',
};

export default function EssayReviewPage() {
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">ET AI</p>
      <h1 className="mt-1 font-heading text-4xl tracking-[-0.04em]">Teacher review</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        See how ET AI was used, and release marking when a flag appears to be a false positive.
      </p>
      <div className="mt-6">
        <EssayReview />
      </div>
    </main>
  );
}

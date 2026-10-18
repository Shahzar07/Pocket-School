import { IdCardPanel } from '@/components/cards/id-card-panel';
import { POKET_SAMPLE_CARD, ROCHFORD_DEMO_CARD } from '@/lib/cards/id-face';

export default function PreviewCardPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Poket School sample</p>
          <IdCardPanel view={POKET_SAMPLE_CARD} />
        </section>
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Rochford demo · Rochford&apos;s International School</p>
          <IdCardPanel view={ROCHFORD_DEMO_CARD} />
        </section>
      </div>
    </main>
  );
}

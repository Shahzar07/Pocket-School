import { IdCardPanel } from '@/components/cards/id-card-panel';
import { POKET_SAMPLE_CARD, ROCHFORD_DEMO_CARD } from '@/lib/cards/id-face';

export default function PreviewIdPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <IdCardPanel view={POKET_SAMPLE_CARD} />
        <IdCardPanel view={ROCHFORD_DEMO_CARD} />
      </div>
    </main>
  );
}

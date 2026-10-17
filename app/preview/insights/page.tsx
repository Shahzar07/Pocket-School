import { CensusPanel } from '@/components/insights/census-panel';
import { SAMPLE_INSIGHTS } from '@/lib/insights/sample-census';

/** Static grouped sample so the panel can be reviewed without a live database. */
export default function InsightsPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-4 py-6">
      <CensusPanel sample={SAMPLE_INSIGHTS} />
    </main>
  );
}

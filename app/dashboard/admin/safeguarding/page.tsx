import { ComingSoon } from '@/components/coming-soon';
import { NetworkPreview } from '@/components/network/surfaces';

export const dynamic = 'force-dynamic';

export default function SafeguardingPage() {
  return (
    <ComingSoon title="Safeguarding desk" detail="This timeline is a preview. Live concerns go to Poket SafeLine.">
      <NetworkPreview view="safety" />
    </ComingSoon>
  );
}

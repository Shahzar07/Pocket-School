import { ComingSoon } from '@/components/coming-soon';
import { NetworkPreview } from '@/components/network/surfaces';

export const dynamic = 'force-dynamic';

export default function FoundersPage() {
  return (
    <ComingSoon title="Founders" detail="Founder matching is not open yet. Nothing on this screen is a live introduction.">
      <NetworkPreview view="founders" />
    </ComingSoon>
  );
}
